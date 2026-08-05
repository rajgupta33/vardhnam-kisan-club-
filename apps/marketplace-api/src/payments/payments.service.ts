import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IdempotencyStatus,
  PaymentEventType,
  PaymentIntentStatus,
  PaymentProviderMode,
  PlatformRole,
  Prisma,
  ProductCheckoutStatus,
  ProductOrderStatus,
  type FarmerProfile,
  type PaymentIntent,
  type ProductCheckout,
  type ProductOrder,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmMockPaymentIntentDto } from './dto/confirm-mock-payment-intent.dto';
import { MockPaymentOutcome } from './dto/confirm-mock-payment-intent.dto';
import type { CreateMockPaymentIntentDto } from './dto/create-mock-payment-intent.dto';
import type { ListPaymentIntentsQueryDto } from './dto/list-payment-intents-query.dto';

const paymentCheckoutInclude = Prisma.validator<Prisma.ProductCheckoutInclude>()({
  orders: {
    orderBy: { createdAt: 'asc' },
  },
});

const paymentIntentDetailInclude = Prisma.validator<Prisma.PaymentIntentInclude>()({
  checkout: {
    include: paymentCheckoutInclude,
  },
  events: {
    orderBy: { createdAt: 'asc' },
  },
});

type PaymentClient = PrismaService | Prisma.TransactionClient;
type PaymentCheckoutWithOrders = Prisma.ProductCheckoutGetPayload<{
  include: typeof paymentCheckoutInclude;
}>;
type PaymentIntentWithDetails = Prisma.PaymentIntentGetPayload<{
  include: typeof paymentIntentDetailInclude;
}>;

