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
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmMockPaymentIntentDto } from './dto/confirm-mock-payment-intent.dto';
import { MockPaymentOutcome } from './dto/confirm-mock-payment-intent.dto';
import type { CreateMockPaymentIntentDto } from './dto/create-mock-payment-intent.dto';
import type { ListPaymentIntentsQueryDto } from './dto/list-payment-intents-query.dto';
import { PaymentSettlementService } from './payment-settlement.service';
import {
  checkoutAuditValue,
  paymentIntentAuditValue,
  paymentIntentDetailInclude,
  paymentCheckoutInclude,
  toPaymentIntentDetail,
  type PaymentCheckoutWithOrders,
  type PaymentClient,
  type PaymentIntentWithDetails,
} from './payment-shapes';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

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
    private readonly settlementService: PaymentSettlementService,
    private readonly providerRegistry: PaymentProviderRegistry,
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
      items: items.map((item) => toPaymentIntentDetail(item)),
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

    return toPaymentIntentDetail(paymentIntent);
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

          return toPaymentIntentDetail(existingOpenIntent);
        }

        this.ensureCheckoutCanStartPayment(checkout);

        const previousCheckout = checkout;
        const provider = this.providerRegistry.current();
        const amountPaise = checkout.farmerPayablePaise ?? checkout.subtotalPaise;
        // Our reference is minted before the gateway is asked, so a create call
        // that times out after the gateway acted can still be reconciled: the
        // reference we would have used is the one the gateway echoes back.
        const reference = `${provider.name}_${randomUUID()}`;
        const created = await provider.createIntent({
          reference,
          amountPaise,
          currency: 'INR',
          notes: { checkoutId: checkout.id, farmerProfileId: profile.id },
        });

        const paymentIntent = await tx.paymentIntent.create({
          data: {
            checkoutId: checkout.id,
            farmerProfileId: profile.id,
            providerMode: provider.mode,
            providerReference: created.providerReference,
            status: PaymentIntentStatus.PROCESSING,
            amountPaise,
            currency: 'INR',
          },
        });

        await this.settlementService.recordPaymentEvent(tx, {
          paymentIntent,
          eventType: PaymentEventType.INTENT_CREATED,
          status: PaymentIntentStatus.PROCESSING,
          actor,
          requestId,
          payload: {
            checkoutId: checkout.id,
            amountPaise,
            currency: 'INR',
            providerMode: provider.mode,
            provider: provider.name,
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
            previousValue: checkoutAuditValue(previousCheckout),
            newValue: checkoutAuditValue(updatedCheckout),
            requestId,
            reason: dto.reason,
          }),
          tx,
        );

        await this.settlementService.transitionProductOrders(tx, {
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
            newValue: paymentIntentAuditValue(paymentIntent),
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
        return toPaymentIntentDetail(savedPaymentIntent);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * The farmer-facing mock confirmation.
   *
   * Only meaningful while `PAYMENT_PROVIDER=mock`. With a real gateway the
   * client never decides the outcome -- a redirect back from a payment page is
   * not proof of payment -- so this path refuses to run and the intent settles
   * from a signature-verified webhook instead.
   */
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

        if (paymentIntent.providerMode !== PaymentProviderMode.MOCK) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'This payment must be confirmed by the provider, not by the client',
          });
        }

        if (this.settlementService.isTerminal(paymentIntent)) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Payment intent has already reached a terminal status',
          });
        }

        this.settlementService.ensureCanSettle(paymentIntent);

        const isSuccess = dto.outcome === MockPaymentOutcome.SUCCESS;
        await this.settlementService.settle(tx, {
          paymentIntent,
          outcome: isSuccess ? PaymentIntentStatus.SUCCEEDED : PaymentIntentStatus.FAILED,
          actor,
          requestId,
          source: 'mock-confirm',
          reason: dto.reason ?? (isSuccess ? 'Mock payment confirmed' : 'Mock payment failed'),
          failureCode: isSuccess ? undefined : (dto.failureCode ?? 'MOCK_PAYMENT_FAILED'),
          failureMessage: isSuccess
            ? undefined
            : (dto.failureMessage ?? 'Mock payment failed for local testing'),
        });

        const savedPaymentIntent = await this.findPaymentIntentForProfileOrThrow(
          tx,
          paymentIntent.id,
          profile.id,
        );
        return toPaymentIntentDetail(savedPaymentIntent);
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
    const checkoutBenefitPaise = checkout.clubBenefitPaise ?? 0;
    const checkoutFarmerPayablePaise = checkout.farmerPayablePaise ?? checkout.subtotalPaise;
    if (checkout.subtotalPaise <= 0 || checkoutFarmerPayablePaise < 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout financial totals are invalid before payment',
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
    const childOrderBenefits = checkout.orders.reduce(
      (total, order) => total + (order.clubBenefitPaise ?? 0),
      0,
    );
    const childOrderPayable = checkout.orders.reduce(
      (total, order) => total + (order.farmerPayablePaise ?? order.subtotalPaise),
      0,
    );
    if (
      childOrderBenefits !== checkoutBenefitPaise ||
      childOrderPayable !== checkoutFarmerPayablePaise ||
      checkoutFarmerPayablePaise + checkoutBenefitPaise !== checkout.subtotalPaise
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Checkout benefit totals do not match child order totals',
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
