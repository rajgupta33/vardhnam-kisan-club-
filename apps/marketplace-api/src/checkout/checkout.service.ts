import { createHash, randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  CatalogueStatus,
  DeliveryFailureReasonCode,
  DeliveryProofLocationStatus,
  DistributorOfferStatus,
  DeliveryPartnerAvailabilityStatus,
  IdempotencyStatus,
  InventoryBatchStatus,
  InventoryMovementType,
  MembershipStatus,
  OrderType,
  OrganisationType,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  ProductCheckoutStatus,
  ProductDeliveryAssignmentStatus,
  ProductDispatchStatus,
  ProductInvoiceStatus,
  ProductOrderStatus,
  UserStatus,
  WarehouseStatus,
  type CartItem,
  type FarmerAddress,
  type FarmerProfile,
  type InventoryMovement,
  type Organisation,
  type ProductDeliveryAssignment,
  type ProductDispatch,
  type ProductInvoice,
  type ProductOrder,
  type ProductOrderItem,
  type ProductOrderItemReservation,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { FinanceService } from '../finance/finance.service';
import {
  KisanClubBenefitService,
  type KisanClubBenefitEvaluation,
} from '../kisan-club/benefits/kisan-club-benefit.service';
import { KisanClubBenefitTokenService } from '../kisan-club/benefits/kisan-club-benefit-token.service';
import type { RedeemKisanClubBenefitTokenDto } from '../kisan-club/dto/redeem-kisan-club-benefit-token.dto';
import {
  FarmerOrderNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { OtpSenderService } from '../notifications/otp-sender.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignDeliveryDto } from './dto/assign-delivery.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CheckoutFromCartDto } from './dto/checkout-from-cart.dto';
import type { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import type { FulfilmentOrderDecisionDto } from './dto/fulfilment-order-decision.dto';
import type { GenerateProductInvoiceDto } from './dto/generate-product-invoice.dto';
import type { ListFulfilmentOrdersQueryDto } from './dto/list-fulfilment-orders-query.dto';
import type { ListMyOrdersQueryDto } from './dto/list-my-orders-query.dto';
import type { ReportDeliveryFailureDto } from './dto/report-delivery-failure.dto';
import type { RetryDeliveryDto } from './dto/retry-delivery.dto';
import type { VerifyPackagePickupDto } from './dto/verify-package-pickup.dto';
import {
  calculateInclusiveInvoiceTax,
  indianFinancialYear,
  type InvoiceTaxLine,
} from './invoice-tax';

const checkoutCartInclude = Prisma.validator<Prisma.CartInclude>()({
  deliveryAddress: true,
  items: {
    orderBy: { createdAt: 'asc' },
  },
});

const checkoutOfferInclude = Prisma.validator<Prisma.DistributorOfferInclude>()({
  distributorOrganisation: true,
  warehouse: true,
  batch: true,
  product: {
    include: {
      brand: true,
      companyOrganisation: true,
    },
  },
  variant: true,
});

const eligibleBatchInclude = Prisma.validator<Prisma.InventoryBatchInclude>()({
  inventoryMovements: {
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
});

const productOrderDetailInclude = Prisma.validator<Prisma.ProductOrderInclude>()({
  invoice: true,
  dispatch: true,
  deliveryAssignment: true,
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      reservations: {
        orderBy: { createdAt: 'asc' },
        include: {
          batch: true,
          inventoryMovement: true,
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
  },
});

const productCheckoutDetailInclude = Prisma.validator<Prisma.ProductCheckoutInclude>()({
  deliveryAddress: true,
  orders: {
    orderBy: { createdAt: 'asc' },
    include: productOrderDetailInclude,
  },
});

type CheckoutCart = Prisma.CartGetPayload<{ include: typeof checkoutCartInclude }>;
type CheckoutOffer = Prisma.DistributorOfferGetPayload<{ include: typeof checkoutOfferInclude }>;
type EligibleBatch = Prisma.InventoryBatchGetPayload<{ include: typeof eligibleBatchInclude }>;
type ProductCheckoutWithDetails = Prisma.ProductCheckoutGetPayload<{
  include: typeof productCheckoutDetailInclude;
}>;
type ProductOrderWithDetails = Prisma.ProductOrderGetPayload<{
  include: typeof productOrderDetailInclude;
}>;

type CheckoutClient = PrismaService | Prisma.TransactionClient;

const DELIVERY_OTP_EXPIRY_HOURS = 24;
const DELIVERY_OTP_MAX_ATTEMPTS = 5;
const DELIVERY_RETRY_MAX_DAYS = 7;

interface PreparedCheckoutItem {
  cartItem: CartItem;
  offer: CheckoutOffer;
  unitPricePaise: number;
  lineTotalPaise: number;
  clubBenefit: KisanClubBenefitEvaluation | null;
  clubProgrammeEligible: boolean;
}

interface IdempotencyInput {
  scope: string;
  key: string;
  requestHash: string;
  differentRequestMessage: string;
  inProgressMessage: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly financeService: FinanceService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly otpSender: OtpSenderService,
    private readonly kisanClubBenefitService?: KisanClubBenefitService,
    private readonly kisanClubBenefitTokenService?: KisanClubBenefitTokenService,
  ) {}

  async checkoutAssistedToken(
    dto: RedeemKisanClubBenefitTokenDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    if (
      !this.accessService.hasPermission(actor, PermissionCode.KISAN_CLUB_ASSISTED_ORDERS_CREATE)
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Kisan Club assisted-order permission is required',
      });
    }
    const key = this.normalizedIdempotencyKey(idempotencyKey, 'assisted checkout');
    return this.runIdempotent(
      {
        scope: `kisan-club:assisted-checkout:${actor.userId}`,
        key,
        requestHash: this.hashRequest({ actorUserId: actor.userId, dto }),
        differentRequestMessage:
          'Idempotency key was already used for a different assisted checkout request',
        inProgressMessage: 'Assisted checkout request is already in progress',
      },
      async () => {
        if (!this.kisanClubBenefitTokenService) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Kisan Club benefit tokens are unavailable',
          });
        }
        const tokenId = await this.kisanClubBenefitTokenService.authorizeRedemption(
          dto,
          actor,
          requestId,
        );
        return this.createAssistedCheckout(tokenId, dto, actor, requestId);
      },
    );
  }

  async checkoutFromCart(
    dto: CheckoutFromCartDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(actor, PermissionCode.CHECKOUT_CREATE_OWN);
    const key = this.normalizedIdempotencyKey(idempotencyKey);
    const scope = `checkout:from-cart:${actor.userId}`;
    const requestHash = this.hashRequest({
      actorUserId: actor.userId,
      dto,
    });

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: {
          scope,
          key,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Idempotency key was already used for a different checkout request',
        });
      }
      if (existing.status === IdempotencyStatus.COMPLETED) {
        return existing.response;
      }
      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Checkout request is already in progress',
        });
      }

      await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: this.idempotencyInProgressData(requestHash),
      });
    } else {
      try {
        await this.prisma.idempotencyRecord.create({
          data: {
            scope,
            key,
            ...this.idempotencyInProgressData(requestHash),
          },
        });
      } catch (error) {
        this.throwConflictForKnownUniqueError(error, 'Checkout request is already in progress');
        throw error;
      }
    }

    try {
      const result = await this.createCheckoutFromCart(dto, actor, requestId);
      await this.prisma.idempotencyRecord.update({
        where: {
          scope_key: {
            scope,
            key,
          },
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          response: this.toJsonValue(result),
          lockedUntil: null,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.idempotencyRecord.update({
        where: {
          scope_key: {
            scope,
            key,
          },
        },
        data: {
          status: IdempotencyStatus.FAILED,
          lockedUntil: null,
        },
      });
      throw error;
    }
  }

  async getMyCheckout(checkoutId: string, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.CHECKOUT_READ_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const checkout = await this.findCheckoutForProfileOrThrow(this.prisma, checkoutId, profile.id);

    return this.toCheckoutDetail(checkout);
  }

  async listMyOrders(query: ListMyOrdersQueryDto, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.ORDERS_READ_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.ProductOrderWhereInput = {
      farmerProfileId: profile.id,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.productOrder.findMany({
        where,
        include: productOrderDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productOrder.count({ where }),
    ]);

    return {
      items: orders.map((order) => this.toOrderDetail(order)),
      page,
      limit,
      total,
    };
  }

  async getMyOrder(orderId: string, actor: CurrentUser) {
    this.ensureFarmerPermission(actor, PermissionCode.ORDERS_READ_OWN);
    const profile = await this.findProfileForActorOrThrow(actor);
    const order = await this.findOrderForProfileOrThrow(this.prisma, orderId, profile.id);

    return this.toOrderDetail(order);
  }

  async listFulfilmentOrders(query: ListFulfilmentOrdersQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = await this.fulfilmentOrderWhere(query, actor, 'read');

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.productOrder.findMany({
        where,
        include: productOrderDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productOrder.count({ where }),
    ]);

    return {
      items: orders.map((order) => this.toOrderDetail(order)),
      page,
      limit,
      total,
    };
  }

  async getFulfilmentOrder(orderId: string, actor: CurrentUser) {
    const order = await this.findFulfilmentOrderOrThrow(this.prisma, orderId, actor, 'read');
    return this.toOrderDetail(order);
  }

  async acceptFulfilmentOrder(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionFulfilmentOrder(
      orderId,
      dto,
      actor,
      ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
      'PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR',
      'Distributor accepted the confirmed product order',
      requestId,
    );
  }

  async rejectFulfilmentOrder(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionFulfilmentOrder(
      orderId,
      dto,
      actor,
      ProductOrderStatus.DISTRIBUTOR_REJECTED,
      'PRODUCT_ORDER_REJECTED_BY_DISTRIBUTOR',
      'Distributor rejected the confirmed product order',
      requestId,
      true,
    );
  }

  async markFulfilmentOrderReadyToPack(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionFulfilmentOrder(
      orderId,
      dto,
      actor,
      ProductOrderStatus.READY_TO_PACK,
      'PRODUCT_ORDER_READY_TO_PACK',
      'Distributor completed picking and marked the order ready to pack',
      requestId,
    );
  }

  async packFulfilmentOrder(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.transitionFulfilmentOrder(
      orderId,
      dto,
      actor,
      ProductOrderStatus.PACKED,
      'PRODUCT_ORDER_PACKED',
      'Distributor packed the product order',
      requestId,
    );
  }

  async generateFulfilmentOrderInvoice(
    orderId: string,
    dto: GenerateProductInvoiceDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.invoiceGenerationReason(dto);

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findFulfilmentOrderOrThrow(tx, orderId, actor, 'manage');
        if (order.invoice) {
          return this.toOrderDetail(order);
        }
        this.ensureInvoiceGenerationAllowed(order);

        const seller = await this.ensureActiveDistributorOrganisation(
          tx,
          order.sellerOrganisationId,
        );
        const farmer = await this.findFarmerProfileByIdOrThrow(tx, order.farmerProfileId);
        const sellerStateCode = this.verifiedSellerStateCode(seller);
        const sellerAddressSnapshot = await this.invoiceSellerAddress(tx, seller.id);
        const placeOfSupplyStateCode = this.invoicePlaceOfSupplyStateCode(order);
        const tax = this.invoiceTaxCalculation(order, sellerStateCode, placeOfSupplyStateCode);
        const generatedAt = new Date();
        const financialYear = indianFinancialYear(generatedAt);
        const sequenceNumber = await this.nextInvoiceSequence(tx, seller.id, financialYear);
        let invoice: ProductInvoice;
        try {
          invoice = await tx.productInvoice.create({
            data: {
              productOrderId: order.id,
              checkoutId: order.checkoutId,
              farmerProfileId: order.farmerProfileId,
              sellerOrganisationId: order.sellerOrganisationId,
              invoiceNumber: this.formatInvoiceNumber(seller.id, financialYear, sequenceNumber),
              status: ProductInvoiceStatus.GENERATED,
              currency: 'INR',
              subtotalPaise: order.subtotalPaise,
              taxableAmountPaise: tax.taxableAmountPaise,
              taxPaise: tax.taxPaise,
              cgstPaise: tax.cgstPaise,
              sgstPaise: tax.sgstPaise,
              igstPaise: tax.igstPaise,
              totalPaise: tax.totalPaise,
              itemCount: order.itemCount,
              sellerLegalNameSnapshot: seller.legalName,
              sellerDisplayNameSnapshot: seller.displayName,
              sellerGstinSnapshot: seller.gstin,
              sellerStateCodeSnapshot: sellerStateCode,
              sellerAddressSnapshot,
              placeOfSupplyStateCode,
              financialYear,
              sequenceNumber,
              farmerNameSnapshot: farmer.fullName,
              deliveryAddressSnapshot: this.toJsonValue(order.deliveryAddressSnapshot),
              lineItemsSnapshot: this.invoiceLineItemsSnapshot(order, tax.lines),
              generatedByUserId: actor.userId,
              generatedByRole: actor.role,
              generatedAt,
            },
          });
        } catch (error) {
          this.throwConflictForKnownUniqueError(
            error,
            'Product invoice has already been generated for this order',
          );
          throw error;
        }

        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_INVOICE_GENERATED',
            resourceType: 'ProductInvoice',
            resourceId: invoice.id,
            organisationId: invoice.sellerOrganisationId,
            newValue: this.productInvoiceAuditValue(invoice),
            requestId,
            reason,
          }),
          tx,
        );

        await this.notificationEventsService.emitOrderEvent(tx, {
          event: FarmerOrderNotificationEvent.INVOICE_GENERATED,
          farmerProfileId: order.farmerProfileId,
          productOrderId: order.id,
          orderNumber: order.orderNumber,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
          invoiceId: invoice.id,
        });

        const savedOrder = await this.findFulfilmentOrderOrThrow(tx, order.id, actor, 'read');
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async markFulfilmentOrderReadyForPickup(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.fulfilmentDecisionReason(
      dto,
      'Product order marked ready for pickup after invoice generation',
      false,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findFulfilmentOrderOrThrow(tx, orderId, actor, 'manage');
        if (order.dispatch) {
          return this.toOrderDetail(order);
        }
        const invoice = this.ensureReadyForPickupAllowed(order);

        let dispatch: ProductDispatch;
        try {
          dispatch = await tx.productDispatch.create({
            data: {
              productOrderId: order.id,
              checkoutId: order.checkoutId,
              invoiceId: invoice.id,
              farmerProfileId: order.farmerProfileId,
              sellerOrganisationId: order.sellerOrganisationId,
              dispatchNumber: this.generateDispatchNumber(),
              status: ProductDispatchStatus.READY_FOR_PICKUP,
              serviceablePincode: order.serviceablePincode,
              invoiceNumberSnapshot: invoice.invoiceNumber,
              sellerNameSnapshot: order.sellerNameSnapshot,
              sellerGstinSnapshot: order.sellerGstinSnapshot,
              deliveryAddressSnapshot: this.toJsonValue(order.deliveryAddressSnapshot),
              warehouseSnapshot: this.dispatchWarehouseSnapshot(order),
              itemsSnapshot: this.dispatchItemsSnapshot(order),
              readyForPickupReason: reason,
              readyByUserId: actor.userId,
              readyByRole: actor.role,
            },
          });
        } catch (error) {
          this.throwConflictForKnownUniqueError(
            error,
            'Product dispatch has already been created for this order',
          );
          throw error;
        }

        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: ProductOrderStatus.READY_FOR_PICKUP,
          },
        });
        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus: ProductOrderStatus.READY_FOR_PICKUP,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_ORDER_READY_FOR_PICKUP',
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DISPATCH_CREATED',
            resourceType: 'ProductDispatch',
            resourceId: dispatch.id,
            organisationId: dispatch.sellerOrganisationId,
            newValue: this.productDispatchAuditValue(dispatch),
            requestId,
            reason,
          }),
          tx,
        );

        await this.emitOrderStatusNotification(
          tx,
          order,
          FarmerOrderNotificationEvent.ORDER_READY_FOR_PICKUP,
          actor,
          requestId,
        );

        const savedOrder = await this.findFulfilmentOrderOrThrow(tx, order.id, actor, 'read');
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async assignFulfilmentOrderDelivery(
    orderId: string,
    dto: AssignDeliveryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureDeliveryAssignmentManageAny(actor);
    const reason = this.fulfilmentDecisionReason(
      dto,
      'Delivery partner assigned to ready-for-pickup order',
      false,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const dispatch = this.ensureDeliveryAssignmentCanBeCreated(order);
        const deliveryPartner = await this.findActiveDeliveryPartnerOrThrow(
          tx,
          dto.deliveryPartnerUserId,
        );
        const otp = this.generateDeliveryOtp();

        let assignment: ProductDeliveryAssignment;
        try {
          assignment = await tx.productDeliveryAssignment.create({
            data: {
              productOrderId: order.id,
              checkoutId: order.checkoutId,
              dispatchId: dispatch.id,
              farmerProfileId: order.farmerProfileId,
              sellerOrganisationId: order.sellerOrganisationId,
              deliveryPartnerUserId: deliveryPartner.id,
              assignmentNumber: this.generateDeliveryAssignmentNumber(),
              status: ProductDeliveryAssignmentStatus.ASSIGNED,
              serviceablePincode: order.serviceablePincode,
              dispatchNumberSnapshot: dispatch.dispatchNumber,
              invoiceNumberSnapshot: dispatch.invoiceNumberSnapshot,
              sellerNameSnapshot: order.sellerNameSnapshot,
              sellerGstinSnapshot: order.sellerGstinSnapshot,
              deliveryAddressSnapshot: this.toJsonValue(order.deliveryAddressSnapshot),
              pickupSnapshot: this.toJsonValue(dispatch.warehouseSnapshot),
              itemsSnapshot: this.toJsonValue(dispatch.itemsSnapshot),
              otpHash: otp.hash,
              otpSalt: otp.salt,
              otpExpiresAt: this.hoursFromNow(DELIVERY_OTP_EXPIRY_HOURS),
              assignedByUserId: actor.userId,
              assignedByRole: actor.role,
            },
          });
        } catch (error) {
          this.throwConflictForKnownUniqueError(
            error,
            'Product delivery assignment has already been created for this order',
          );
          throw error;
        }

        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_ASSIGNED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: assignment.id,
            organisationId: assignment.sellerOrganisationId,
            newValue: this.productDeliveryAssignmentAuditValue(assignment),
            requestId,
            reason,
          }),
          tx,
        );

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder, this.mockDeliveryOtp(otp.code));
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async issueDispatchPackageLabel(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.fulfilmentDecisionReason(
      dto,
      'Package QR label issued for pickup verification',
      false,
    );
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findFulfilmentOrderOrThrow(tx, orderId, actor, 'manage');
        const dispatch = this.ensureDispatchLabelCanBeIssued(order);
        const packageQrCode = `VARDHNAM-PICKUP:${dispatch.id}:${randomUUID()}`;
        const updatedDispatch = await tx.productDispatch.update({
          where: { id: dispatch.id },
          data: {
            packageQrHash: this.hashPackageQrCode(packageQrCode),
            packageQrIssuedAt: new Date(),
            packageQrIssuedByUserId: actor.userId,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: dispatch.packageQrIssuedAt
              ? 'PRODUCT_DISPATCH_PACKAGE_QR_REISSUED'
              : 'PRODUCT_DISPATCH_PACKAGE_QR_ISSUED',
            resourceType: 'ProductDispatch',
            resourceId: updatedDispatch.id,
            organisationId: updatedDispatch.sellerOrganisationId,
            previousValue: this.productDispatchAuditValue(dispatch),
            newValue: this.productDispatchAuditValue(updatedDispatch),
            requestId,
            reason,
          }),
          tx,
        );
        return {
          dispatch: this.toDispatchDetail(updatedDispatch),
          packageQrCode,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async markFulfilmentOrderOutForDelivery(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.fulfilmentDecisionReason(
      dto,
      'Delivery partner picked up the order for delivery',
      false,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        this.ensureOutForDeliveryAllowed(order);

        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            status: ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
            startedByUserId: actor.userId,
            startedByRole: actor.role,
            startedAt: new Date(),
          },
        });
        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: ProductOrderStatus.OUT_FOR_DELIVERY,
          },
        });

        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus: ProductOrderStatus.OUT_FOR_DELIVERY,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_ORDER_OUT_FOR_DELIVERY',
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_OUT_FOR_DELIVERY',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );

        await this.emitOrderStatusNotification(
          tx,
          order,
          FarmerOrderNotificationEvent.ORDER_OUT_FOR_DELIVERY,
          actor,
          requestId,
        );

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async verifyDeliveryPackagePickup(
    orderId: string,
    dto: VerifyPackagePickupDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        const dispatch = this.ensurePackagePickupCanBeVerified(order);
        if (this.hashPackageQrCode(dto.packageQrCode.trim()) !== dispatch.packageQrHash) {
          await this.recordFailedPackagePickupVerification(assignment, actor, requestId);
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Package QR code is invalid',
          });
        }
        const verifiedAt = new Date();
        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            pickupVerifiedAt: verifiedAt,
            pickupVerifiedByUserId: actor.userId,
            pickupVerifiedByRole: actor.role,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_PACKAGE_PICKUP_VERIFIED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason: 'Package QR verified at pickup',
          }),
          tx,
        );
        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async acceptDeliveryAssignment(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.fulfilmentDecisionReason(
      dto,
      'Delivery assignment accepted by delivery partner',
      false,
    );
    return this.respondToDeliveryAssignment(orderId, actor, true, reason, requestId);
  }

  async rejectDeliveryAssignment(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = this.deliveryAssignmentRejectionReason(dto);
    return this.respondToDeliveryAssignment(orderId, actor, false, reason, requestId);
  }

  async reassignDeliveryAssignment(
    orderId: string,
    dto: AssignDeliveryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureDeliveryAssignmentManageAny(actor);
    const reason = this.deliveryAssignmentReassignmentReason(dto);

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.ensureDeliveryReassignmentAllowed(order);
        if (assignment.deliveryPartnerUserId === dto.deliveryPartnerUserId) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Rejected delivery must be reassigned to a different delivery partner',
          });
        }
        const deliveryPartner = await this.findActiveDeliveryPartnerOrThrow(
          tx,
          dto.deliveryPartnerUserId,
        );
        const otp = this.generateDeliveryOtp();
        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            deliveryPartnerUserId: deliveryPartner.id,
            status: ProductDeliveryAssignmentStatus.ASSIGNED,
            otpHash: otp.hash,
            otpSalt: otp.salt,
            otpExpiresAt: this.hoursFromNow(DELIVERY_OTP_EXPIRY_HOURS),
            otpAttemptCount: 0,
            otpVerifiedAt: null,
            pickupVerificationAttemptCount: 0,
            pickupVerifiedAt: null,
            pickupVerifiedByUserId: null,
            pickupVerifiedByRole: null,
            assignedByUserId: actor.userId,
            assignedByRole: actor.role,
            assignedAt: new Date(),
            startedByUserId: null,
            startedByRole: null,
            startedAt: null,
            completedByUserId: null,
            completedByRole: null,
            completedAt: null,
            deliveryProofNote: null,
            proofLocationStatus: null,
            proofLatitude: null,
            proofLongitude: null,
            proofAccuracyMetres: null,
            proofLocationCapturedAt: null,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_REASSIGNED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );
        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder, this.mockDeliveryOtp(otp.code));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async respondToDeliveryAssignment(
    orderId: string,
    actor: CurrentUser,
    accepted: boolean,
    reason: string,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        this.ensureDeliveryAssignmentResponseAllowed(order);
        const status = accepted
          ? ProductDeliveryAssignmentStatus.ACCEPTED
          : ProductDeliveryAssignmentStatus.REJECTED;
        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: { status },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: accepted
              ? 'PRODUCT_DELIVERY_ASSIGNMENT_ACCEPTED'
              : 'PRODUCT_DELIVERY_ASSIGNMENT_REJECTED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );
        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async completeFulfilmentOrderDelivery(
    orderId: string,
    dto: CompleteDeliveryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = dto.proofNote?.trim() || 'Delivery completed after OTP verification';
    const locationProof = this.validateDeliveryLocationProof(dto);

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        this.ensureDeliveryCompletionAllowed(order);
        await this.verifyDeliveryOtpOrThrow(assignment, dto.otpCode, actor, requestId);

        const completedAt = new Date();
        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            status: ProductDeliveryAssignmentStatus.DELIVERED,
            otpVerifiedAt: completedAt,
            completedByUserId: actor.userId,
            completedByRole: actor.role,
            completedAt,
            deliveryProofNote: reason,
            proofLocationStatus: dto.proofLocationStatus,
            proofLatitude: locationProof?.latitude ?? null,
            proofLongitude: locationProof?.longitude ?? null,
            proofAccuracyMetres: locationProof?.accuracyMetres ?? null,
            proofLocationCapturedAt: locationProof?.capturedAt ?? null,
          },
        });
        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: ProductOrderStatus.DELIVERED,
          },
        });

        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus: ProductOrderStatus.DELIVERED,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_ORDER_DELIVERED',
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_DELIVERED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );

        await this.financeService.recordDeliveryCommission(
          tx,
          updatedOrder,
          updatedAssignment.deliveryPartnerUserId,
          actor,
          requestId,
        );

        await this.emitOrderStatusNotification(
          tx,
          order,
          FarmerOrderNotificationEvent.ORDER_DELIVERED,
          actor,
          requestId,
        );

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async reportDeliveryFailure(
    orderId: string,
    dto: ReportDeliveryFailureDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const retryScheduledAt = this.validateDeliveryRetryTime(dto.retryAt);
    const note = dto.note?.trim() || null;
    const reason = this.deliveryFailureReason(dto.reasonCode, note);

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        this.ensureDeliveryFailureAllowed(order);
        const failedAt = new Date();

        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            status: ProductDeliveryAssignmentStatus.DELIVERY_FAILED,
            failureAttemptCount: { increment: 1 },
            lastFailureReasonCode: dto.reasonCode,
            lastFailureNote: note,
            lastFailedAt: failedAt,
            lastFailedByUserId: actor.userId,
            lastFailedByRole: actor.role,
            retryScheduledAt,
          },
        });
        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: { status: ProductOrderStatus.DELIVERY_FAILED },
        });

        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus: ProductOrderStatus.DELIVERY_FAILED,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_ORDER_DELIVERY_FAILED',
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_FAILED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );

        return this.toOrderDetail(await this.findProductOrderDetailOrThrow(tx, updatedOrder.id));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async retryDelivery(
    orderId: string,
    dto: RetryDeliveryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = dto.reason?.trim() || 'Scheduled delivery retry started';
    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.requireDeliveryAssignment(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
        this.ensureDeliveryRetryAllowed(order, new Date());
        const otp = this.generateDeliveryOtp();
        const startedAt = new Date();

        const updatedAssignment = await tx.productDeliveryAssignment.update({
          where: { id: assignment.id },
          data: {
            status: ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
            otpHash: otp.hash,
            otpSalt: otp.salt,
            otpExpiresAt: this.hoursFromNow(DELIVERY_OTP_EXPIRY_HOURS),
            otpAttemptCount: 0,
            otpVerifiedAt: null,
            startedByUserId: actor.userId,
            startedByRole: actor.role,
            startedAt,
          },
        });
        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: { status: ProductOrderStatus.OUT_FOR_DELIVERY },
        });

        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus: ProductOrderStatus.OUT_FOR_DELIVERY,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_ORDER_DELIVERY_RETRIED',
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_DELIVERY_RETRIED',
            resourceType: 'ProductDeliveryAssignment',
            resourceId: updatedAssignment.id,
            organisationId: updatedAssignment.sellerOrganisationId,
            previousValue: this.productDeliveryAssignmentAuditValue(assignment),
            newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
            requestId,
            reason,
          }),
          tx,
        );

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, updatedOrder.id);
        return this.toOrderDetail(savedOrder, this.mockDeliveryOtp(otp.code));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancelMyCheckout(
    checkoutId: string,
    dto: CancelOrderDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(actor, PermissionCode.CHECKOUT_CANCEL_OWN);
    const key = this.normalizedIdempotencyKey(idempotencyKey, 'checkout cancellation');

    return this.runIdempotent(
      {
        scope: `checkout:cancel:${actor.userId}:${checkoutId}`,
        key,
        requestHash: this.hashRequest({ actorUserId: actor.userId, checkoutId, dto }),
        differentRequestMessage:
          'Idempotency key was already used for a different checkout cancellation request',
        inProgressMessage: 'Checkout cancellation request is already in progress',
      },
      () => this.cancelCheckoutInTransaction(checkoutId, dto, actor, requestId),
    );
  }

  async cancelMyOrder(
    orderId: string,
    dto: CancelOrderDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(actor, PermissionCode.ORDERS_CANCEL_OWN);
    const key = this.normalizedIdempotencyKey(idempotencyKey, 'order cancellation');

    return this.runIdempotent(
      {
        scope: `orders:cancel:${actor.userId}:${orderId}`,
        key,
        requestHash: this.hashRequest({ actorUserId: actor.userId, orderId, dto }),
        differentRequestMessage:
          'Idempotency key was already used for a different order cancellation request',
        inProgressMessage: 'Order cancellation request is already in progress',
      },
      () => this.cancelOrderInTransaction(orderId, dto, actor, requestId),
    );
  }

  private async createCheckoutFromCart(
    dto: CheckoutFromCartDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await this.findProfileForActorOrThrow(actor, tx);
        const cart = await this.findActiveCartForProfileOrThrow(tx, profile.id);
        if (cart.items.length === 0) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Cart must contain at least one item before checkout',
          });
        }
        const result = await this.createCheckoutFromResolvedCart(
          tx,
          dto,
          actor,
          profile,
          cart,
          requestId,
        );
        return result.detail;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async createAssistedCheckout(
    tokenId: string,
    dto: RedeemKisanClubBenefitTokenDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (!this.kisanClubBenefitTokenService) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Kisan Club benefit tokens are unavailable',
      });
    }
    return this.prisma.$transaction(
      async (tx) => {
        const token = await this.kisanClubBenefitTokenService!.findRedeemable(tx, tokenId, actor);
        const profile = token.membership.farmerProfile;
        const address = await tx.farmerAddress.findFirst({
          where: {
            farmerProfileId: profile.id,
            ...(dto.farmerAddressId ? { id: dto.farmerAddressId } : {}),
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
        if (!address) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'A farmer delivery address is required for assisted checkout',
          });
        }

        const existingCart = await tx.cart.findUnique({
          where: { farmerProfileId: profile.id },
          include: checkoutCartInclude,
        });
        if (existingCart && existingCart.items.length > 0) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message:
              'The farmer cart must be empty before an assisted order can be created; existing farmer selections were preserved',
          });
        }
        const cart = existingCart
          ? await tx.cart.update({
              where: { id: existingCart.id },
              data: {
                status: CartStatus.ACTIVE,
                deliveryAddressId: address.id,
                serviceablePincode: address.pincode,
                kisanClubContext: true,
              },
              include: checkoutCartInclude,
            })
          : await tx.cart.create({
              data: {
                farmerProfileId: profile.id,
                status: CartStatus.ACTIVE,
                deliveryAddressId: address.id,
                serviceablePincode: address.pincode,
                kisanClubContext: true,
              },
              include: checkoutCartInclude,
            });

        const offer = await this.findOfferOrThrow(tx, token.offerId);
        const availableQuantity = await this.validateOfferForCheckout(
          tx,
          offer,
          address.pincode,
          token.quantity,
        );
        if (availableQuantity < token.quantity) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'Requested quantity exceeds backend-derived sellable availability',
          });
        }
        const stagedItem = await tx.cartItem.create({
          data: {
            cartId: cart.id,
            offerId: offer.id,
            distributorOrganisationId: offer.distributorOrganisationId,
            productId: offer.productId,
            variantId: offer.variantId,
            warehouseId: offer.warehouseId,
            batchId: offer.batchId,
            quantity: token.quantity,
            priceSnapshotPaise: offer.sellingPricePaise,
            clubBenefitSnapshotPaise: 0,
            availableQuantitySnapshot: availableQuantity,
            serviceablePincodeSnapshot: address.pincode,
            productNameSnapshot: offer.product.name,
            variantNameSnapshot: offer.variant.variantName,
            sellerNameSnapshot: offer.distributorOrganisation.displayName,
            warehouseNameSnapshot: offer.warehouse.name,
            fulfilmentModeSnapshot: offer.fulfilmentMode,
            deliverySlaDaysSnapshot: offer.deliverySlaDays,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'KISAN_CLUB_ASSISTED_CART_STAGED',
            resourceType: 'CartItem',
            resourceId: stagedItem.id,
            newValue: {
              cartId: stagedItem.cartId,
              offerId: stagedItem.offerId,
              farmerProfileId: profile.id,
              quantity: stagedItem.quantity,
              priceSnapshotPaise: stagedItem.priceSnapshotPaise,
              serviceablePincodeSnapshot: stagedItem.serviceablePincodeSnapshot,
            },
            requestId,
            reason: `Assisted purchase using benefit token ${token.tokenReference}`,
          }),
          tx,
        );
        const populatedCart = await this.findActiveCartForProfileOrThrow(tx, profile.id);
        const result = await this.createCheckoutFromResolvedCart(
          tx,
          {
            farmerAddressId: address.id,
            reason:
              dto.reason?.trim() ||
              `Promoter assisted purchase using benefit token ${token.tokenReference}`,
          },
          actor,
          profile,
          populatedCart,
          requestId,
          token.id,
        );
        const order = result.createdOrders[0];
        if (!order || result.createdOrders.length !== 1 || order.clubBenefitPaise <= 0) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'The live Kisan Club benefit is no longer available; issue a new token',
          });
        }
        await this.kisanClubBenefitTokenService!.consume(tx, token.id, order.id, actor, requestId);
        return {
          ...result.detail,
          assistedPurchase: {
            benefitTokenId: token.id,
            productOrderId: order.id,
            paymentRequiredInApp: true,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createCheckoutFromResolvedCart(
    tx: Prisma.TransactionClient,
    dto: CheckoutFromCartDto,
    actor: CurrentUser,
    profile: FarmerProfile,
    cart: CheckoutCart,
    requestId?: string,
    benefitTokenId?: string,
  ) {
    const deliveryAddress = await this.resolveCheckoutAddress(tx, dto, profile, cart);
    const pincode = deliveryAddress.pincode;
    this.ensureCartPincodeMatchesAddress(cart, pincode);

    const preparedItems = await this.prepareCartItemsForCheckout(tx, cart, pincode, profile.id);
    const itemsBySeller = this.groupItemsBySeller(preparedItems);
    const subtotalPaise = preparedItems.reduce((total, item) => total + item.lineTotalPaise, 0);
    const clubBenefitPaise = preparedItems.reduce(
      (total, item) => total + (item.clubBenefit?.totalBenefitPaise ?? 0),
      0,
    );

    const checkout = await tx.productCheckout.create({
      data: {
        farmerProfileId: profile.id,
        sourceCartId: cart.id,
        deliveryAddressId: deliveryAddress.id,
        serviceablePincode: pincode,
        status: ProductCheckoutStatus.PENDING_PAYMENT,
        subtotalPaise,
        clubBenefitPaise,
        farmerPayablePaise: subtotalPaise - clubBenefitPaise,
        itemCount: preparedItems.length,
        childOrderCount: itemsBySeller.size,
      },
    });

    await this.auditService.record(
      this.withActor(actor, {
        action: 'PRODUCT_CHECKOUT_CREATED',
        resourceType: 'ProductCheckout',
        resourceId: checkout.id,
        newValue: this.checkoutAuditValue(checkout),
        requestId,
        reason: dto.reason,
      }),
      tx,
    );

    const createdOrders: ProductOrder[] = [];
    for (const sellerItems of itemsBySeller.values()) {
      createdOrders.push(
        await this.createChildOrderWithReservations(tx, {
          actor,
          checkoutId: checkout.id,
          farmerProfileId: profile.id,
          deliveryAddress,
          items: sellerItems,
          requestId,
          reason: dto.reason,
          benefitTokenId,
        }),
      );
    }

    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    const clearedCart = await tx.cart.update({
      where: { id: cart.id },
      data: {
        deliveryAddressId: null,
        serviceablePincode: null,
        kisanClubContext: false,
      },
      include: checkoutCartInclude,
    });
    await this.auditService.record(
      this.withActor(actor, {
        action: 'CART_CHECKED_OUT',
        resourceType: 'Cart',
        resourceId: cart.id,
        previousValue: this.cartAuditValue(cart),
        newValue: this.cartAuditValue(clearedCart),
        requestId,
        reason: dto.reason,
      }),
      tx,
    );

    const savedCheckout = await this.findCheckoutForProfileOrThrow(tx, checkout.id, profile.id);
    return { detail: this.toCheckoutDetail(savedCheckout), createdOrders };
  }

  private async cancelCheckoutInTransaction(
    checkoutId: string,
    dto: CancelOrderDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await this.findProfileForActorOrThrow(actor, tx);
        const checkout = await this.findCheckoutForProfileOrThrow(tx, checkoutId, profile.id);
        this.ensureCheckoutCanBeCancelled(checkout);

        const reason = this.cancellationReason(
          dto,
          'Farmer cancelled checkout before successful payment',
        );
        for (const order of checkout.orders) {
          if (order.status === ProductOrderStatus.CANCELLED) {
            continue;
          }
          await this.cancelOrderRecord(tx, {
            order,
            actor,
            requestId,
            reason,
          });
        }

        const updatedCheckout = await tx.productCheckout.update({
          where: { id: checkout.id },
          data: {
            status: ProductCheckoutStatus.CANCELLED,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_CHECKOUT_CANCELLED_BY_FARMER',
            resourceType: 'ProductCheckout',
            resourceId: updatedCheckout.id,
            previousValue: this.checkoutAuditValue(checkout),
            newValue: this.checkoutAuditValue(updatedCheckout),
            requestId,
            reason,
          }),
          tx,
        );

        const savedCheckout = await this.findCheckoutForProfileOrThrow(tx, checkout.id, profile.id);
        return this.toCheckoutDetail(savedCheckout);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async cancelOrderInTransaction(
    orderId: string,
    dto: CancelOrderDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await this.findProfileForActorOrThrow(actor, tx);
        const order = await this.findOrderForProfileOrThrow(tx, orderId, profile.id);
        const checkout = await this.findCheckoutForProfileOrThrow(tx, order.checkoutId, profile.id);
        const checkoutOrder = checkout.orders.find((item) => item.id === order.id) ?? order;
        this.ensureCheckoutAllowsOrderCancellation(checkout);
        this.ensureOrderCanBeCancelled(checkoutOrder);

        const reason = this.cancellationReason(
          dto,
          'Farmer cancelled order before successful payment',
        );
        await this.cancelOrderRecord(tx, {
          order: checkoutOrder,
          actor,
          requestId,
          reason,
        });

        const allOrdersCancelled = checkout.orders.every((item) =>
          item.id === order.id ? true : item.status === ProductOrderStatus.CANCELLED,
        );
        if (allOrdersCancelled) {
          const updatedCheckout = await tx.productCheckout.update({
            where: { id: checkout.id },
            data: {
              status: ProductCheckoutStatus.CANCELLED,
            },
          });
          await this.auditService.record(
            this.withActor(actor, {
              action: 'PRODUCT_CHECKOUT_CANCELLED_BY_FARMER',
              resourceType: 'ProductCheckout',
              resourceId: updatedCheckout.id,
              previousValue: this.checkoutAuditValue(checkout),
              newValue: this.checkoutAuditValue(updatedCheckout),
              requestId,
              reason,
            }),
            tx,
          );
        }

        const savedOrder = await this.findOrderForProfileOrThrow(tx, order.id, profile.id);
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async cancelOrderRecord(
    tx: Prisma.TransactionClient,
    input: {
      order: ProductOrderWithDetails;
      actor: CurrentUser;
      requestId?: string | undefined;
      reason: string;
    },
  ): Promise<void> {
    await this.releaseReservationsForOrder(tx, input);

    const updatedOrder = await tx.productOrder.update({
      where: { id: input.order.id },
      data: {
        status: ProductOrderStatus.CANCELLED,
      },
    });
    await this.recordStatusHistory(tx, {
      order: updatedOrder,
      actor: input.actor,
      fromStatus: input.order.status,
      toStatus: ProductOrderStatus.CANCELLED,
      requestId: input.requestId,
      reason: input.reason,
    });
    await this.auditService.record(
      this.withActor(input.actor, {
        action: 'PRODUCT_ORDER_CANCELLED_BY_FARMER',
        resourceType: 'ProductOrder',
        resourceId: updatedOrder.id,
        organisationId: updatedOrder.sellerOrganisationId,
        previousValue: this.productOrderAuditValue(input.order),
        newValue: this.productOrderAuditValue(updatedOrder),
        requestId: input.requestId,
        reason: input.reason,
      }),
      tx,
    );
    await this.emitOrderStatusNotification(
      tx,
      input.order,
      FarmerOrderNotificationEvent.ORDER_CANCELLED,
      input.actor,
      input.requestId,
    );
  }

  private async transitionFulfilmentOrder(
    orderId: string,
    dto: FulfilmentOrderDecisionDto,
    actor: CurrentUser,
    toStatus: ProductOrderStatus,
    auditAction: string,
    fallbackReason: string,
    requestId?: string,
    requireReason = false,
  ) {
    const reason = this.fulfilmentDecisionReason(dto, fallbackReason, requireReason);

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findFulfilmentOrderOrThrow(tx, orderId, actor, 'manage');
        this.ensureFulfilmentTransitionAllowed(order, toStatus);

        const updatedOrder = await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: toStatus,
          },
        });
        await this.recordStatusHistory(tx, {
          order: updatedOrder,
          actor,
          fromStatus: order.status,
          toStatus,
          requestId,
          reason,
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: auditAction,
            resourceType: 'ProductOrder',
            resourceId: updatedOrder.id,
            organisationId: updatedOrder.sellerOrganisationId,
            previousValue: this.productOrderAuditValue(order),
            newValue: this.productOrderAuditValue(updatedOrder),
            requestId,
            reason,
          }),
          tx,
        );

        const notificationEvent = this.fulfilmentNotificationEvent(toStatus);
        if (notificationEvent) {
          await this.emitOrderStatusNotification(tx, order, notificationEvent, actor, requestId);
        }

        const savedOrder = await this.findFulfilmentOrderOrThrow(
          tx,
          updatedOrder.id,
          actor,
          'read',
        );
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private fulfilmentNotificationEvent(
    status: ProductOrderStatus,
  ): FarmerOrderNotificationEvent | null {
    if (status === ProductOrderStatus.DISTRIBUTOR_ACCEPTED) {
      return FarmerOrderNotificationEvent.ORDER_ACCEPTED;
    }
    if (status === ProductOrderStatus.DISTRIBUTOR_REJECTED) {
      return FarmerOrderNotificationEvent.ORDER_REJECTED;
    }
    if (status === ProductOrderStatus.PACKED) {
      return FarmerOrderNotificationEvent.ORDER_PACKED;
    }
    return null;
  }

  private async emitOrderStatusNotification(
    tx: Prisma.TransactionClient,
    order: ProductOrder,
    event: FarmerOrderNotificationEvent,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    await this.notificationEventsService.emitOrderEvent(tx, {
      event,
      farmerProfileId: order.farmerProfileId,
      productOrderId: order.id,
      orderNumber: order.orderNumber,
      actorUserId: actor.userId,
      actorRole: actor.role,
      requestId,
    });
  }

  private async fulfilmentOrderWhere(
    query: ListFulfilmentOrdersQueryDto,
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
  ): Promise<Prisma.ProductOrderWhereInput> {
    const deliveryPartnerOwnRead =
      accessMode === 'read' &&
      this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_READ_OWN) &&
      !this.accessService.hasPermission(actor, PermissionCode.FULFILMENT_ORDERS_READ_ANY) &&
      !this.accessService.hasPermission(actor, PermissionCode.FULFILMENT_ORDERS_READ_OWN);
    if (deliveryPartnerOwnRead && query.sellerOrganisationId) {
      throw this.forbidden('Delivery partners cannot browse a distributor fulfilment queue');
    }
    const sellerOrganisationId = await this.resolveFulfilmentSellerOrganisationId(
      actor,
      accessMode,
      query.sellerOrganisationId,
    );
    const where: Prisma.ProductOrderWhereInput = {
      orderType: OrderType.PRODUCT_ORDER,
      ...(sellerOrganisationId ? { sellerOrganisationId } : {}),
      ...(deliveryPartnerOwnRead
        ? { deliveryAssignment: { is: { deliveryPartnerUserId: actor.userId } } }
        : {}),
    };

    if (query.status) {
      where.status = query.status;
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { serviceablePincode: { contains: q, mode: 'insensitive' } },
        { sellerNameSnapshot: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async findFulfilmentOrderOrThrow(
    client: CheckoutClient,
    orderId: string,
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
  ): Promise<ProductOrderWithDetails> {
    const order = await client.productOrder.findFirst({
      where: {
        id: orderId,
        orderType: OrderType.PRODUCT_ORDER,
      },
      include: productOrderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Fulfilment order was not found',
      });
    }

    await this.ensureFulfilmentOrderAccess(
      client,
      actor,
      accessMode,
      order.id,
      order.sellerOrganisationId,
    );
    return order;
  }

  private async findProductOrderDetailOrThrow(
    client: CheckoutClient,
    orderId: string,
  ): Promise<ProductOrderWithDetails> {
    const order = await client.productOrder.findFirst({
      where: {
        id: orderId,
        orderType: OrderType.PRODUCT_ORDER,
      },
      include: productOrderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product order was not found',
      });
    }

    return order;
  }

  private async resolveFulfilmentSellerOrganisationId(
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
    requestedOrganisationId?: string,
  ): Promise<string | undefined> {
    const anyPermission =
      accessMode === 'read'
        ? PermissionCode.FULFILMENT_ORDERS_READ_ANY
        : PermissionCode.FULFILMENT_ORDERS_MANAGE_ANY;
    const ownPermission =
      accessMode === 'read'
        ? PermissionCode.FULFILMENT_ORDERS_READ_OWN
        : PermissionCode.FULFILMENT_ORDERS_MANAGE_OWN;

    if (this.accessService.hasPermission(actor, anyPermission)) {
      if (requestedOrganisationId) {
        await this.ensureActiveDistributorOrganisation(this.prisma, requestedOrganisationId);
      }
      return requestedOrganisationId;
    }

    if (
      accessMode === 'read' &&
      this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_READ_OWN)
    ) {
      return undefined;
    }

    if (!this.accessService.hasPermission(actor, ownPermission)) {
      throw this.forbidden('Fulfilment order permission is required');
    }

    if (requestedOrganisationId && requestedOrganisationId !== actor.organisationId) {
      throw this.forbidden(
        'Users may only access fulfilment orders for their active distributor context',
      );
    }

    await this.ensureActiveDistributorOrganisation(this.prisma, actor.organisationId);
    return actor.organisationId;
  }

  private async ensureFulfilmentOrderAccess(
    client: CheckoutClient,
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
    productOrderId: string,
    sellerOrganisationId: string,
  ): Promise<void> {
    const anyPermission =
      accessMode === 'read'
        ? PermissionCode.FULFILMENT_ORDERS_READ_ANY
        : PermissionCode.FULFILMENT_ORDERS_MANAGE_ANY;
    const ownPermission =
      accessMode === 'read'
        ? PermissionCode.FULFILMENT_ORDERS_READ_OWN
        : PermissionCode.FULFILMENT_ORDERS_MANAGE_OWN;

    if (this.accessService.hasPermission(actor, anyPermission)) {
      if (accessMode === 'manage') {
        await this.ensureActiveDistributorOrganisation(client, sellerOrganisationId);
      }
      return;
    }
    if (
      accessMode === 'read' &&
      this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_READ_OWN)
    ) {
      const assignment = await client.productDeliveryAssignment.findUnique({
        where: { productOrderId },
      });
      if (assignment?.deliveryPartnerUserId === actor.userId) return;
    }
    if (
      this.accessService.hasPermission(actor, ownPermission) &&
      actor.organisationId === sellerOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(client, sellerOrganisationId);
      return;
    }

    throw this.forbidden('Fulfilment order permission is required');
  }

  private async ensureActiveDistributorOrganisation(
    client: CheckoutClient,
    distributorOrganisationId: string,
  ): Promise<Organisation> {
    const organisation = await client.organisation.findUnique({
      where: { id: distributorOrganisationId },
    });

    if (!organisation) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Distributor organisation was not found',
      });
    }
    if (organisation.type !== OrganisationType.DISTRIBUTOR) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Fulfilment orders must belong to a distributor organisation',
      });
    }
    if (organisation.status !== OrganisationStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor organisation must be active before fulfilment orders can be managed',
      });
    }

    return organisation;
  }

  private ensureDeliveryAssignmentManageAny(actor: CurrentUser): void {
    if (!this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_MANAGE_ANY)) {
      throw this.forbidden('Delivery assignment manager permission is required');
    }
  }

  private ensureDeliveryAssignmentManageAccess(
    actor: CurrentUser,
    assignment: ProductDeliveryAssignment,
  ): void {
    if (this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_MANAGE_ANY)) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.DELIVERY_ASSIGNMENTS_MANAGE_OWN) &&
      assignment.deliveryPartnerUserId === actor.userId
    ) {
      return;
    }

    throw this.forbidden('Delivery assignment permission is required');
  }

  private async findActiveDeliveryPartnerOrThrow(
    client: CheckoutClient,
    deliveryPartnerUserId: string,
  ) {
    const user = await client.user.findUnique({
      where: { id: deliveryPartnerUserId },
      include: {
        memberships: {
          where: {
            role: PlatformRole.DELIVERY_PARTNER,
            status: MembershipStatus.ACTIVE,
          },
          include: {
            organisation: true,
          },
        },
        deliveryPartnerProfiles: {
          where: {
            availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
          },
        },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery partner user must be active before assignment',
      });
    }
    const activeMembership = user.memberships.find(
      (membership) =>
        membership.organisation.type === OrganisationType.DELIVERY_PARTNER &&
        membership.organisation.status === OrganisationStatus.ACTIVE &&
        user.deliveryPartnerProfiles.some(
          (profile) => profile.organisationId === membership.organisationId,
        ),
    );
    if (!activeMembership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery partner must be online in an active delivery partner context',
      });
    }

    return user;
  }

  private ensureFulfilmentTransitionAllowed(
    order: ProductOrder,
    toStatus: ProductOrderStatus,
  ): void {
    const allowedFromStatus = this.allowedFulfilmentFromStatus(toStatus);
    if (order.status !== allowedFromStatus) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Only ${allowedFromStatus} product orders can transition to ${toStatus}`,
      });
    }
  }

  private allowedFulfilmentFromStatus(toStatus: ProductOrderStatus): ProductOrderStatus {
    if (
      toStatus === ProductOrderStatus.DISTRIBUTOR_ACCEPTED ||
      toStatus === ProductOrderStatus.DISTRIBUTOR_REJECTED
    ) {
      return ProductOrderStatus.CONFIRMED;
    }
    if (toStatus === ProductOrderStatus.READY_TO_PACK) {
      return ProductOrderStatus.DISTRIBUTOR_ACCEPTED;
    }
    if (toStatus === ProductOrderStatus.PACKED) {
      return ProductOrderStatus.READY_TO_PACK;
    }

    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_FAILED,
      message: `Unsupported fulfilment transition target ${toStatus}`,
    });
  }

  private fulfilmentDecisionReason(
    dto: FulfilmentOrderDecisionDto,
    fallback: string,
    required: boolean,
  ): string {
    const reason = dto.reason?.trim();
    if (reason && reason.length > 0) {
      return reason;
    }
    if (required) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A reason is required when rejecting a fulfilment order',
      });
    }
    return fallback;
  }

  private deliveryAssignmentRejectionReason(dto: FulfilmentOrderDecisionDto): string {
    const reason = dto.reason?.trim();
    if (reason) return reason;
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'A reason is required when rejecting a delivery assignment',
    });
  }

  private deliveryAssignmentReassignmentReason(dto: AssignDeliveryDto): string {
    const reason = dto.reason?.trim();
    if (reason) return reason;
    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'A reason is required when reassigning a rejected delivery',
    });
  }

  private invoiceGenerationReason(dto: GenerateProductInvoiceDto): string {
    const reason = dto.reason?.trim();
    return reason && reason.length > 0 ? reason : 'Invoice generated after distributor packing';
  }

  private ensureInvoiceGenerationAllowed(order: ProductOrder): void {
    if (order.status !== ProductOrderStatus.PACKED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only packed product orders can have an invoice generated',
      });
    }
  }

  private ensureReadyForPickupAllowed(order: ProductOrderWithDetails): ProductInvoice {
    if (order.status !== ProductOrderStatus.PACKED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only packed product orders can be marked ready for pickup',
      });
    }
    if (!order.invoice || order.invoice.status !== ProductInvoiceStatus.GENERATED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Generate the product invoice before marking this order ready for pickup',
      });
    }

    return order.invoice;
  }

  private ensureDeliveryAssignmentCanBeCreated(order: ProductOrderWithDetails): ProductDispatch {
    if (order.status !== ProductOrderStatus.READY_FOR_PICKUP) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only ready-for-pickup product orders can be assigned for delivery',
      });
    }
    if (!order.dispatch || order.dispatch.status !== ProductDispatchStatus.READY_FOR_PICKUP) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Create dispatch readiness before assigning delivery',
      });
    }
    if (order.deliveryAssignment) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Product order already has a delivery assignment',
      });
    }

    return order.dispatch;
  }

  private ensureOutForDeliveryAllowed(order: ProductOrderWithDetails): ProductDeliveryAssignment {
    const assignment = this.requireDeliveryAssignment(order);
    if (order.status !== ProductOrderStatus.READY_FOR_PICKUP) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only ready-for-pickup product orders can move out for delivery',
      });
    }
    if (assignment.status !== ProductDeliveryAssignmentStatus.ACCEPTED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Delivery assignment must be accepted before pickup',
      });
    }
    if (!assignment.pickupVerifiedAt) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Verify the package QR before starting delivery',
      });
    }

    return assignment;
  }

  private ensureDispatchLabelCanBeIssued(order: ProductOrderWithDetails): ProductDispatch {
    if (
      order.status !== ProductOrderStatus.READY_FOR_PICKUP ||
      !order.dispatch ||
      order.dispatch.status !== ProductDispatchStatus.READY_FOR_PICKUP
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'A package label can only be issued for a ready-for-pickup dispatch',
      });
    }
    if (order.deliveryAssignment?.pickupVerifiedAt) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Package label cannot be reissued after pickup verification',
      });
    }
    return order.dispatch;
  }

  private ensurePackagePickupCanBeVerified(order: ProductOrderWithDetails): ProductDispatch {
    const assignment = this.requireDeliveryAssignment(order);
    if (
      order.status !== ProductOrderStatus.READY_FOR_PICKUP ||
      assignment.status !== ProductDeliveryAssignmentStatus.ACCEPTED
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only accepted assignments can verify package pickup',
      });
    }
    if (assignment.pickupVerifiedAt) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Package pickup has already been verified',
      });
    }
    if (!order.dispatch?.packageQrHash) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'The seller must issue a package QR label before pickup',
      });
    }
    return order.dispatch;
  }

  private ensureDeliveryAssignmentResponseAllowed(
    order: ProductOrderWithDetails,
  ): ProductDeliveryAssignment {
    const assignment = this.requireDeliveryAssignment(order);
    if (order.status !== ProductOrderStatus.READY_FOR_PICKUP) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Delivery assignments can only be answered before pickup',
      });
    }
    if (assignment.status !== ProductDeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only pending delivery assignments can be accepted or rejected',
      });
    }
    return assignment;
  }

  private ensureDeliveryReassignmentAllowed(
    order: ProductOrderWithDetails,
  ): ProductDeliveryAssignment {
    const assignment = this.requireDeliveryAssignment(order);
    if (
      order.status !== ProductOrderStatus.READY_FOR_PICKUP ||
      assignment.status !== ProductDeliveryAssignmentStatus.REJECTED
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only rejected delivery assignments can be reassigned',
      });
    }
    return assignment;
  }

  private ensureDeliveryCompletionAllowed(
    order: ProductOrderWithDetails,
  ): ProductDeliveryAssignment {
    const assignment = this.requireDeliveryAssignment(order);
    if (order.status !== ProductOrderStatus.OUT_FOR_DELIVERY) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only out-for-delivery product orders can be completed',
      });
    }
    if (assignment.status !== ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only out-for-delivery assignments can be completed',
      });
    }

    return assignment;
  }

  private ensureDeliveryFailureAllowed(order: ProductOrderWithDetails): void {
    const assignment = this.requireDeliveryAssignment(order);
    if (
      order.status !== ProductOrderStatus.OUT_FOR_DELIVERY ||
      assignment.status !== ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only an out-for-delivery assignment can be marked as failed',
      });
    }
  }

  private ensureDeliveryRetryAllowed(order: ProductOrderWithDetails, now: Date): void {
    const assignment = this.requireDeliveryAssignment(order);
    if (
      order.status !== ProductOrderStatus.DELIVERY_FAILED ||
      assignment.status !== ProductDeliveryAssignmentStatus.DELIVERY_FAILED
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only a failed delivery can be retried',
      });
    }
    if (!assignment.retryScheduledAt || assignment.retryScheduledAt.getTime() > now.getTime()) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'The scheduled delivery retry time has not been reached',
      });
    }
  }

  private requireDeliveryAssignment(order: ProductOrderWithDetails): ProductDeliveryAssignment {
    if (!order.deliveryAssignment) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Assign a delivery partner before continuing delivery',
      });
    }

    return order.deliveryAssignment;
  }

  private async releaseReservationsForOrder(
    tx: Prisma.TransactionClient,
    input: {
      order: ProductOrderWithDetails;
      actor: CurrentUser;
      requestId?: string | undefined;
      reason: string;
    },
  ): Promise<void> {
    const existingRelease = await tx.inventoryMovement.findFirst({
      where: {
        movementType: InventoryMovementType.RELEASED_FROM_ORDER,
        referenceType: 'ProductOrderCancellation',
        referenceId: input.order.id,
      },
    });
    if (existingRelease) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Order reservation release has already been recorded',
      });
    }

    const balancesByBatch = new Map<string, number>();
    for (const item of input.order.items) {
      for (const reservation of item.reservations) {
        const currentBalance =
          balancesByBatch.get(reservation.batchId) ??
          (await this.currentBatchBalance(tx, reservation.batchId));
        const balanceAfter = currentBalance + reservation.quantity;
        balancesByBatch.set(reservation.batchId, balanceAfter);

        const movement = await tx.inventoryMovement.create({
          data: {
            distributorOrganisationId: item.distributorOrganisationId,
            warehouseId: item.warehouseId,
            batchId: reservation.batchId,
            productId: item.productId,
            variantId: item.variantId,
            movementType: InventoryMovementType.RELEASED_FROM_ORDER,
            quantityDelta: reservation.quantity,
            balanceAfter,
            reason: input.reason,
            referenceType: 'ProductOrderCancellation',
            referenceId: input.order.id,
            createdByUserId: input.actor.userId,
          },
        });

        await this.auditService.record(
          this.withActor(input.actor, {
            action: 'INVENTORY_RELEASED_FROM_ORDER',
            resourceType: 'InventoryMovement',
            resourceId: movement.id,
            organisationId: movement.distributorOrganisationId,
            newValue: this.releaseAuditValue(movement, reservation, item, input.order),
            requestId: input.requestId,
            reason: input.reason,
          }),
          tx,
        );
      }
    }
  }

  private async createChildOrderWithReservations(
    tx: Prisma.TransactionClient,
    input: {
      actor: CurrentUser;
      checkoutId: string;
      farmerProfileId: string;
      deliveryAddress: FarmerAddress;
      items: PreparedCheckoutItem[];
      requestId?: string | undefined;
      reason?: string | undefined;
      benefitTokenId?: string | undefined;
    },
  ): Promise<ProductOrder> {
    const seller = input.items[0]?.offer.distributorOrganisation;
    if (!seller) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Product order requires at least one seller item',
      });
    }
    if (!input.deliveryAddress.stateCode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery address requires a GST place-of-supply state code',
      });
    }
    const subtotalPaise = input.items.reduce((total, item) => total + item.lineTotalPaise, 0);
    const clubBenefitPaise = input.items.reduce(
      (total, item) => total + (item.clubBenefit?.totalBenefitPaise ?? 0),
      0,
    );
    const order = await tx.productOrder.create({
      data: {
        checkoutId: input.checkoutId,
        orderType: OrderType.PRODUCT_ORDER,
        farmerProfileId: input.farmerProfileId,
        deliveryAddressId: input.deliveryAddress.id,
        sellerOrganisationId: seller.id,
        orderNumber: this.generateOrderNumber(),
        status: ProductOrderStatus.PENDING_PAYMENT,
        serviceablePincode: input.deliveryAddress.pincode,
        sellerNameSnapshot: seller.displayName,
        sellerGstinSnapshot: seller.gstin,
        deliveryAddressSnapshot: this.addressSnapshot(input.deliveryAddress),
        subtotalPaise,
        clubBenefitPaise,
        farmerPayablePaise: subtotalPaise - clubBenefitPaise,
        isKisanClubOrder: input.items.some((item) => item.clubProgrammeEligible),
        itemCount: input.items.length,
      },
    });

    await this.recordStatusHistory(tx, {
      order,
      actor: input.actor,
      fromStatus: null,
      toStatus: ProductOrderStatus.PENDING_PAYMENT,
      requestId: input.requestId,
      reason: input.reason ?? 'Product order created from farmer cart',
    });

    await this.auditService.record(
      this.withActor(input.actor, {
        action: 'PRODUCT_ORDER_CREATED',
        resourceType: 'ProductOrder',
        resourceId: order.id,
        organisationId: order.sellerOrganisationId,
        newValue: this.productOrderAuditValue(order),
        requestId: input.requestId,
        reason: input.reason,
      }),
      tx,
    );

    for (const preparedItem of input.items) {
      const orderItem = await tx.productOrderItem.create({
        data: {
          productOrderId: order.id,
          sourceCartItemId: preparedItem.cartItem.id,
          offerId: preparedItem.offer.id,
          distributorOrganisationId: preparedItem.offer.distributorOrganisationId,
          productId: preparedItem.offer.productId,
          variantId: preparedItem.offer.variantId,
          warehouseId: preparedItem.offer.warehouseId,
          quantity: preparedItem.cartItem.quantity,
          unitPricePaise: preparedItem.unitPricePaise,
          lineTotalPaise: preparedItem.lineTotalPaise,
          hsnCodeSnapshot: preparedItem.offer.variant.hsnCode,
          gstRateBpsSnapshot: preparedItem.offer.variant.gstRateBps,
          clubBenefitRuleId: preparedItem.clubBenefit?.ruleId ?? null,
          clubBenefitPaise: preparedItem.clubBenefit?.totalBenefitPaise ?? 0,
          productNameSnapshot: preparedItem.offer.product.name,
          variantNameSnapshot: preparedItem.offer.variant.variantName,
          sellerNameSnapshot: preparedItem.offer.distributorOrganisation.displayName,
          warehouseNameSnapshot: preparedItem.offer.warehouse.name,
          fulfilmentModeSnapshot: preparedItem.offer.fulfilmentMode,
          deliverySlaDaysSnapshot: preparedItem.offer.deliverySlaDays,
        },
      });

      if (preparedItem.clubBenefit) {
        await this.kisanClubBenefitService?.redeem(tx, preparedItem.clubBenefit, {
          productOrderId: order.id,
          productOrderItemId: orderItem.id,
          quantity: preparedItem.cartItem.quantity,
          ...(input.benefitTokenId ? { benefitTokenId: input.benefitTokenId } : {}),
        });
      }

      await this.reserveInventoryForOrderItem(tx, {
        actor: input.actor,
        order,
        orderItem,
        offer: preparedItem.offer,
        quantity: preparedItem.cartItem.quantity,
        requestId: input.requestId,
        reason: input.reason ?? 'Inventory reserved during checkout',
      });
    }

    const reservedOrder = await tx.productOrder.update({
      where: { id: order.id },
      data: {
        status: ProductOrderStatus.INVENTORY_RESERVED,
      },
    });
    await this.recordStatusHistory(tx, {
      order: reservedOrder,
      actor: input.actor,
      fromStatus: ProductOrderStatus.PENDING_PAYMENT,
      toStatus: ProductOrderStatus.INVENTORY_RESERVED,
      requestId: input.requestId,
      reason: input.reason ?? 'Inventory reserved for child order',
    });

    await this.auditService.record(
      this.withActor(input.actor, {
        action: 'PRODUCT_ORDER_INVENTORY_RESERVED',
        resourceType: 'ProductOrder',
        resourceId: reservedOrder.id,
        organisationId: reservedOrder.sellerOrganisationId,
        previousValue: this.productOrderAuditValue(order),
        newValue: this.productOrderAuditValue(reservedOrder),
        requestId: input.requestId,
        reason: input.reason,
      }),
      tx,
    );
    return reservedOrder;
  }

  private async prepareCartItemsForCheckout(
    tx: Prisma.TransactionClient,
    cart: CheckoutCart,
    pincode: string,
    farmerProfileId: string,
  ): Promise<PreparedCheckoutItem[]> {
    const preparedItems: PreparedCheckoutItem[] = [];
    const reservedRuleUsage = new Map<string, number>();
    for (const cartItem of cart.items) {
      const offer = await this.findOfferOrThrow(tx, cartItem.offerId);
      const availableQuantity = await this.validateOfferForCheckout(
        tx,
        offer,
        pincode,
        cartItem.quantity,
      );
      if (cartItem.quantity > availableQuantity) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Requested quantity exceeds backend-derived sellable availability',
        });
      }
      if (!offer.variant.hsnCode || offer.variant.gstRateBps === null) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Product variant is missing approved HSN or GST metadata',
        });
      }

      const clubBenefit =
        (await this.kisanClubBenefitService?.evaluateForCheckout(tx, {
          farmerProfileId,
          productId: offer.productId,
          variantId: offer.variantId,
          pincode,
          unitPricePaise: offer.sellingPricePaise,
          quantity: cartItem.quantity,
          at: new Date(),
          reservedRuleUsage,
        })) ?? null;
      const clubProgrammeEligible =
        (await this.kisanClubBenefitService?.isProgrammeEligibleForCheckout(tx, {
          farmerProfileId,
          productId: offer.productId,
          variantId: offer.variantId,
          pincode,
          at: new Date(),
        })) ?? false;
      if (clubBenefit) {
        reservedRuleUsage.set(
          clubBenefit.ruleId,
          (reservedRuleUsage.get(clubBenefit.ruleId) ?? 0) + 1,
        );
      }
      preparedItems.push({
        cartItem,
        offer,
        unitPricePaise: offer.sellingPricePaise,
        lineTotalPaise: offer.sellingPricePaise * cartItem.quantity,
        clubBenefit,
        clubProgrammeEligible,
      });
    }

    return preparedItems;
  }

  private async reserveInventoryForOrderItem(
    tx: Prisma.TransactionClient,
    input: {
      actor: CurrentUser;
      order: ProductOrder;
      orderItem: ProductOrderItem;
      offer: CheckoutOffer;
      quantity: number;
      requestId?: string | undefined;
      reason: string;
    },
  ): Promise<void> {
    let remainingQuantity = input.quantity;
    const batches = await this.findEligibleBatchesForOffer(tx, input.offer);

    for (const batch of batches) {
      if (remainingQuantity <= 0) {
        break;
      }

      const currentBalance = await this.currentBatchBalance(tx, batch.id);
      const reservableQuantity = Math.max(0, currentBalance);
      const reservedQuantity = Math.min(remainingQuantity, reservableQuantity);
      if (reservedQuantity <= 0) {
        continue;
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          distributorOrganisationId: batch.distributorOrganisationId,
          warehouseId: batch.warehouseId,
          batchId: batch.id,
          productId: batch.productId,
          variantId: batch.variantId,
          movementType: InventoryMovementType.RESERVED_FOR_ORDER,
          quantityDelta: -reservedQuantity,
          balanceAfter: currentBalance - reservedQuantity,
          reason: input.reason,
          referenceType: 'ProductOrder',
          referenceId: input.order.id,
          createdByUserId: input.actor.userId,
        },
      });
      const reservation = await tx.productOrderItemReservation.create({
        data: {
          productOrderItemId: input.orderItem.id,
          batchId: batch.id,
          inventoryMovementId: movement.id,
          quantity: reservedQuantity,
        },
      });

      await this.auditService.record(
        this.withActor(input.actor, {
          action: 'INVENTORY_RESERVED_FOR_ORDER',
          resourceType: 'InventoryMovement',
          resourceId: movement.id,
          organisationId: movement.distributorOrganisationId,
          newValue: this.reservationAuditValue(movement, reservation, input.orderItem),
          requestId: input.requestId,
          reason: input.reason,
        }),
        tx,
      );
      remainingQuantity -= reservedQuantity;
    }

    if (remainingQuantity > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Unable to reserve enough backend-derived sellable stock for checkout',
      });
    }
  }

  private async validateOfferForCheckout(
    tx: Prisma.TransactionClient,
    offer: CheckoutOffer,
    pincode: string,
    quantity: number,
  ): Promise<number> {
    const missingRequirements = this.offerMissingRequirements(offer, pincode);
    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Offer cannot be checked out: ${missingRequirements.join(', ')}`,
      });
    }
    if (quantity < offer.minimumOrderQuantity) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Requested quantity is below the offer minimum order quantity',
      });
    }
    if (offer.maximumOrderQuantity !== null && quantity > offer.maximumOrderQuantity) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Requested quantity exceeds the offer maximum order quantity',
      });
    }

    return this.availableQuantityForOffer(tx, offer);
  }

  private offerMissingRequirements(offer: CheckoutOffer, pincode: string): string[] {
    const missingRequirements: string[] = [];
    if (offer.status !== DistributorOfferStatus.APPROVED) {
      missingRequirements.push('APPROVED_OFFER');
    }
    if (!offer.serviceablePincodes.includes(pincode)) {
      missingRequirements.push('SERVICEABLE_PINCODE');
    }
    if (offer.product.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_PRODUCT');
    }
    if (offer.product.brand.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_BRAND');
    }
    if (!offer.variant.isActive) {
      missingRequirements.push('ACTIVE_VARIANT');
    }
    if (offer.warehouse.status !== WarehouseStatus.ACTIVE) {
      missingRequirements.push('ACTIVE_WAREHOUSE');
    }
    if (offer.distributorOrganisation.status !== OrganisationStatus.ACTIVE) {
      missingRequirements.push('ACTIVE_DISTRIBUTOR');
    }
    if (offer.batch && !this.isBatchSellable(offer.batch)) {
      missingRequirements.push('SELLABLE_BATCH');
    }

    return missingRequirements;
  }

  private async availableQuantityForOffer(
    tx: Prisma.TransactionClient,
    offer: CheckoutOffer,
  ): Promise<number> {
    const batches = await this.findEligibleBatchesForOffer(tx, offer);
    return batches.reduce((total, batch) => {
      const balance = batch.inventoryMovements[0]?.balanceAfter ?? 0;
      return total + Math.max(0, balance);
    }, 0);
  }

  private async findEligibleBatchesForOffer(
    tx: Prisma.TransactionClient,
    offer: CheckoutOffer,
  ): Promise<EligibleBatch[]> {
    return tx.inventoryBatch.findMany({
      where: {
        distributorOrganisationId: offer.distributorOrganisationId,
        warehouseId: offer.warehouseId,
        productId: offer.productId,
        variantId: offer.variantId,
        ...(offer.batchId ? { id: offer.batchId } : {}),
        status: InventoryBatchStatus.ACTIVE,
        OR: [{ expiryDate: null }, { expiryDate: { gte: this.todayStartUtc() } }],
      },
      include: eligibleBatchInclude,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async findOfferOrThrow(
    tx: Prisma.TransactionClient,
    offerId: string,
  ): Promise<CheckoutOffer> {
    const offer = await tx.distributorOffer.findUnique({
      where: { id: offerId },
      include: checkoutOfferInclude,
    });

    if (!offer) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Distributor offer was not found',
      });
    }

    return offer;
  }

  private async findActiveCartForProfileOrThrow(
    tx: Prisma.TransactionClient,
    farmerProfileId: string,
  ): Promise<CheckoutCart> {
    const cart = await tx.cart.findUnique({
      where: { farmerProfileId },
      include: checkoutCartInclude,
    });

    if (!cart || cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'An active farmer cart is required before checkout',
      });
    }

    return cart;
  }

  private async resolveCheckoutAddress(
    tx: Prisma.TransactionClient,
    dto: CheckoutFromCartDto,
    profile: FarmerProfile,
    cart: CheckoutCart,
  ): Promise<FarmerAddress> {
    const deliveryAddressId = dto.farmerAddressId ?? cart.deliveryAddressId;
    if (!deliveryAddressId) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A farmer delivery address is required before checkout',
      });
    }

    const address = await tx.farmerAddress.findFirst({
      where: {
        id: deliveryAddressId,
        farmerProfileId: profile.id,
      },
    });

    if (!address) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer address was not found',
      });
    }

    return address;
  }

  private ensureCartPincodeMatchesAddress(cart: CheckoutCart, pincode: string): void {
    if (cart.serviceablePincode !== pincode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Cart pincode must match the selected delivery address before checkout',
      });
    }

    for (const item of cart.items) {
      if (item.serviceablePincodeSnapshot !== pincode) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Cart item serviceability snapshots must match the checkout address pincode',
        });
      }
    }
  }

  private groupItemsBySeller(items: PreparedCheckoutItem[]): Map<string, PreparedCheckoutItem[]> {
    const groups = new Map<string, PreparedCheckoutItem[]>();
    for (const item of items) {
      const sellerId = item.offer.distributorOrganisationId;
      const existingGroup = groups.get(sellerId) ?? [];
      existingGroup.push(item);
      groups.set(sellerId, existingGroup);
    }

    return groups;
  }

  private async findCheckoutForProfileOrThrow(
    client: CheckoutClient,
    checkoutId: string,
    farmerProfileId: string,
  ): Promise<ProductCheckoutWithDetails> {
    const checkout = await client.productCheckout.findFirst({
      where: {
        id: checkoutId,
        farmerProfileId,
      },
      include: productCheckoutDetailInclude,
    });

    if (!checkout) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product checkout was not found',
      });
    }

    return checkout;
  }

  private async findOrderForProfileOrThrow(
    client: CheckoutClient,
    orderId: string,
    farmerProfileId: string,
  ): Promise<ProductOrderWithDetails> {
    const order = await client.productOrder.findFirst({
      where: {
        id: orderId,
        farmerProfileId,
      },
      include: productOrderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product order was not found',
      });
    }

    return order;
  }

  private async findProfileForActorOrThrow(
    actor: CurrentUser,
    client: CheckoutClient = this.prisma,
  ): Promise<FarmerProfile> {
    const profile = await client.farmerProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!profile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before checkout',
      });
    }

    return profile;
  }

  private async findFarmerProfileByIdOrThrow(
    client: CheckoutClient,
    farmerProfileId: string,
  ): Promise<FarmerProfile> {
    const profile = await client.farmerProfile.findUnique({
      where: { id: farmerProfileId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Invoice farmer profile was not found',
      });
    }

    return profile;
  }

  private ensureCheckoutCanBeCancelled(checkout: ProductCheckoutWithDetails): void {
    this.ensureCheckoutAllowsOrderCancellation(checkout);
    if (checkout.orders.length === 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout must contain at least one child order before cancellation',
      });
    }

    for (const order of checkout.orders) {
      if (order.status === ProductOrderStatus.CANCELLED) {
        continue;
      }
      this.ensureOrderCanBeCancelled(order);
    }
  }

  private ensureCheckoutAllowsOrderCancellation(checkout: ProductCheckoutWithDetails): void {
    if (checkout.status === ProductCheckoutStatus.CANCELLED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Checkout is already cancelled',
      });
    }
    if (checkout.status === ProductCheckoutStatus.PAYMENT_PROCESSING) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Checkout has a mock payment attempt in progress and cannot be cancelled',
      });
    }
    if (checkout.status === ProductCheckoutStatus.PAID) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Paid checkout cancellation requires a future refund workflow',
      });
    }
    if (
      checkout.status !== ProductCheckoutStatus.PENDING_PAYMENT &&
      checkout.status !== ProductCheckoutStatus.PAYMENT_FAILED
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout is not eligible for cancellation',
      });
    }
  }

  private ensureOrderCanBeCancelled(order: ProductOrderWithDetails): void {
    if (order.status === ProductOrderStatus.CANCELLED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Product order is already cancelled',
      });
    }
    if (!this.isOrderCancellationEligible(order.status)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Product order is not eligible for cancellation',
      });
    }
  }

  private isOrderCancellationEligible(status: ProductOrderStatus): boolean {
    return (
      status === ProductOrderStatus.PENDING_PAYMENT ||
      status === ProductOrderStatus.INVENTORY_RESERVED ||
      status === ProductOrderStatus.PAYMENT_FAILED
    );
  }

  private cancellationReason(dto: CancelOrderDto, fallback: string): string {
    const reason = dto.reason?.trim();
    return reason && reason.length > 0 ? reason : fallback;
  }

  private async recordStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      order: ProductOrder;
      actor: CurrentUser;
      fromStatus: ProductOrderStatus | null;
      toStatus: ProductOrderStatus;
      requestId?: string | undefined;
      reason?: string | undefined;
    },
  ): Promise<void> {
    await tx.productOrderStatusHistory.create({
      data: {
        productOrderId: input.order.id,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorUserId: input.actor.userId,
        actorRole: input.actor.role,
        requestId: input.requestId ?? null,
        reason: input.reason ?? null,
      },
    });
  }

  private async currentBatchBalance(
    tx: Prisma.TransactionClient,
    batchId: string,
  ): Promise<number> {
    const latestMovement = await tx.inventoryMovement.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });

    return latestMovement?.balanceAfter ?? 0;
  }

  private toCheckoutDetail(checkout: ProductCheckoutWithDetails) {
    return {
      id: checkout.id,
      farmerProfileId: checkout.farmerProfileId,
      sourceCartId: checkout.sourceCartId,
      deliveryAddress: checkout.deliveryAddress
        ? this.addressSummary(checkout.deliveryAddress)
        : null,
      serviceablePincode: checkout.serviceablePincode,
      status: checkout.status,
      subtotalPaise: checkout.subtotalPaise,
      clubBenefitPaise: checkout.clubBenefitPaise,
      farmerPayablePaise: checkout.farmerPayablePaise,
      itemCount: checkout.itemCount,
      childOrderCount: checkout.childOrderCount,
      orders: checkout.orders.map((order) => this.toOrderDetail(order)),
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
    };
  }

  private toOrderDetail(
    order: ProductOrderWithDetails,
    options: { mockDeliveryOtpCode?: string } = {},
  ) {
    return {
      id: order.id,
      checkoutId: order.checkoutId,
      orderType: order.orderType,
      farmerProfileId: order.farmerProfileId,
      deliveryAddressId: order.deliveryAddressId,
      sellerOrganisationId: order.sellerOrganisationId,
      orderNumber: order.orderNumber,
      status: order.status,
      serviceablePincode: order.serviceablePincode,
      sellerNameSnapshot: order.sellerNameSnapshot,
      sellerGstinSnapshot: order.sellerGstinSnapshot,
      deliveryAddressSnapshot: order.deliveryAddressSnapshot,
      subtotalPaise: order.subtotalPaise,
      clubBenefitPaise: order.clubBenefitPaise,
      farmerPayablePaise: order.farmerPayablePaise,
      isKisanClubOrder: order.isKisanClubOrder,
      itemCount: order.itemCount,
      items: order.items.map((item) => ({
        id: item.id,
        productOrderId: item.productOrderId,
        sourceCartItemId: item.sourceCartItemId,
        offerId: item.offerId,
        distributorOrganisationId: item.distributorOrganisationId,
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        lineTotalPaise: item.lineTotalPaise,
        clubBenefitRuleId: item.clubBenefitRuleId,
        clubBenefitPaise: item.clubBenefitPaise,
        farmerPayablePaise: item.lineTotalPaise - item.clubBenefitPaise,
        productNameSnapshot: item.productNameSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
        sellerNameSnapshot: item.sellerNameSnapshot,
        warehouseNameSnapshot: item.warehouseNameSnapshot,
        fulfilmentModeSnapshot: item.fulfilmentModeSnapshot,
        deliverySlaDaysSnapshot: item.deliverySlaDaysSnapshot,
        reservations: item.reservations.map((reservation) => ({
          id: reservation.id,
          batchId: reservation.batchId,
          batchNumber: reservation.batch.batchNumber,
          inventoryMovementId: reservation.inventoryMovementId,
          quantity: reservation.quantity,
          movementBalanceAfter: reservation.inventoryMovement.balanceAfter,
          createdAt: reservation.createdAt,
        })),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      statusHistory: order.statusHistory.map((history) => ({
        id: history.id,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        actorUserId: history.actorUserId,
        actorRole: history.actorRole,
        reason: history.reason,
        requestId: history.requestId,
        createdAt: history.createdAt,
      })),
      invoice: order.invoice ? this.toInvoiceDetail(order.invoice) : null,
      dispatch: order.dispatch ? this.toDispatchDetail(order.dispatch) : null,
      deliveryAssignment: order.deliveryAssignment
        ? this.toDeliveryAssignmentDetail(order.deliveryAssignment, options.mockDeliveryOtpCode)
        : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toInvoiceDetail(invoice: ProductInvoice) {
    return {
      id: invoice.id,
      productOrderId: invoice.productOrderId,
      checkoutId: invoice.checkoutId,
      farmerProfileId: invoice.farmerProfileId,
      sellerOrganisationId: invoice.sellerOrganisationId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      subtotalPaise: invoice.subtotalPaise,
      taxableAmountPaise: invoice.taxableAmountPaise,
      taxPaise: invoice.taxPaise,
      cgstPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      totalPaise: invoice.totalPaise,
      itemCount: invoice.itemCount,
      sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
      sellerDisplayNameSnapshot: invoice.sellerDisplayNameSnapshot,
      sellerGstinSnapshot: invoice.sellerGstinSnapshot,
      sellerStateCodeSnapshot: invoice.sellerStateCodeSnapshot,
      sellerAddressSnapshot: invoice.sellerAddressSnapshot,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      financialYear: invoice.financialYear,
      sequenceNumber: invoice.sequenceNumber,
      farmerNameSnapshot: invoice.farmerNameSnapshot,
      deliveryAddressSnapshot: invoice.deliveryAddressSnapshot,
      lineItemsSnapshot: invoice.lineItemsSnapshot,
      generatedByUserId: invoice.generatedByUserId,
      generatedByRole: invoice.generatedByRole,
      generatedAt: invoice.generatedAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private toDispatchDetail(dispatch: ProductDispatch) {
    return {
      id: dispatch.id,
      productOrderId: dispatch.productOrderId,
      checkoutId: dispatch.checkoutId,
      invoiceId: dispatch.invoiceId,
      farmerProfileId: dispatch.farmerProfileId,
      sellerOrganisationId: dispatch.sellerOrganisationId,
      dispatchNumber: dispatch.dispatchNumber,
      status: dispatch.status,
      serviceablePincode: dispatch.serviceablePincode,
      invoiceNumberSnapshot: dispatch.invoiceNumberSnapshot,
      sellerNameSnapshot: dispatch.sellerNameSnapshot,
      sellerGstinSnapshot: dispatch.sellerGstinSnapshot,
      deliveryAddressSnapshot: dispatch.deliveryAddressSnapshot,
      warehouseSnapshot: dispatch.warehouseSnapshot,
      itemsSnapshot: dispatch.itemsSnapshot,
      readyForPickupReason: dispatch.readyForPickupReason,
      readyByUserId: dispatch.readyByUserId,
      readyByRole: dispatch.readyByRole,
      packageQrIssuedAt: dispatch.packageQrIssuedAt,
      packageQrIssuedByUserId: dispatch.packageQrIssuedByUserId,
      readyAt: dispatch.readyAt,
      createdAt: dispatch.createdAt,
      updatedAt: dispatch.updatedAt,
    };
  }

  /**
   * Echoes the freshly generated delivery OTP back to the caller, but only
   * while SMS is mocked -- the same rule `AuthService` applies to login codes.
   *
   * Against a real provider the code must exist nowhere but the farmer's
   * handset. Returning it unconditionally would hand it to the assigning
   * operator and, because `retryDelivery` is reachable with manage-*own*
   * authority, to the delivery partner themselves -- who could then close a
   * delivery the farmer never confirmed, which is precisely what the OTP is
   * there to prevent. Removing this exposure before go-live is item 14 of the
   * `REMAINING_IMPLEMENTATION_PLAN` checklist; gating it on the provider means
   * that happens by flipping `SMS_PROVIDER`, not by remembering to edit code.
   */
  private mockDeliveryOtp(code: string): { mockDeliveryOtpCode?: string } {
    return this.otpSender.isSmsMocked() ? { mockDeliveryOtpCode: code } : {};
  }

  private toDeliveryAssignmentDetail(
    assignment: ProductDeliveryAssignment,
    mockDeliveryOtpCode?: string,
  ) {
    return {
      id: assignment.id,
      productOrderId: assignment.productOrderId,
      checkoutId: assignment.checkoutId,
      dispatchId: assignment.dispatchId,
      farmerProfileId: assignment.farmerProfileId,
      sellerOrganisationId: assignment.sellerOrganisationId,
      deliveryPartnerUserId: assignment.deliveryPartnerUserId,
      assignmentNumber: assignment.assignmentNumber,
      status: assignment.status,
      serviceablePincode: assignment.serviceablePincode,
      dispatchNumberSnapshot: assignment.dispatchNumberSnapshot,
      invoiceNumberSnapshot: assignment.invoiceNumberSnapshot,
      sellerNameSnapshot: assignment.sellerNameSnapshot,
      sellerGstinSnapshot: assignment.sellerGstinSnapshot,
      deliveryAddressSnapshot: assignment.deliveryAddressSnapshot,
      pickupSnapshot: assignment.pickupSnapshot,
      itemsSnapshot: assignment.itemsSnapshot,
      otpExpiresAt: assignment.otpExpiresAt,
      otpAttemptCount: assignment.otpAttemptCount,
      otpVerifiedAt: assignment.otpVerifiedAt,
      pickupVerificationAttemptCount: assignment.pickupVerificationAttemptCount,
      pickupVerifiedAt: assignment.pickupVerifiedAt,
      pickupVerifiedByUserId: assignment.pickupVerifiedByUserId,
      pickupVerifiedByRole: assignment.pickupVerifiedByRole,
      assignedByUserId: assignment.assignedByUserId,
      assignedByRole: assignment.assignedByRole,
      assignedAt: assignment.assignedAt,
      startedByUserId: assignment.startedByUserId,
      startedByRole: assignment.startedByRole,
      startedAt: assignment.startedAt,
      completedByUserId: assignment.completedByUserId,
      completedByRole: assignment.completedByRole,
      completedAt: assignment.completedAt,
      deliveryProofNote: assignment.deliveryProofNote,
      proofLocationStatus: assignment.proofLocationStatus,
      proofLatitude: assignment.proofLatitude,
      proofLongitude: assignment.proofLongitude,
      proofAccuracyMetres: assignment.proofAccuracyMetres,
      proofLocationCapturedAt: assignment.proofLocationCapturedAt,
      failureAttemptCount: assignment.failureAttemptCount,
      lastFailureReasonCode: assignment.lastFailureReasonCode,
      lastFailureNote: assignment.lastFailureNote,
      lastFailedAt: assignment.lastFailedAt,
      lastFailedByUserId: assignment.lastFailedByUserId,
      lastFailedByRole: assignment.lastFailedByRole,
      retryScheduledAt: assignment.retryScheduledAt,
      mockOtpCode: mockDeliveryOtpCode,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private addressSummary(address: FarmerAddress) {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      village: address.village,
      city: address.city,
      district: address.district,
      state: address.state,
      stateCode: address.stateCode,
      pincode: address.pincode,
      landmark: address.landmark,
      isDefault: address.isDefault,
    };
  }

  private addressSnapshot(address: FarmerAddress): Prisma.InputJsonObject {
    return this.addressSummary(address);
  }

  private checkoutAuditValue(checkout: {
    farmerProfileId: string;
    sourceCartId: string | null;
    deliveryAddressId: string | null;
    serviceablePincode: string;
    status: ProductCheckoutStatus;
    subtotalPaise: number;
    clubBenefitPaise: number;
    farmerPayablePaise: number;
    itemCount: number;
    childOrderCount: number;
  }): Prisma.InputJsonObject {
    return {
      farmerProfileId: checkout.farmerProfileId,
      sourceCartId: checkout.sourceCartId,
      deliveryAddressId: checkout.deliveryAddressId,
      serviceablePincode: checkout.serviceablePincode,
      status: checkout.status,
      subtotalPaise: checkout.subtotalPaise,
      clubBenefitPaise: checkout.clubBenefitPaise,
      farmerPayablePaise: checkout.farmerPayablePaise,
      itemCount: checkout.itemCount,
      childOrderCount: checkout.childOrderCount,
    };
  }

  private productOrderAuditValue(order: ProductOrder): Prisma.InputJsonObject {
    return {
      checkoutId: order.checkoutId,
      orderType: order.orderType,
      farmerProfileId: order.farmerProfileId,
      deliveryAddressId: order.deliveryAddressId,
      sellerOrganisationId: order.sellerOrganisationId,
      orderNumber: order.orderNumber,
      status: order.status,
      serviceablePincode: order.serviceablePincode,
      sellerNameSnapshot: order.sellerNameSnapshot,
      sellerGstinSnapshot: order.sellerGstinSnapshot,
      subtotalPaise: order.subtotalPaise,
      clubBenefitPaise: order.clubBenefitPaise,
      farmerPayablePaise: order.farmerPayablePaise,
      isKisanClubOrder: order.isKisanClubOrder,
      itemCount: order.itemCount,
    };
  }

  private productInvoiceAuditValue(invoice: ProductInvoice): Prisma.InputJsonObject {
    return {
      productOrderId: invoice.productOrderId,
      checkoutId: invoice.checkoutId,
      farmerProfileId: invoice.farmerProfileId,
      sellerOrganisationId: invoice.sellerOrganisationId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      subtotalPaise: invoice.subtotalPaise,
      taxableAmountPaise: invoice.taxableAmountPaise,
      taxPaise: invoice.taxPaise,
      cgstPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      totalPaise: invoice.totalPaise,
      itemCount: invoice.itemCount,
      sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
      sellerDisplayNameSnapshot: invoice.sellerDisplayNameSnapshot,
      sellerGstinSnapshot: invoice.sellerGstinSnapshot,
      sellerStateCodeSnapshot: invoice.sellerStateCodeSnapshot,
      sellerAddressSnapshot: invoice.sellerAddressSnapshot,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      financialYear: invoice.financialYear,
      sequenceNumber: invoice.sequenceNumber,
      farmerNameSnapshot: invoice.farmerNameSnapshot,
      generatedByUserId: invoice.generatedByUserId,
      generatedByRole: invoice.generatedByRole,
      generatedAt: invoice.generatedAt.toISOString(),
    };
  }

  private productDispatchAuditValue(dispatch: ProductDispatch): Prisma.InputJsonObject {
    return {
      productOrderId: dispatch.productOrderId,
      checkoutId: dispatch.checkoutId,
      invoiceId: dispatch.invoiceId,
      farmerProfileId: dispatch.farmerProfileId,
      sellerOrganisationId: dispatch.sellerOrganisationId,
      dispatchNumber: dispatch.dispatchNumber,
      status: dispatch.status,
      serviceablePincode: dispatch.serviceablePincode,
      invoiceNumberSnapshot: dispatch.invoiceNumberSnapshot,
      sellerNameSnapshot: dispatch.sellerNameSnapshot,
      sellerGstinSnapshot: dispatch.sellerGstinSnapshot,
      readyForPickupReason: dispatch.readyForPickupReason,
      readyByUserId: dispatch.readyByUserId,
      readyByRole: dispatch.readyByRole,
      packageQrIssuedAt: dispatch.packageQrIssuedAt?.toISOString() ?? null,
      packageQrIssuedByUserId: dispatch.packageQrIssuedByUserId,
      readyAt: dispatch.readyAt.toISOString(),
    };
  }

  private productDeliveryAssignmentAuditValue(
    assignment: ProductDeliveryAssignment,
  ): Prisma.InputJsonObject {
    return {
      productOrderId: assignment.productOrderId,
      checkoutId: assignment.checkoutId,
      dispatchId: assignment.dispatchId,
      farmerProfileId: assignment.farmerProfileId,
      sellerOrganisationId: assignment.sellerOrganisationId,
      deliveryPartnerUserId: assignment.deliveryPartnerUserId,
      assignmentNumber: assignment.assignmentNumber,
      status: assignment.status,
      serviceablePincode: assignment.serviceablePincode,
      dispatchNumberSnapshot: assignment.dispatchNumberSnapshot,
      invoiceNumberSnapshot: assignment.invoiceNumberSnapshot,
      sellerNameSnapshot: assignment.sellerNameSnapshot,
      sellerGstinSnapshot: assignment.sellerGstinSnapshot,
      otpExpiresAt: assignment.otpExpiresAt.toISOString(),
      otpAttemptCount: assignment.otpAttemptCount,
      otpVerifiedAt: assignment.otpVerifiedAt?.toISOString() ?? null,
      pickupVerificationAttemptCount: assignment.pickupVerificationAttemptCount,
      pickupVerifiedAt: assignment.pickupVerifiedAt?.toISOString() ?? null,
      pickupVerifiedByUserId: assignment.pickupVerifiedByUserId,
      pickupVerifiedByRole: assignment.pickupVerifiedByRole,
      assignedByUserId: assignment.assignedByUserId,
      assignedByRole: assignment.assignedByRole,
      assignedAt: assignment.assignedAt.toISOString(),
      startedByUserId: assignment.startedByUserId,
      startedByRole: assignment.startedByRole,
      startedAt: assignment.startedAt?.toISOString() ?? null,
      completedByUserId: assignment.completedByUserId,
      completedByRole: assignment.completedByRole,
      completedAt: assignment.completedAt?.toISOString() ?? null,
      deliveryProofNote: assignment.deliveryProofNote,
      proofLocationStatus: assignment.proofLocationStatus,
      proofLatitude: assignment.proofLatitude,
      proofLongitude: assignment.proofLongitude,
      proofAccuracyMetres: assignment.proofAccuracyMetres,
      proofLocationCapturedAt: assignment.proofLocationCapturedAt?.toISOString() ?? null,
      failureAttemptCount: assignment.failureAttemptCount,
      lastFailureReasonCode: assignment.lastFailureReasonCode,
      lastFailureNote: assignment.lastFailureNote,
      lastFailedAt: assignment.lastFailedAt?.toISOString() ?? null,
      lastFailedByUserId: assignment.lastFailedByUserId,
      lastFailedByRole: assignment.lastFailedByRole,
      retryScheduledAt: assignment.retryScheduledAt?.toISOString() ?? null,
    };
  }

  private validateDeliveryRetryTime(value: string): Date {
    const retryAt = new Date(value);
    const now = Date.now();
    if (!Number.isFinite(retryAt.getTime()) || retryAt.getTime() <= now) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery retry time must be in the future',
      });
    }
    if (retryAt.getTime() > now + DELIVERY_RETRY_MAX_DAYS * 86_400_000) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Delivery retry time cannot be more than ${DELIVERY_RETRY_MAX_DAYS} days away`,
      });
    }
    return retryAt;
  }

  private deliveryFailureReason(
    reasonCode: DeliveryFailureReasonCode,
    note: string | null,
  ): string {
    return note
      ? `Delivery attempt failed (${reasonCode}): ${note}`
      : `Delivery attempt failed (${reasonCode})`;
  }

  private validateDeliveryLocationProof(dto: CompleteDeliveryDto): {
    latitude: number;
    longitude: number;
    accuracyMetres: number;
    capturedAt: Date;
  } | null {
    const values = [
      dto.proofLatitude,
      dto.proofLongitude,
      dto.proofAccuracyMetres,
      dto.proofLocationCapturedAt,
    ];
    if (dto.proofLocationStatus !== DeliveryProofLocationStatus.GRANTED) {
      if (values.some((value) => value !== undefined)) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Location coordinates must be omitted when location permission is not granted',
        });
      }
      return null;
    }
    if (values.some((value) => value === undefined)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Granted location proof requires coordinates, accuracy and capture time',
      });
    }
    const capturedAt = new Date(dto.proofLocationCapturedAt!);
    if (capturedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Location proof capture time cannot be in the future',
      });
    }
    return {
      latitude: dto.proofLatitude!,
      longitude: dto.proofLongitude!,
      accuracyMetres: dto.proofAccuracyMetres!,
      capturedAt,
    };
  }

  private async verifyDeliveryOtpOrThrow(
    assignment: ProductDeliveryAssignment,
    otpCode: string,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    if (assignment.otpAttemptCount >= DELIVERY_OTP_MAX_ATTEMPTS) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Delivery OTP verification has reached the maximum attempt limit',
      });
    }
    if (assignment.otpExpiresAt.getTime() < Date.now()) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Delivery OTP has expired',
      });
    }
    if (this.hashDeliveryOtp(otpCode, assignment.otpSalt) === assignment.otpHash) {
      return;
    }

    // Recorded via this.prisma, not the enclosing tx: the caller's transaction
    // aborts right after this throws, which would otherwise roll back the very
    // failed-attempt record we're trying to persist.
    const updatedAssignment = await this.prisma.productDeliveryAssignment.update({
      where: { id: assignment.id },
      data: {
        otpAttemptCount: {
          increment: 1,
        },
      },
    });
    await this.auditService.record(
      this.withActor(actor, {
        action: 'PRODUCT_DELIVERY_OTP_FAILED',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: updatedAssignment.id,
        organisationId: updatedAssignment.sellerOrganisationId,
        previousValue: this.productDeliveryAssignmentAuditValue(assignment),
        newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
        requestId,
        reason: 'Delivery OTP verification failed',
      }),
    );

    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'Delivery OTP is invalid',
    });
  }

  private hashPackageQrCode(packageQrCode: string): string {
    return createHash('sha256').update(packageQrCode, 'utf8').digest('hex');
  }

  private async recordFailedPackagePickupVerification(
    assignment: ProductDeliveryAssignment,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    const updatedAssignment = await this.prisma.productDeliveryAssignment.update({
      where: { id: assignment.id },
      data: { pickupVerificationAttemptCount: { increment: 1 } },
    });
    await this.auditService.record(
      this.withActor(actor, {
        action: 'PRODUCT_DELIVERY_PACKAGE_QR_FAILED',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: updatedAssignment.id,
        organisationId: updatedAssignment.sellerOrganisationId,
        previousValue: this.productDeliveryAssignmentAuditValue(assignment),
        newValue: this.productDeliveryAssignmentAuditValue(updatedAssignment),
        requestId,
        reason: 'Package QR verification failed',
      }),
    );
  }

  private invoiceLineItemsSnapshot(
    order: ProductOrderWithDetails,
    taxLines: InvoiceTaxLine[],
  ): Prisma.InputJsonValue {
    const taxByItemId = new Map(taxLines.map((line) => [line.productOrderItemId, line]));
    return this.toJsonValue(
      order.items.map((item) => {
        const tax = taxByItemId.get(item.id);
        if (!tax) throw new Error(`Invoice tax line missing for order item ${item.id}`);
        return {
          productOrderItemId: item.id,
          offerId: item.offerId,
          distributorOrganisationId: item.distributorOrganisationId,
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          lineTotalPaise: item.lineTotalPaise,
          hsnCode: tax.hsnCode,
          gstRateBps: tax.gstRateBps,
          taxableAmountPaise: tax.taxableAmountPaise,
          taxPaise: tax.taxPaise,
          cgstPaise: tax.cgstPaise,
          sgstPaise: tax.sgstPaise,
          igstPaise: tax.igstPaise,
          clubBenefitRuleId: item.clubBenefitRuleId,
          clubBenefitPaise: item.clubBenefitPaise,
          productNameSnapshot: item.productNameSnapshot,
          variantNameSnapshot: item.variantNameSnapshot,
          sellerNameSnapshot: item.sellerNameSnapshot,
          warehouseNameSnapshot: item.warehouseNameSnapshot,
          fulfilmentModeSnapshot: item.fulfilmentModeSnapshot,
          deliverySlaDaysSnapshot: item.deliverySlaDaysSnapshot,
          reservations: item.reservations.map((reservation) => ({
            reservationId: reservation.id,
            batchId: reservation.batchId,
            batchNumber: reservation.batch.batchNumber,
            inventoryMovementId: reservation.inventoryMovementId,
            quantity: reservation.quantity,
          })),
        };
      }),
    );
  }

  private verifiedSellerStateCode(seller: Organisation): string {
    if (!seller.gstin || !seller.registeredStateCode || !seller.gstinVerifiedAt) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Seller GSTIN and registered state must be verified before invoice generation',
      });
    }
    if (seller.gstin.slice(0, 2) !== seller.registeredStateCode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Seller GSTIN does not match its verified registered state',
      });
    }
    return seller.registeredStateCode;
  }

  private async invoiceSellerAddress(
    client: CheckoutClient,
    sellerOrganisationId: string,
  ): Promise<string> {
    const profile = await client.distributorProfile.findUnique({
      where: { organisationId: sellerOrganisationId },
      select: { operatingAddress: true, city: true, state: true, pincode: true },
    });
    const parts = [
      profile?.operatingAddress,
      profile?.city,
      profile?.state,
      profile?.pincode,
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (!profile?.operatingAddress || !profile.city || !profile.state || !profile.pincode) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Seller address must be complete before invoice generation',
      });
    }
    return parts.join(', ');
  }

  private invoicePlaceOfSupplyStateCode(order: ProductOrderWithDetails): string {
    const snapshot = order.deliveryAddressSnapshot;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery address snapshot is invalid for invoice generation',
      });
    }
    const stateCode = (snapshot as Prisma.JsonObject).stateCode;
    if (typeof stateCode !== 'string' || !/^[0-9]{2}$/.test(stateCode)) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery address is missing its place-of-supply state code',
      });
    }
    return stateCode;
  }

  private invoiceTaxCalculation(
    order: ProductOrderWithDetails,
    sellerStateCode: string,
    placeOfSupplyStateCode: string,
  ) {
    const lines = order.items.map((item) => {
      if (!item.hsnCodeSnapshot || item.gstRateBpsSnapshot === null) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Order item is missing its HSN or GST-rate snapshot',
        });
      }
      return {
        productOrderItemId: item.id,
        grossAmountPaise: item.lineTotalPaise,
        hsnCode: item.hsnCodeSnapshot,
        gstRateBps: item.gstRateBpsSnapshot,
      };
    });
    const tax = calculateInclusiveInvoiceTax(lines, sellerStateCode, placeOfSupplyStateCode);
    if (tax.totalPaise !== order.subtotalPaise) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Invoice tax lines do not reconcile to the backend order subtotal',
      });
    }
    return tax;
  }

  private async nextInvoiceSequence(
    tx: Prisma.TransactionClient,
    sellerOrganisationId: string,
    financialYear: string,
  ): Promise<number> {
    const sequence = await tx.invoiceSequence.upsert({
      where: { sellerOrganisationId_financialYear: { sellerOrganisationId, financialYear } },
      create: { sellerOrganisationId, financialYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return sequence.lastNumber;
  }

  private formatInvoiceNumber(
    sellerOrganisationId: string,
    financialYear: string,
    sequenceNumber: number,
  ): string {
    const sellerSeries = sellerOrganisationId
      .replace(/[^a-f0-9]/gi, '')
      .slice(0, 4)
      .toUpperCase();
    const financialYearSuffix = financialYear.slice(-2);
    return `${sellerSeries}/${financialYearSuffix}/${String(sequenceNumber).padStart(6, '0')}`;
  }

  private dispatchWarehouseSnapshot(order: ProductOrderWithDetails): Prisma.InputJsonValue {
    const warehousesById = new Map<
      string,
      {
        warehouseId: string;
        warehouseNameSnapshot: string;
        itemCount: number;
        totalQuantity: number;
      }
    >();

    for (const item of order.items) {
      const existing = warehousesById.get(item.warehouseId);
      if (existing) {
        existing.itemCount += 1;
        existing.totalQuantity += item.quantity;
        continue;
      }

      warehousesById.set(item.warehouseId, {
        warehouseId: item.warehouseId,
        warehouseNameSnapshot: item.warehouseNameSnapshot,
        itemCount: 1,
        totalQuantity: item.quantity,
      });
    }

    return this.toJsonValue([...warehousesById.values()]);
  }

  private dispatchItemsSnapshot(order: ProductOrderWithDetails): Prisma.InputJsonValue {
    return this.toJsonValue(
      order.items.map((item) => ({
        productOrderItemId: item.id,
        offerId: item.offerId,
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        productNameSnapshot: item.productNameSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
        warehouseNameSnapshot: item.warehouseNameSnapshot,
        quantity: item.quantity,
        reservations: item.reservations.map((reservation) => ({
          reservationId: reservation.id,
          batchId: reservation.batchId,
          batchNumber: reservation.batch.batchNumber,
          inventoryMovementId: reservation.inventoryMovementId,
          quantity: reservation.quantity,
        })),
      })),
    );
  }

  private cartAuditValue(cart: CheckoutCart): Prisma.InputJsonObject {
    return {
      farmerProfileId: cart.farmerProfileId,
      deliveryAddressId: cart.deliveryAddressId,
      serviceablePincode: cart.serviceablePincode,
      status: cart.status,
      itemCount: cart.items.length,
      items: cart.items.map((item) => ({
        id: item.id,
        offerId: item.offerId,
        quantity: item.quantity,
        priceSnapshotPaise: item.priceSnapshotPaise,
        availableQuantitySnapshot: item.availableQuantitySnapshot,
      })),
    };
  }

  private reservationAuditValue(
    movement: InventoryMovement,
    reservation: ProductOrderItemReservation,
    orderItem: ProductOrderItem,
  ): Prisma.InputJsonObject {
    return {
      inventoryMovementId: movement.id,
      productOrderItemId: orderItem.id,
      productOrderId: orderItem.productOrderId,
      batchId: reservation.batchId,
      quantity: reservation.quantity,
      movementType: movement.movementType,
      quantityDelta: movement.quantityDelta,
      balanceAfter: movement.balanceAfter,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
    };
  }

  private releaseAuditValue(
    movement: InventoryMovement,
    reservation: ProductOrderItemReservation,
    orderItem: ProductOrderItem,
    order: ProductOrder,
  ): Prisma.InputJsonObject {
    return {
      inventoryMovementId: movement.id,
      productOrderItemId: orderItem.id,
      productOrderId: order.id,
      batchId: reservation.batchId,
      quantity: reservation.quantity,
      movementType: movement.movementType,
      quantityDelta: movement.quantityDelta,
      balanceAfter: movement.balanceAfter,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      releasedFromReservationMovementId: reservation.inventoryMovementId,
      previousOrderStatus: order.status,
      nextOrderStatus: ProductOrderStatus.CANCELLED,
    };
  }

  private isBatchSellable(batch: {
    status: InventoryBatchStatus;
    expiryDate?: Date | null;
  }): boolean {
    return batch.status === InventoryBatchStatus.ACTIVE && !this.isBatchExpired(batch.expiryDate);
  }

  private isBatchExpired(expiryDate?: Date | null): boolean {
    if (!expiryDate) {
      return false;
    }

    return expiryDate.getTime() < this.todayStartUtc().getTime();
  }

  private todayStartUtc(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private generateOrderNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `PO-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateDispatchNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `DSP-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateDeliveryAssignmentNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `DLV-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private generateDeliveryOtp(): { code: string; salt: string; hash: string } {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const salt = randomUUID();

    return {
      code,
      salt,
      hash: this.hashDeliveryOtp(code, salt),
    };
  }

  private hashDeliveryOtp(code: string, salt: string): string {
    return createHash('sha256').update(`${salt}:${code}`).digest('hex');
  }

  private async runIdempotent<T>(input: IdempotencyInput, handler: () => Promise<T>): Promise<T> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: {
          scope: input.scope,
          key: input.key,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: input.differentRequestMessage,
        });
      }
      if (existing.status === IdempotencyStatus.COMPLETED) {
        return existing.response as T;
      }
      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: input.inProgressMessage,
        });
      }

      await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: this.idempotencyInProgressData(input.requestHash),
      });
    } else {
      try {
        await this.prisma.idempotencyRecord.create({
          data: {
            scope: input.scope,
            key: input.key,
            ...this.idempotencyInProgressData(input.requestHash),
          },
        });
      } catch (error) {
        this.throwConflictForKnownUniqueError(error, input.inProgressMessage);
        throw error;
      }
    }

    try {
      const result = await handler();
      await this.prisma.idempotencyRecord.update({
        where: {
          scope_key: {
            scope: input.scope,
            key: input.key,
          },
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          response: this.toJsonValue(result),
          lockedUntil: null,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.idempotencyRecord.update({
        where: {
          scope_key: {
            scope: input.scope,
            key: input.key,
          },
        },
        data: {
          status: IdempotencyStatus.FAILED,
          lockedUntil: null,
        },
      });
      throw error;
    }
  }

  private normalizedIdempotencyKey(idempotencyKey?: string, actionLabel = 'checkout'): string {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Idempotency-Key header is required for ${actionLabel}`,
      });
    }
    if (key.length > 120) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header must be 120 characters or fewer',
      });
    }

    return key;
  }

  private hashRequest(value: unknown): string {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  private idempotencyInProgressData(requestHash: string): {
    status: IdempotencyStatus;
    requestHash: string;
    lockedUntil: Date;
    expiresAt: Date;
  } {
    return {
      status: IdempotencyStatus.IN_PROGRESS,
      requestHash,
      lockedUntil: this.minutesFromNow(2),
      expiresAt: this.hoursFromNow(24),
    };
  }

  private minutesFromNow(minutes: number): Date {
    return new Date(Date.now() + minutes * 60_000);
  }

  private hoursFromNow(hours: number): Date {
    return new Date(Date.now() + hours * 3_600_000);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private ensureFarmerPermission(actor: CurrentUser, permission: PermissionCode): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw this.forbidden('Farmer role is required');
    }
    if (!this.accessService.hasPermission(actor, permission)) {
      throw this.forbidden('Farmer checkout permission is required');
    }
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }

  private throwConflictForKnownUniqueError(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message,
      });
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }
}
