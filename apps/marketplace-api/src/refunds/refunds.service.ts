import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialLedgerEntryType,
  PaymentIntentStatus,
  PaymentProviderMode,
  Prisma,
  ProductOrderStatus,
  RefundEventType,
  RefundMethod,
  RefundStatus,
  ReturnInspectionOutcome,
  ReturnRequestStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { FinanceService } from '../finance/finance.service';
import { PaymentWebhookJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import {
  FarmerNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRefundResult,
  PaymentProvider,
} from '../payments/providers/payment-provider.interface';
import { PaymentProviderRegistry } from '../payments/providers/payment-provider.registry';
import type { ConfirmMockRefundDto } from './dto/confirm-mock-refund.dto';
import { MockRefundOutcome } from './dto/confirm-mock-refund.dto';
import type { CreateRefundDto } from './dto/create-refund.dto';
import type { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { CreditNotesService } from './credit-notes.service';

const refundDetailInclude = Prisma.validator<Prisma.RefundInclude>()({
  events: { orderBy: { createdAt: 'asc' } },
  productOrder: {
    select: {
      orderNumber: true,
      sellerNameSnapshot: true,
      sellerOrganisationId: true,
      status: true,
    },
  },
  returnRequest: { select: { status: true, reasonCode: true } },
  paymentIntent: { select: { providerReference: true, status: true } },
});

const refundableReturnInclude = Prisma.validator<Prisma.ReturnRequestInclude>()({
  refunds: true,
  productOrder: {
    include: {
      checkout: {
        include: {
          paymentIntents: {
            where: { status: PaymentIntentStatus.SUCCEEDED },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  },
});

type RefundWithDetails = Prisma.RefundGetPayload<{ include: typeof refundDetailInclude }>;

interface QueuedRefundEventPayload {
  outcome: MockRefundOutcome;
  failureReason?: string;
  actorMembershipId: string;
  actorOrganisationId: string;
}

export function refundExecutionJobId(refundEventId: string): string {
  return `execute-refund-${refundEventId}`;
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly financeService: FinanceService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly queueService: QueueService,
    private readonly creditNotesService: CreditNotesService,
  ) {}

  async create(
    dto: CreateRefundDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensurePermission(
      actor,
      PermissionCode.REFUNDS_CREATE_ANY,
      'Refund creation permission is required',
    );
    const key = this.normalizedIdempotencyKey(idempotencyKey);
    const replay = await this.prisma.refund.findUnique({
      where: { idempotencyKey: key },
      include: refundDetailInclude,
    });
    if (replay) {
      if (replay.returnRequestId !== dto.returnRequestId) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Idempotency key was already used for a different refund request',
        });
      }
      return this.toRefund(replay);
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const request = await tx.returnRequest.findUnique({
            where: { id: dto.returnRequestId },
            include: refundableReturnInclude,
          });
          if (!request) {
            throw new NotFoundException({
              code: ApiErrorCode.NOT_FOUND,
              message: 'Return request was not found',
            });
          }
          if (
            request.status !== ReturnRequestStatus.INSPECTED ||
            !request.approvedRefundAmountPaise ||
            request.approvedRefundAmountPaise <= 0
          ) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Only an inspected return with an approved amount can be refunded',
            });
          }
          if (request.refunds.length > 0) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'A refund already exists for this return request',
            });
          }
          if (request.productOrder.status !== ProductOrderStatus.RETURNED) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'The product order is not ready for refund initiation',
            });
          }
          const paymentIntent = request.productOrder.checkout.paymentIntents[0];
          if (!paymentIntent) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'No successful payment intent exists for this order checkout',
            });
          }

          const refund = await tx.refund.create({
            data: {
              productOrderId: request.productOrderId,
              returnRequestId: request.id,
              paymentIntentId: paymentIntent.id,
              farmerUserId: request.farmerUserId,
              amountPaise: request.approvedRefundAmountPaise,
              method: RefundMethod.ORIGINAL_PAYMENT_METHOD,
              providerMode: paymentIntent.providerMode,
              idempotencyKey: key,
              initiatedByUserId: actor.userId,
              events: {
                create: {
                  eventType: RefundEventType.REFUND_CREATED,
                  status: RefundStatus.PENDING,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  requestId: requestId ?? null,
                },
              },
            },
          });
          await tx.productOrder.update({
            where: { id: request.productOrderId },
            data: {
              status: ProductOrderStatus.REFUND_PENDING,
              statusHistory: {
                create: {
                  fromStatus: ProductOrderStatus.RETURNED,
                  toStatus: ProductOrderStatus.REFUND_PENDING,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason: 'Refund initiated after return inspection',
                  requestId: requestId ?? null,
                },
              },
            },
          });
          await this.auditService.record(
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              organisationId: request.distributorOrganisationId,
              action: 'REFUND_INITIATED',
              resourceType: 'Refund',
              resourceId: refund.id,
              newValue: {
                productOrderId: refund.productOrderId,
                returnRequestId: refund.returnRequestId,
                amountPaise: refund.amountPaise,
                method: refund.method,
                status: refund.status,
                providerMode: refund.providerMode,
              },
              requestId,
              reason: 'Approved return refund initiated',
            },
            tx,
          );

          await this.notificationEventsService.emitFarmerEvent(tx, {
            event: FarmerNotificationEvent.REFUND_INITIATED,
            recipientUserId: request.farmerUserId,
            returnRequestId: request.id,
            productOrderId: request.productOrderId,
            orderNumber: request.productOrder.orderNumber,
            actorUserId: actor.userId,
            actorRole: actor.role,
            requestId,
            refundId: refund.id,
            amountPaise: refund.amountPaise,
          });

          const saved = await tx.refund.findUniqueOrThrow({
            where: { id: refund.id },
            include: refundDetailInclude,
          });
          return this.toRefund(saved);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const existing = await this.prisma.refund.findUnique({
          where: { idempotencyKey: key },
          include: refundDetailInclude,
        });
        if (existing?.returnRequestId === dto.returnRequestId) {
          return this.toRefund(existing);
        }
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'A refund already exists for this return request or idempotency key',
        });
      }
      throw error;
    }
  }

  /** Executes the gateway call outside a transaction. BullMQ retries errors. */
  private async executeProviderRefund(
    refundId: string,
    dto: ConfirmMockRefundDto,
    idempotencyKey: string,
    provider: PaymentProvider,
  ): Promise<CreateRefundResult> {
    if (dto.outcome === MockRefundOutcome.FAILED) {
      return { providerRefundReference: `not-sent:${refundId}`, settled: false };
    }

    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { paymentIntent: true },
    });
    if (!refund) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Refund was not found',
      });
    }

    return provider.createRefund({
      reference: idempotencyKey,
      // A mock intent never captured anything, so it has no payment reference of
      // its own; the intent reference identifies it well enough for the mock and
      // for reconciliation. A real gateway will always have set the former by
      // the time a refund is possible.
      providerPaymentReference:
        refund.paymentIntent?.providerPaymentReference ??
        refund.paymentIntent?.providerReference ??
        refund.id,
      amountPaise: refund.amountPaise,
      notes: { refundId: refund.id, productOrderId: refund.productOrderId },
    });
  }

  async confirmMock(
    refundId: string,
    dto: ConfirmMockRefundDto,
    actor: CurrentUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    this.ensurePermission(
      actor,
      PermissionCode.REFUNDS_CONFIRM_MOCK,
      'Mock refund confirmation permission is required',
    );
    const key = this.normalizedIdempotencyKey(idempotencyKey);
    const requestHash = this.hashRequest({ refundId, dto });
    const replayEvent = await this.prisma.refundEvent.findUnique({
      where: { idempotencyKey: key },
    });
    if (replayEvent) {
      if (replayEvent.refundId !== refundId || replayEvent.requestHash !== requestHash) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Idempotency key was already used for a different refund confirmation',
        });
      }
      await this.enqueueExecution(replayEvent.id, replayEvent.requestId ?? requestId);
      return this.getAnyOrThrow(refundId);
    }

    try {
      const staged = await this.prisma.$transaction(
        async (tx) => {
          const refund = await tx.refund.findUnique({
            where: { id: refundId },
            include: refundDetailInclude,
          });
          if (!refund) {
            throw new NotFoundException({
              code: ApiErrorCode.NOT_FOUND,
              message: 'Refund was not found',
            });
          }
          if (refund.providerMode !== PaymentProviderMode.MOCK) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Only mock-provider refunds can use this confirmation endpoint',
            });
          }
          if (refund.status !== RefundStatus.PENDING && refund.status !== RefundStatus.FAILED) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'Refund is not eligible for mock confirmation',
            });
          }

          await tx.refund.update({
            where: { id: refund.id },
            data: { status: RefundStatus.PROCESSING, failureReason: null },
          });
          const processingEvent = await tx.refundEvent.create({
            data: {
              refundId: refund.id,
              eventType: RefundEventType.PROCESSING_STARTED,
              status: RefundStatus.PROCESSING,
              payload: {
                outcome: dto.outcome,
                ...(dto.failureReason ? { failureReason: dto.failureReason.trim() } : {}),
                actorMembershipId: actor.membershipId,
                actorOrganisationId: actor.organisationId,
              },
              actorUserId: actor.userId,
              actorRole: actor.role,
              requestId: requestId ?? null,
              idempotencyKey: key,
              requestHash,
            },
          });
          await this.auditService.record(
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              organisationId: refund.productOrder.sellerOrganisationId,
              action: 'REFUND_EXECUTION_QUEUED',
              resourceType: 'Refund',
              resourceId: refund.id,
              previousValue: { status: refund.status },
              newValue: { status: RefundStatus.PROCESSING },
              requestId,
              reason: 'Mock refund queued for asynchronous execution',
            },
            tx,
          );
          const saved = await tx.refund.findUniqueOrThrow({
            where: { id: refund.id },
            include: refundDetailInclude,
          });
          return { processingEventId: processingEvent.id, refund: this.toRefund(saved) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.enqueueExecution(staged.processingEventId, requestId);
      return staged.refund;
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const event = await this.prisma.refundEvent.findUnique({ where: { idempotencyKey: key } });
        if (event?.refundId === refundId && event.requestHash === requestHash) {
          await this.enqueueExecution(event.id, event.requestId ?? requestId);
          return this.getAnyOrThrow(refundId);
        }
      }
      throw error;
    }
  }

  async executeQueuedMock(refundEventId: string): Promise<Record<string, unknown>> {
    const event = await this.prisma.refundEvent.findUnique({ where: { id: refundEventId } });
    if (!event || event.eventType !== RefundEventType.PROCESSING_STARTED) {
      return { refundEventId, outcome: 'MISSING' };
    }
    if (!event.idempotencyKey || !event.requestHash || !event.actorUserId || !event.actorRole) {
      throw new Error(`Refund processing event ${refundEventId} is incomplete`);
    }
    const requestHash = event.requestHash;
    const payload = this.parseQueuedPayload(event.payload);
    const latest = await this.prisma.refundEvent.findFirst({
      where: { refundId: event.refundId, eventType: RefundEventType.PROCESSING_STARTED },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (latest?.id !== event.id) {
      return { refundId: event.refundId, outcome: 'SUPERSEDED' };
    }
    const terminal = await this.prisma.refundEvent.findFirst({
      where: {
        refundId: event.refundId,
        eventType: { in: [RefundEventType.REFUND_SUCCEEDED, RefundEventType.REFUND_FAILED] },
        requestHash,
      },
    });
    if (terminal) {
      return { refundId: event.refundId, outcome: 'ALREADY_APPLIED', status: terminal.status };
    }

    const refund = await this.prisma.refund.findUnique({ where: { id: event.refundId } });
    if (!refund || refund.status !== RefundStatus.PROCESSING) {
      return { refundId: event.refundId, outcome: 'NOT_PROCESSING' };
    }
    const provider = this.providerRegistry.current();
    if (
      refund.providerMode !== PaymentProviderMode.MOCK ||
      provider.mode !== PaymentProviderMode.MOCK
    ) {
      throw new Error(`Mock refund ${refund.id} cannot execute with provider ${provider.name}`);
    }
    const providerRefund = await this.executeProviderRefund(
      refund.id,
      {
        outcome: payload.outcome,
        ...(payload.failureReason ? { failureReason: payload.failureReason } : {}),
      },
      event.idempotencyKey,
      provider,
    );
    const actor: CurrentUser = {
      userId: event.actorUserId,
      role: event.actorRole,
      membershipId: payload.actorMembershipId,
      organisationId: payload.actorOrganisationId,
      permissions: [],
    };
    const result = await this.finalizeQueuedMock(
      { ...event, requestHash },
      payload,
      providerRefund,
      actor,
    );
    const creditNoteDocumentId = result.creditNoteDocumentId;
    if (typeof creditNoteDocumentId === 'string') {
      await this.creditNotesService.enqueue(creditNoteDocumentId, event.requestId ?? undefined);
    }
    return result;
  }

  private async enqueueExecution(refundEventId: string, requestId?: string): Promise<void> {
    await this.queueService.enqueue(
      QueueName.PAYMENT_WEBHOOKS,
      PaymentWebhookJob.EXECUTE_REFUND,
      { refundEventId },
      { ...(requestId ? { requestId } : {}), jobId: refundExecutionJobId(refundEventId) },
    );
  }

  private async finalizeQueuedMock(
    event: {
      id: string;
      refundId: string;
      requestHash: string;
      requestId: string | null;
    },
    payload: QueuedRefundEventPayload,
    providerRefund: CreateRefundResult,
    actor: CurrentUser,
  ): Promise<Record<string, unknown>> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Refund" WHERE "id" = ${event.refundId}::uuid FOR UPDATE`,
        );
        const refund = await tx.refund.findUnique({
          where: { id: event.refundId },
          include: refundDetailInclude,
        });
        if (!refund) return { refundId: event.refundId, outcome: 'MISSING' };

        const latest = await tx.refundEvent.findFirst({
          where: { refundId: refund.id, eventType: RefundEventType.PROCESSING_STARTED },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (latest?.id !== event.id) {
          return { refundId: refund.id, outcome: 'SUPERSEDED' };
        }
        const terminal = await tx.refundEvent.findFirst({
          where: {
            refundId: refund.id,
            eventType: { in: [RefundEventType.REFUND_SUCCEEDED, RefundEventType.REFUND_FAILED] },
            requestHash: event.requestHash,
          },
        });
        if (terminal) {
          return { refundId: refund.id, outcome: 'ALREADY_APPLIED', status: terminal.status };
        }
        if (refund.status !== RefundStatus.PROCESSING) {
          return { refundId: refund.id, outcome: 'NOT_PROCESSING', status: refund.status };
        }

        if (payload.outcome === MockRefundOutcome.FAILED) {
          const failureReason = payload.failureReason!;
          await tx.refund.update({
            where: { id: refund.id },
            data: { status: RefundStatus.FAILED, failureReason },
          });
          await tx.refundEvent.create({
            data: {
              refundId: refund.id,
              eventType: RefundEventType.REFUND_FAILED,
              status: RefundStatus.FAILED,
              payload: { failureReason, processingEventId: event.id },
              actorUserId: actor.userId,
              actorRole: actor.role,
              requestId: event.requestId,
              requestHash: event.requestHash,
            },
          });
          await this.auditService.record(
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              organisationId: refund.productOrder.sellerOrganisationId,
              action: 'REFUND_FAILED',
              resourceType: 'Refund',
              resourceId: refund.id,
              previousValue: { status: RefundStatus.PROCESSING },
              newValue: { status: RefundStatus.FAILED, failureReason },
              requestId: event.requestId ?? undefined,
              reason: failureReason,
            },
            tx,
          );
          if (refund.returnRequestId) {
            await this.notificationEventsService.emitFarmerEvent(tx, {
              event: FarmerNotificationEvent.REFUND_FAILED,
              recipientUserId: refund.farmerUserId,
              returnRequestId: refund.returnRequestId,
              productOrderId: refund.productOrderId,
              orderNumber: refund.productOrder.orderNumber,
              actorUserId: actor.userId,
              actorRole: actor.role,
              requestId: event.requestId ?? undefined,
              refundId: refund.id,
              amountPaise: refund.amountPaise,
            });
          }
          return { refundId: refund.id, outcome: 'FAILED', status: RefundStatus.FAILED };
        }

        const providerReference = providerRefund.providerRefundReference;
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.SUCCEEDED,
            providerRefundReference: providerReference,
            completedAt: new Date(),
          },
        });
        await tx.refundEvent.create({
          data: {
            refundId: refund.id,
            eventType: RefundEventType.REFUND_SUCCEEDED,
            status: RefundStatus.SUCCEEDED,
            providerReference,
            payload: { processingEventId: event.id },
            actorUserId: actor.userId,
            actorRole: actor.role,
            requestId: event.requestId,
            requestHash: event.requestHash,
          },
        });
        await tx.financialLedgerEntry.create({
          data: {
            entryType: FinancialLedgerEntryType.REFUND,
            amountPaise: -refund.amountPaise,
            organisationId: refund.productOrder.sellerOrganisationId,
            productOrderId: refund.productOrderId,
            paymentIntentId: refund.paymentIntentId,
            refundId: refund.id,
            requestId: event.requestId,
            reason: 'Farmer refund completed',
          },
        });
        if (refund.returnRequestId) {
          const returned = await tx.returnRequest.findUniqueOrThrow({
            where: { id: refund.returnRequestId },
            select: {
              items: { select: { id: true, unitPricePaise: true } },
              inspectionDispositions: {
                select: { returnRequestItemId: true, outcome: true, quantity: true },
              },
            },
          });
          const unitPrices = new Map(returned.items.map((item) => [item.id, item.unitPricePaise]));
          const acceptedGrossPaise = returned.inspectionDispositions.reduce(
            (total, disposition) =>
              disposition.outcome === ReturnInspectionOutcome.REJECTED_RETURN
                ? total
                : total +
                  (unitPrices.get(disposition.returnRequestItemId) ?? 0) * disposition.quantity,
            0,
          );
          const reversedBenefitPaise = Math.max(0, acceptedGrossPaise - refund.amountPaise);
          if (reversedBenefitPaise > 0) {
            await tx.financialLedgerEntry.create({
              data: {
                entryType: FinancialLedgerEntryType.CLUB_BENEFIT_SUBSIDY,
                amountPaise: -reversedBenefitPaise,
                organisationId: refund.productOrder.sellerOrganisationId,
                productOrderId: refund.productOrderId,
                paymentIntentId: refund.paymentIntentId,
                refundId: refund.id,
                requestId: event.requestId,
                reason: 'Kisan Club benefit subsidy reversed for accepted returned quantity',
              },
            });
          }
        }
        await this.financeService.reverseCommissionEntriesForOrder(
          tx,
          refund.productOrderId,
          actor,
          'Order refunded after approved return',
          event.requestId ?? undefined,
          refund.id,
        );
        await tx.productOrder.update({
          where: { id: refund.productOrderId },
          data: {
            status: ProductOrderStatus.REFUNDED,
            statusHistory: {
              create: {
                fromStatus: ProductOrderStatus.REFUND_PENDING,
                toStatus: ProductOrderStatus.REFUNDED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                reason: 'Approved return refund completed',
                requestId: event.requestId,
              },
            },
          },
        });
        if (refund.returnRequestId) {
          await tx.returnRequest.update({
            where: { id: refund.returnRequestId },
            data: {
              status: ReturnRequestStatus.COMPLETED,
              statusHistory: {
                create: {
                  fromStatus: ReturnRequestStatus.INSPECTED,
                  toStatus: ReturnRequestStatus.COMPLETED,
                  actorUserId: actor.userId,
                  actorRole: actor.role,
                  reason: 'Approved refund completed',
                  requestId: event.requestId,
                },
              },
            },
          });
          await this.notificationEventsService.emitFarmerEvent(tx, {
            event: FarmerNotificationEvent.REFUND_SUCCEEDED,
            recipientUserId: refund.farmerUserId,
            returnRequestId: refund.returnRequestId,
            productOrderId: refund.productOrderId,
            orderNumber: refund.productOrder.orderNumber,
            actorUserId: actor.userId,
            actorRole: actor.role,
            requestId: event.requestId ?? undefined,
            refundId: refund.id,
            amountPaise: refund.amountPaise,
          });
        }
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: refund.productOrder.sellerOrganisationId,
            action: 'REFUND_SUCCEEDED',
            resourceType: 'Refund',
            resourceId: refund.id,
            previousValue: { status: RefundStatus.PROCESSING },
            newValue: {
              status: RefundStatus.SUCCEEDED,
              amountPaise: refund.amountPaise,
              providerRefundReference: providerReference,
            },
            requestId: event.requestId ?? undefined,
            reason: 'Queued mock refund completed successfully',
          },
          tx,
        );
        const creditNoteDocumentId = await this.creditNotesService.issueForSucceededRefund(
          tx,
          refund.id,
          actor,
          event.requestId ?? undefined,
        );
        return {
          refundId: refund.id,
          outcome: 'SUCCEEDED',
          status: RefundStatus.SUCCEEDED,
          creditNoteDocumentId,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private parseQueuedPayload(value: Prisma.JsonValue): QueuedRefundEventPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Refund processing event payload is invalid');
    }
    const payload = value as Record<string, unknown>;
    const outcome = payload.outcome;
    const actorMembershipId = payload.actorMembershipId;
    const actorOrganisationId = payload.actorOrganisationId;
    const failureReason = payload.failureReason;
    if (
      (outcome !== MockRefundOutcome.SUCCEEDED && outcome !== MockRefundOutcome.FAILED) ||
      typeof actorMembershipId !== 'string' ||
      typeof actorOrganisationId !== 'string' ||
      (outcome === MockRefundOutcome.FAILED &&
        (typeof failureReason !== 'string' || failureReason.trim().length < 3))
    ) {
      throw new Error('Refund processing event payload is incomplete');
    }
    return {
      outcome,
      actorMembershipId,
      actorOrganisationId,
      ...(typeof failureReason === 'string' ? { failureReason: failureReason.trim() } : {}),
    };
  }

  async list(query: ListRefundsQueryDto, actor: CurrentUser) {
    this.ensurePermission(
      actor,
      PermissionCode.REFUNDS_READ_ANY,
      'Refund read permission is required',
    );
    return this.listWhere(query, {});
  }

  async listMine(query: ListRefundsQueryDto, actor: CurrentUser) {
    this.ensurePermission(
      actor,
      PermissionCode.REFUNDS_READ_OWN,
      'Own refund read permission is required',
    );
    return this.listWhere(query, { farmerUserId: actor.userId });
  }

  async get(refundId: string, actor: CurrentUser) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: refundDetailInclude,
    });
    if (!refund) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Refund was not found',
      });
    }
    const mayReadAny = this.accessService.hasPermission(actor, PermissionCode.REFUNDS_READ_ANY);
    const mayReadOwn =
      this.accessService.hasPermission(actor, PermissionCode.REFUNDS_READ_OWN) &&
      refund.farmerUserId === actor.userId;
    if (!mayReadAny && !mayReadOwn) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'You do not have access to this refund',
      });
    }
    return this.toRefund(refund);
  }

  private async listWhere(query: ListRefundsQueryDto, base: Prisma.RefundWhereInput) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.RefundWhereInput = {
      ...base,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productOrderId ? { productOrderId: query.productOrderId } : {}),
      ...(query.returnRequestId ? { returnRequestId: query.returnRequestId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: refundDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items: items.map((item) => this.toRefund(item)), page, limit, total };
  }

  private async getAnyOrThrow(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: refundDetailInclude,
    });
    if (!refund) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Refund was not found',
      });
    }
    return this.toRefund(refund);
  }

  private toRefund(refund: RefundWithDetails) {
    return {
      id: refund.id,
      productOrderId: refund.productOrderId,
      returnRequestId: refund.returnRequestId,
      paymentIntentId: refund.paymentIntentId,
      farmerUserId: refund.farmerUserId,
      orderNumber: refund.productOrder.orderNumber,
      sellerName: refund.productOrder.sellerNameSnapshot,
      amountPaise: refund.amountPaise,
      method: refund.method,
      status: refund.status,
      providerMode: refund.providerMode,
      providerRefundReference: refund.providerRefundReference,
      failureReason: refund.failureReason,
      initiatedByUserId: refund.initiatedByUserId,
      initiatedAt: refund.initiatedAt,
      completedAt: refund.completedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      events: refund.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        status: event.status,
        providerReference: event.providerReference,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        requestId: event.requestId,
        createdAt: event.createdAt,
      })),
    };
  }

  private ensurePermission(actor: CurrentUser, permission: PermissionCode, message: string) {
    if (!this.accessService.hasPermission(actor, permission)) {
      throw new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message });
    }
  }

  private normalizedIdempotencyKey(idempotencyKey?: string) {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header is required for refund actions',
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

  private hashRequest(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