interface IdempotencyInput {
  scope: string;
  key: string;
  requestHash: string;
  differentRequestMessage: string;
  inProgressMessage: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly financeService: FinanceService,
  ) {}

  async createMockPaymentIntent(
    dto: CreateMockPaymentIntentDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(
      actor,
      PermissionCode.PAYMENTS_CREATE_OWN,
      'Farmer payment creation permission is required',
    );
    const key = this.normalizedIdempotencyKey(idempotencyKey);

    return this.runIdempotent(
      {
        scope: `payments:create-mock-intent:${actor.userId}`,
        key,
        requestHash: this.hashRequest({ actorUserId: actor.userId, dto }),
        differentRequestMessage:
          'Idempotency key was already used for a different payment intent request',
        inProgressMessage: 'Payment intent request is already in progress',
      },
      () => this.createMockPaymentIntentInTransaction(dto, actor, requestId),
    );
  }

  async confirmMockPaymentIntent(
    paymentIntentId: string,
    dto: ConfirmMockPaymentIntentDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensureFarmerPermission(
      actor,
      PermissionCode.PAYMENTS_CONFIRM_OWN,
      'Farmer payment confirmation permission is required',
    );
    const key = this.normalizedIdempotencyKey(idempotencyKey);

    return this.runIdempotent(
      {
        scope: `payments:confirm-mock-intent:${actor.userId}:${paymentIntentId}`,
        key,
        requestHash: this.hashRequest({ actorUserId: actor.userId, paymentIntentId, dto }),
        differentRequestMessage:
          'Idempotency key was already used for a different payment confirmation request',
        inProgressMessage: 'Payment confirmation request is already in progress',
      },
      () => this.confirmMockPaymentIntentInTransaction(paymentIntentId, dto, actor, requestId),
    );
  }

  async listMyPaymentIntents(query: ListPaymentIntentsQueryDto, actor: CurrentUser) {
    this.ensureFarmerPermission(
      actor,
      PermissionCode.PAYMENTS_READ_OWN,
      'Farmer payment read permission is required',
    );
    const profile = await this.findProfileForActorOrThrow(actor);
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.PaymentIntentWhereInput = {
      farmerProfileId: profile.id,
    };

    if (query.checkoutId) {
      where.checkoutId = query.checkoutId;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentIntent.findMany({
        where,
        include: paymentIntentDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentIntent.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toPaymentIntentDetail(item)),
      page,
      limit,
      total,
    };
  }

  async getMyPaymentIntent(paymentIntentId: string, actor: CurrentUser) {
    this.ensureFarmerPermission(
      actor,
      PermissionCode.PAYMENTS_READ_OWN,
      'Farmer payment read permission is required',
    );
    const profile = await this.findProfileForActorOrThrow(actor);
    const paymentIntent = await this.findPaymentIntentForProfileOrThrow(
      this.prisma,
      paymentIntentId,
      profile.id,
    );

    return this.toPaymentIntentDetail(paymentIntent);
  }

  private async createMockPaymentIntentInTransaction(
    dto: CreateMockPaymentIntentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await this.findProfileForActorOrThrow(actor, tx);
        const checkout = await this.findCheckoutForProfileOrThrow(tx, dto.checkoutId, profile.id);

        const existingSucceededIntent = await tx.paymentIntent.findFirst({
          where: {
            checkoutId: checkout.id,
            status: PaymentIntentStatus.SUCCEEDED,
          },
          include: paymentIntentDetailInclude,
          orderBy: { createdAt: 'desc' },
        });
        if (existingSucceededIntent || checkout.status === ProductCheckoutStatus.PAID) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Checkout already has a successful payment',
          });
        }

        const existingOpenIntent = await tx.paymentIntent.findFirst({
          where: {
            checkoutId: checkout.id,
            status: { in: [PaymentIntentStatus.PENDING, PaymentIntentStatus.PROCESSING] },
          },
          include: paymentIntentDetailInclude,
          orderBy: { createdAt: 'desc' },
        });
        if (existingOpenIntent) {
          if (checkout.status !== ProductCheckoutStatus.PAYMENT_PROCESSING) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'Checkout has an inconsistent open mock payment attempt',
            });
          }

          return this.toPaymentIntentDetail(existingOpenIntent);
        }

        this.ensureCheckoutCanStartPayment(checkout);

        const previousCheckout = checkout;
        const providerReference = `mock_${randomUUID()}`;
        const paymentIntent = await tx.paymentIntent.create({
          data: {
            checkoutId: checkout.id,
            farmerProfileId: profile.id,
            providerMode: PaymentProviderMode.MOCK,
            providerReference,
            status: PaymentIntentStatus.PROCESSING,
            amountPaise: checkout.subtotalPaise,
            currency: 'INR',
          },
        });

        await this.recordPaymentEvent(tx, {
          paymentIntent,
          eventType: PaymentEventType.INTENT_CREATED,
          status: PaymentIntentStatus.PROCESSING,
          actor,
          requestId,
          payload: {
            checkoutId: checkout.id,
            amountPaise: checkout.subtotalPaise,
            currency: 'INR',
            providerMode: PaymentProviderMode.MOCK,
          },
        });

        const updatedCheckout = await tx.productCheckout.update({
          where: { id: checkout.id },
          data: {
            status: ProductCheckoutStatus.PAYMENT_PROCESSING,
          },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'PRODUCT_CHECKOUT_PAYMENT_PROCESSING',
            resourceType: 'ProductCheckout',
            resourceId: updatedCheckout.id,
            previousValue: this.checkoutAuditValue(previousCheckout),
            newValue: this.checkoutAuditValue(updatedCheckout),
            requestId,
            reason: dto.reason,
          }),
          tx,
        );

        await this.transitionProductOrders(tx, {
          orders: checkout.orders,
          toStatus: ProductOrderStatus.PAYMENT_PROCESSING,
          action: 'PRODUCT_ORDER_PAYMENT_PROCESSING',
          actor,
          requestId,
          reason: dto.reason ?? 'Mock payment intent created',
        });

        await this.auditService.record(
          this.withActor(actor, {
            action: 'MOCK_PAYMENT_INTENT_CREATED',
            resourceType: 'PaymentIntent',
            resourceId: paymentIntent.id,
            newValue: this.paymentIntentAuditValue(paymentIntent),
            requestId,
            reason: dto.reason,
          }),
          tx,
        );

        const savedPaymentIntent = await this.findPaymentIntentForProfileOrThrow(
          tx,
          paymentIntent.id,
          profile.id,
        );
        return this.toPaymentIntentDetail(savedPaymentIntent);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private async confirmMockPaymentIntentInTransaction(
    paymentIntentId: string,
    dto: ConfirmMockPaymentIntentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await this.findProfileForActorOrThrow(actor, tx);
        const paymentIntent = await this.findPaymentIntentForProfileOrThrow(
          tx,
          paymentIntentId,
          profile.id,
        );

        if (
          paymentIntent.status === PaymentIntentStatus.SUCCEEDED ||
          paymentIntent.status === PaymentIntentStatus.FAILED
        ) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Payment intent has already reached a terminal status',
          });
        }

        this.ensurePaymentIntentCanBeConfirmed(paymentIntent);

        await this.recordPaymentEvent(tx, {
          paymentIntent,
          eventType: PaymentEventType.CONFIRMATION_STARTED,
          status: PaymentIntentStatus.PROCESSING,
          actor,
          requestId,
          payload: {
            outcome: dto.outcome,
            failureCode: dto.failureCode ?? null,
          },
        });

        const isSuccess = dto.outcome === MockPaymentOutcome.SUCCESS;
        const nextPaymentStatus = isSuccess
          ? PaymentIntentStatus.SUCCEEDED
          : PaymentIntentStatus.FAILED;
        const nextCheckoutStatus = isSuccess
          ? ProductCheckoutStatus.PAID
          : ProductCheckoutStatus.PAYMENT_FAILED;
        const nextOrderStatus = isSuccess
          ? ProductOrderStatus.CONFIRMED
          : ProductOrderStatus.PAYMENT_FAILED;
        const paymentAuditAction = isSuccess ? 'MOCK_PAYMENT_CONFIRMED' : 'MOCK_PAYMENT_FAILED';
        const checkoutAuditAction = isSuccess
          ? 'PRODUCT_CHECKOUT_PAYMENT_PAID'
          : 'PRODUCT_CHECKOUT_PAYMENT_FAILED';
        const orderAuditAction = isSuccess
          ? 'PRODUCT_ORDER_PAYMENT_CONFIRMED'
          : 'PRODUCT_ORDER_PAYMENT_FAILED';

        const updatedPaymentIntent = await tx.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: nextPaymentStatus,
            failureCode: isSuccess ? null : (dto.failureCode ?? 'MOCK_PAYMENT_FAILED'),
            failureMessage: isSuccess
              ? null
              : (dto.failureMessage ?? 'Mock payment failed for local testing'),
          },
        });
        await this.recordPaymentEvent(tx, {
          paymentIntent: updatedPaymentIntent,
          eventType: isSuccess
            ? PaymentEventType.PAYMENT_SUCCEEDED
            : PaymentEventType.PAYMENT_FAILED,
          status: nextPaymentStatus,
          actor,
          requestId,
          payload: {
            outcome: dto.outcome,
            failureCode: updatedPaymentIntent.failureCode ?? null,
            failureMessage: updatedPaymentIntent.failureMessage ?? null,
          },
        });

        const updatedCheckout = await tx.productCheckout.update({
          where: { id: paymentIntent.checkoutId },
          data: {
            status: nextCheckoutStatus,
          },
        });

        await this.auditService.record(
          this.withActor(actor, {
            action: checkoutAuditAction,
            resourceType: 'ProductCheckout',
            resourceId: updatedCheckout.id,
            previousValue: this.checkoutAuditValue(paymentIntent.checkout),
            newValue: this.checkoutAuditValue(updatedCheckout),
            requestId,
            reason: dto.reason,
          }),
          tx,
        );

        await this.transitionProductOrders(tx, {
          orders: paymentIntent.checkout.orders,
          toStatus: nextOrderStatus,
          action: orderAuditAction,
          actor,
          requestId,
          reason: dto.reason ?? (isSuccess ? 'Mock payment confirmed' : 'Mock payment failed'),
        });

        if (isSuccess) {
          await this.financeService.recordFarmerPayment(tx, updatedPaymentIntent, actor, requestId);
        }

        await this.auditService.record(
          this.withActor(actor, {
            action: paymentAuditAction,
            resourceType: 'PaymentIntent',
            resourceId: updatedPaymentIntent.id,
            previousValue: this.paymentIntentAuditValue(paymentIntent),
            newValue: this.paymentIntentAuditValue(updatedPaymentIntent),
            requestId,
            reason: dto.reason,
          }),
          tx,
        );

        const savedPaymentIntent = await this.findPaymentIntentForProfileOrThrow(
          tx,
          paymentIntent.id,
          profile.id,
        );
        return this.toPaymentIntentDetail(savedPaymentIntent);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  private ensureCheckoutCanStartPayment(checkout: PaymentCheckoutWithOrders): void {
    if (checkout.status === ProductCheckoutStatus.PAYMENT_PROCESSING) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Checkout already has a mock payment attempt in progress',
      });
    }
    if (
      checkout.status !== ProductCheckoutStatus.PENDING_PAYMENT &&
      checkout.status !== ProductCheckoutStatus.PAYMENT_FAILED
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout is not ready for mock payment',
      });
    }
    if (checkout.orders.length === 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout must contain at least one child order before payment',
      });
    }
    if (checkout.subtotalPaise <= 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout subtotal must be greater than zero before payment',
      });
    }

    const childOrderSubtotal = checkout.orders.reduce(
      (total, order) => total + order.subtotalPaise,
      0,
    );
    if (childOrderSubtotal !== checkout.subtotalPaise) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout subtotal does not match child order totals',
      });
    }

    for (const order of checkout.orders) {
      if (
        order.status !== ProductOrderStatus.INVENTORY_RESERVED &&
        order.status !== ProductOrderStatus.PAYMENT_FAILED
      ) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'All child orders must have reserved inventory before payment',
        });
      }
    }
  }

  private ensurePaymentIntentCanBeConfirmed(paymentIntent: PaymentIntentWithDetails): void {
    if (
      paymentIntent.checkout.status !== ProductCheckoutStatus.PAYMENT_PROCESSING &&
      paymentIntent.checkout.status !== ProductCheckoutStatus.PENDING_PAYMENT
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout is not ready for payment confirmation',
      });
    }

    for (const order of paymentIntent.checkout.orders) {
      if (
        order.status !== ProductOrderStatus.PAYMENT_PROCESSING &&
        order.status !== ProductOrderStatus.INVENTORY_RESERVED
      ) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'All child orders must be in payment processing before confirmation',
        });
      }
    }
  }

  private async transitionProductOrders(
    tx: Prisma.TransactionClient,
    input: {
      orders: ProductOrder[];
      toStatus: ProductOrderStatus;
      action: string;
      actor: CurrentUser;
      requestId?: string | undefined;
      reason: string;
    },
  ): Promise<void> {
    for (const order of input.orders) {
      if (order.status === input.toStatus) {
        continue;
      }

      const updatedOrder = await tx.productOrder.update({
        where: { id: order.id },
        data: {
          status: input.toStatus,
        },
      });

      await tx.productOrderStatusHistory.create({
        data: {
          productOrderId: order.id,
          fromStatus: order.status,
          toStatus: input.toStatus,
          actorUserId: input.actor.userId,
          actorRole: input.actor.role,
          requestId: input.requestId ?? null,
          reason: input.reason,
        },
      });

      await this.auditService.record(
        this.withActor(input.actor, {
          action: input.action,
          resourceType: 'ProductOrder',
          resourceId: order.id,
          organisationId: order.sellerOrganisationId,
          previousValue: this.productOrderAuditValue(order),
          newValue: this.productOrderAuditValue(updatedOrder),
          requestId: input.requestId,
          reason: input.reason,
        }),
        tx,
      );
    }
  }

  private async recordPaymentEvent(
    tx: Prisma.TransactionClient,
    input: {
      paymentIntent: PaymentIntent;
      eventType: PaymentEventType;
      status: PaymentIntentStatus;
      actor: CurrentUser;
      requestId?: string | undefined;
      payload?: Prisma.InputJsonObject | undefined;
    },
  ): Promise<void> {
    const data: Prisma.PaymentEventUncheckedCreateInput = {
      paymentIntentId: input.paymentIntent.id,
      eventType: input.eventType,
      status: input.status,
      providerReference: input.paymentIntent.providerReference,
      actorUserId: input.actor.userId,
      actorRole: input.actor.role,
      requestId: input.requestId ?? null,
    };
    if (input.payload !== undefined) {
      data.payload = input.payload;
    }

    await tx.paymentEvent.create({
      data,
    });
  }

  private async findCheckoutForProfileOrThrow(
    client: PaymentClient,
    checkoutId: string,
    farmerProfileId: string,
  ): Promise<PaymentCheckoutWithOrders> {
    const checkout = await client.productCheckout.findFirst({
      where: {
        id: checkoutId,
        farmerProfileId,
      },
      include: paymentCheckoutInclude,
    });

    if (!checkout) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product checkout was not found',
      });
    }

    return checkout;
  }

  private async findPaymentIntentForProfileOrThrow(
    client: PaymentClient,
    paymentIntentId: string,
    farmerProfileId: string,
  ): Promise<PaymentIntentWithDetails> {
    const paymentIntent = await client.paymentIntent.findFirst({
      where: {
        id: paymentIntentId,
        farmerProfileId,
      },
      include: paymentIntentDetailInclude,
    });

    if (!paymentIntent) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Payment intent was not found',
      });
    }

    return paymentIntent;
  }

  private async findProfileForActorOrThrow(
    actor: CurrentUser,
    client: PaymentClient = this.prisma,
  ): Promise<FarmerProfile> {
    const profile = await client.farmerProfile.findUnique({
      where: { userId: actor.userId },
    });

    if (!profile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before payment',
      });
    }

    return profile;
  }

  private toPaymentIntentDetail(paymentIntent: PaymentIntentWithDetails) {
    return {
      id: paymentIntent.id,
      checkoutId: paymentIntent.checkoutId,
      farmerProfileId: paymentIntent.farmerProfileId,
      providerMode: paymentIntent.providerMode,
      providerReference: paymentIntent.providerReference,
      status: paymentIntent.status,
      amountPaise: paymentIntent.amountPaise,
      currency: paymentIntent.currency,
      failureCode: paymentIntent.failureCode,
      failureMessage: paymentIntent.failureMessage,
      checkout: {
        id: paymentIntent.checkout.id,
        status: paymentIntent.checkout.status,
        subtotalPaise: paymentIntent.checkout.subtotalPaise,
        itemCount: paymentIntent.checkout.itemCount,
        childOrderCount: paymentIntent.checkout.childOrderCount,
        orders: paymentIntent.checkout.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          sellerOrganisationId: order.sellerOrganisationId,
          sellerNameSnapshot: order.sellerNameSnapshot,
          subtotalPaise: order.subtotalPaise,
          itemCount: order.itemCount,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        createdAt: paymentIntent.checkout.createdAt,
        updatedAt: paymentIntent.checkout.updatedAt,
      },
      events: paymentIntent.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        status: event.status,
        providerReference: event.providerReference,
        payload: event.payload,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        requestId: event.requestId,
        createdAt: event.createdAt,
      })),
      createdAt: paymentIntent.createdAt,
      updatedAt: paymentIntent.updatedAt,
    };
  }

  private checkoutAuditValue(checkout: ProductCheckout): Prisma.InputJsonObject {
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

  private paymentIntentAuditValue(paymentIntent: PaymentIntent): Prisma.InputJsonObject {
    return {
      checkoutId: paymentIntent.checkoutId,
      farmerProfileId: paymentIntent.farmerProfileId,
      providerMode: paymentIntent.providerMode,
      providerReference: paymentIntent.providerReference,
      status: paymentIntent.status,
      amountPaise: paymentIntent.amountPaise,
      currency: paymentIntent.currency,
      failureCode: paymentIntent.failureCode,
      failureMessage: paymentIntent.failureMessage,
    };
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

  private normalizedIdempotencyKey(idempotencyKey?: string): string {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header is required for mock payment actions',
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

  private ensureFarmerPermission(
    actor: CurrentUser,
    permission: PermissionCode,
    message: string,
  ): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw this.forbidden('Farmer role is required');
    }
    if (!this.accessService.hasPermission(actor, permission)) {
      throw this.forbidden(message);
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
