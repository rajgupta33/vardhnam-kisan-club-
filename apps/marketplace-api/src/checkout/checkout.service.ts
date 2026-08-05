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
  DistributorOfferStatus,
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
import { PrismaService } from '../prisma/prisma.service';
import type { AssignDeliveryDto } from './dto/assign-delivery.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CheckoutFromCartDto } from './dto/checkout-from-cart.dto';
import type { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import type { FulfilmentOrderDecisionDto } from './dto/fulfilment-order-decision.dto';
import type { GenerateProductInvoiceDto } from './dto/generate-product-invoice.dto';
import type { ListFulfilmentOrdersQueryDto } from './dto/list-fulfilment-orders-query.dto';
import type { ListMyOrdersQueryDto } from './dto/list-my-orders-query.dto';

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

interface PreparedCheckoutItem {
  cartItem: CartItem;
  offer: CheckoutOffer;
  unitPricePaise: number;
  lineTotalPaise: number;
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
  ) {}

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
        let invoice: ProductInvoice;
        try {
          invoice = await tx.productInvoice.create({
            data: {
              productOrderId: order.id,
              checkoutId: order.checkoutId,
              farmerProfileId: order.farmerProfileId,
              sellerOrganisationId: order.sellerOrganisationId,
              invoiceNumber: this.generateInvoiceNumber(),
              status: ProductInvoiceStatus.GENERATED,
              currency: 'INR',
              subtotalPaise: order.subtotalPaise,
              taxPaise: 0,
              totalPaise: order.subtotalPaise,
              itemCount: order.itemCount,
              sellerLegalNameSnapshot: seller.legalName,
              sellerDisplayNameSnapshot: seller.displayName,
              sellerGstinSnapshot: seller.gstin,
              farmerNameSnapshot: farmer.fullName,
              deliveryAddressSnapshot: this.toJsonValue(order.deliveryAddressSnapshot),
              lineItemsSnapshot: this.invoiceLineItemsSnapshot(order),
              generatedByUserId: actor.userId,
              generatedByRole: actor.role,
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
        return this.toOrderDetail(savedOrder, { mockDeliveryOtpCode: otp.code });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
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
        const assignment = this.ensureOutForDeliveryAllowed(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);

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

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async completeFulfilmentOrderDelivery(
    orderId: string,
    dto: CompleteDeliveryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = dto.proofNote?.trim() || 'Delivery completed after OTP verification';

    return this.prisma.$transaction(
      async (tx) => {
        const order = await this.findProductOrderDetailOrThrow(tx, orderId);
        const assignment = this.ensureDeliveryCompletionAllowed(order);
        this.ensureDeliveryAssignmentManageAccess(actor, assignment);
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

        const savedOrder = await this.findProductOrderDetailOrThrow(tx, order.id);
        return this.toOrderDetail(savedOrder);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
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

        const deliveryAddress = await this.resolveCheckoutAddress(tx, dto, profile, cart);
        const pincode = deliveryAddress.pincode;
        this.ensureCartPincodeMatchesAddress(cart, pincode);

        const preparedItems = await this.prepareCartItemsForCheckout(tx, cart, pincode);
        const itemsBySeller = this.groupItemsBySeller(preparedItems);
        const subtotalPaise = preparedItems.reduce((total, item) => total + item.lineTotalPaise, 0);

        const checkout = await tx.productCheckout.create({
          data: {
            farmerProfileId: profile.id,
            sourceCartId: cart.id,
            deliveryAddressId: deliveryAddress.id,
            serviceablePincode: pincode,
            status: ProductCheckoutStatus.PENDING_PAYMENT,
            subtotalPaise,
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

        for (const sellerItems of itemsBySeller.values()) {
          await this.createChildOrderWithReservations(tx, {
            actor,
            checkoutId: checkout.id,
            farmerProfileId: profile.id,
            deliveryAddress,
            items: sellerItems,
            requestId,
            reason: dto.reason,
          });
        }

        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
        const clearedCart = await tx.cart.update({
          where: { id: cart.id },
          data: {
            deliveryAddressId: null,
            serviceablePincode: null,
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
        return this.toCheckoutDetail(savedCheckout);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
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

  private async fulfilmentOrderWhere(
    query: ListFulfilmentOrdersQueryDto,
    actor: CurrentUser,
    accessMode: 'read' | 'manage',
  ): Promise<Prisma.ProductOrderWhereInput> {
    const sellerOrganisationId = await this.resolveFulfilmentSellerOrganisationId(
      actor,
      accessMode,
      query.sellerOrganisationId,
    );
    const where: Prisma.ProductOrderWhereInput = {
      orderType: OrderType.PRODUCT_ORDER,
      ...(sellerOrganisationId ? { sellerOrganisationId } : {}),
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

    await this.ensureFulfilmentOrderAccess(client, actor, accessMode, order.sellerOrganisationId);
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
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery partner user must be active before assignment',
      });
    }
    const activeMembership = user.memberships.find(
      (membership) => membership.organisation.status === OrganisationStatus.ACTIVE,
    );
    if (!activeMembership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Delivery partner must have an active delivery partner membership',
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
    if (assignment.status !== ProductDeliveryAssignmentStatus.ASSIGNED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Only assigned deliveries can move out for delivery',
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
    },
  ): Promise<void> {
    const seller = input.items[0]?.offer.distributorOrganisation;
    if (!seller) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Product order requires at least one seller item',
      });
    }
    const subtotalPaise = input.items.reduce((total, item) => total + item.lineTotalPaise, 0);
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
          productNameSnapshot: preparedItem.offer.product.name,
          variantNameSnapshot: preparedItem.offer.variant.variantName,
          sellerNameSnapshot: preparedItem.offer.distributorOrganisation.displayName,
          warehouseNameSnapshot: preparedItem.offer.warehouse.name,
          fulfilmentModeSnapshot: preparedItem.offer.fulfilmentMode,
          deliverySlaDaysSnapshot: preparedItem.offer.deliverySlaDays,
        },
      });

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
  }

  private async prepareCartItemsForCheckout(
    tx: Prisma.TransactionClient,
    cart: CheckoutCart,
    pincode: string,
  ): Promise<PreparedCheckoutItem[]> {
    const preparedItems: PreparedCheckoutItem[] = [];
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

      preparedItems.push({
        cartItem,
        offer,
        unitPricePaise: offer.sellingPricePaise,
        lineTotalPaise: offer.sellingPricePaise * cartItem.quantity,
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
      taxPaise: invoice.taxPaise,
      totalPaise: invoice.totalPaise,
      itemCount: invoice.itemCount,
      sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
      sellerDisplayNameSnapshot: invoice.sellerDisplayNameSnapshot,
      sellerGstinSnapshot: invoice.sellerGstinSnapshot,
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
      readyAt: dispatch.readyAt,
      createdAt: dispatch.createdAt,
      updatedAt: dispatch.updatedAt,
    };
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
      taxPaise: invoice.taxPaise,
      totalPaise: invoice.totalPaise,
      itemCount: invoice.itemCount,
      sellerLegalNameSnapshot: invoice.sellerLegalNameSnapshot,
      sellerDisplayNameSnapshot: invoice.sellerDisplayNameSnapshot,
      sellerGstinSnapshot: invoice.sellerGstinSnapshot,
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

  private invoiceLineItemsSnapshot(order: ProductOrderWithDetails): Prisma.InputJsonValue {
    return this.toJsonValue(
      order.items.map((item) => ({
        productOrderItemId: item.id,
        offerId: item.offerId,
        distributorOrganisationId: item.distributorOrganisationId,
        productId: item.productId,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        lineTotalPaise: item.lineTotalPaise,
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
      })),
    );
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

  private generateInvoiceNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `INV-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
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
