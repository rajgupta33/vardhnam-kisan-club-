import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentEventType,
  PaymentIntentStatus,
  Prisma,
  ProductCheckoutStatus,
  ProductOrderStatus,
  type PaymentIntent,
  type PlatformRole,
  type ProductOrder,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { FinanceService } from '../finance/finance.service';
import { KisanClubFulfilmentService } from '../kisan-club/fulfilment/kisan-club-fulfilment.service';
import {
  FarmerPaymentNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import {
  checkoutAuditValue,
  paymentIntentAuditValue,
  productOrderAuditValue,
  type PaymentIntentWithDetails,
} from './payment-shapes';

/**
 * Who caused a settlement.
 *
 * A webhook has no human behind it, so `undefined` is a first-class value here
 * rather than something to paper over with a placeholder user. Audit rows and
 * payment events then carry a null actor, which operator surfaces render as
 * "system".
 */
export type SettlementActor = CurrentUser | undefined;

/**
 * Where a settlement came from. Recorded so the timeline explains itself.
 *
 * Reconciliation is deliberately not a source: it reports disagreement and
 * leaves the decision to finance, so it never settles anything itself.
 */
export type SettlementSource = 'mock-confirm' | 'webhook';

/**
 * Audit action names per source.
 *
 * The mock-confirm names predate this service and are kept verbatim: audit
 * actions are how operators and reports find events, and renaming one
 * retroactively splits a single history into two names that no query joins.
 */
const settlementAuditActions: Readonly<
  Record<SettlementSource, { succeeded: string; failed: string }>
> = {
  'mock-confirm': { succeeded: 'MOCK_PAYMENT_CONFIRMED', failed: 'MOCK_PAYMENT_FAILED' },
  webhook: { succeeded: 'PAYMENT_WEBHOOK_CONFIRMED', failed: 'PAYMENT_WEBHOOK_FAILED' },
};

export interface SettleInput {
  paymentIntent: PaymentIntentWithDetails;
  outcome: Extract<PaymentIntentStatus, 'SUCCEEDED' | 'FAILED'>;
  actor: SettlementActor;
  requestId?: string | undefined;
  reason: string;
  source: SettlementSource;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  providerPaymentReference?: string | undefined;
  providerStatus?: string | undefined;
}

/**
 * The one place a payment intent reaches a terminal state.
 *
 * Three callers need this: the farmer-facing mock confirm endpoint, the webhook
 * handler and reconciliation. They differ only in who is asking and what
 * evidence they carry -- the consequences of a payment succeeding (ledger
 * entries, order transitions, Kisan Club fulfilment, the farmer's notification)
 * are identical, and duplicating them per caller is how the three drift apart
 * and a farmer ends up with a paid order that was never funded.
 */
@Injectable()
export class PaymentSettlementService {
  constructor(
    private readonly auditService: AuditService,
    private readonly financeService: FinanceService,
    private readonly notificationEventsService: NotificationEventsService,
    private readonly kisanClubFulfilmentService?: KisanClubFulfilmentService,
  ) {}

  /**
   * Applies a terminal outcome to an intent and everything hanging off it.
   *
   * Assumes the caller has already established that the intent may be settled
   * (`ensureCanSettle`) and, where the outcome came from a provider, that the
   * amount matches. It does not re-check ownership: a webhook has no owner.
   */
  async settle(tx: Prisma.TransactionClient, input: SettleInput): Promise<PaymentIntent> {
    const { paymentIntent, actor, requestId } = input;
    const isSuccess = input.outcome === PaymentIntentStatus.SUCCEEDED;

    await this.recordPaymentEvent(tx, {
      paymentIntent,
      eventType: PaymentEventType.CONFIRMATION_STARTED,
      status: PaymentIntentStatus.PROCESSING,
      actor,
      requestId,
      payload: {
        source: input.source,
        outcome: input.outcome,
        failureCode: input.failureCode ?? null,
      },
    });

    const updatedPaymentIntent = await tx.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        status: input.outcome,
        failureCode: isSuccess ? null : (input.failureCode ?? 'PAYMENT_FAILED'),
        failureMessage: isSuccess
          ? null
          : (input.failureMessage ?? 'Payment failed at the provider'),
        ...(input.providerPaymentReference
          ? { providerPaymentReference: input.providerPaymentReference }
          : {}),
        ...(input.providerStatus
          ? { providerStatus: input.providerStatus, lastProviderSyncAt: new Date() }
          : {}),
      },
    });

    await this.recordPaymentEvent(tx, {
      paymentIntent: updatedPaymentIntent,
      eventType: isSuccess ? PaymentEventType.PAYMENT_SUCCEEDED : PaymentEventType.PAYMENT_FAILED,
      status: input.outcome,
      actor,
      requestId,
      payload: {
        source: input.source,
        outcome: input.outcome,
        failureCode: updatedPaymentIntent.failureCode ?? null,
        failureMessage: updatedPaymentIntent.failureMessage ?? null,
      },
    });

    const updatedCheckout = await tx.productCheckout.update({
      where: { id: paymentIntent.checkoutId },
      data: {
        status: isSuccess ? ProductCheckoutStatus.PAID : ProductCheckoutStatus.PAYMENT_FAILED,
      },
    });

    await this.auditService.record(
      this.withActor(actor, {
        action: isSuccess ? 'PRODUCT_CHECKOUT_PAYMENT_PAID' : 'PRODUCT_CHECKOUT_PAYMENT_FAILED',
        resourceType: 'ProductCheckout',
        resourceId: updatedCheckout.id,
        previousValue: checkoutAuditValue(paymentIntent.checkout),
        newValue: checkoutAuditValue(updatedCheckout),
        requestId,
        reason: input.reason,
      }),
      tx,
    );

    await this.transitionProductOrders(tx, {
      orders: paymentIntent.checkout.orders,
      toStatus: isSuccess ? ProductOrderStatus.CONFIRMED : ProductOrderStatus.PAYMENT_FAILED,
      action: isSuccess ? 'PRODUCT_ORDER_PAYMENT_CONFIRMED' : 'PRODUCT_ORDER_PAYMENT_FAILED',
      actor,
      requestId,
      reason: input.reason,
    });

    if (isSuccess) {
      await this.financeService.recordFarmerPayment(tx, updatedPaymentIntent, actor, requestId);
      await this.kisanClubFulfilmentService?.createForConfirmedOrders(
        tx,
        paymentIntent.checkout.orders,
        actor,
        requestId,
      );
    }

    await this.auditService.record(
      this.withActor(actor, {
        action: isSuccess
          ? settlementAuditActions[input.source].succeeded
          : settlementAuditActions[input.source].failed,
        resourceType: 'PaymentIntent',
        resourceId: updatedPaymentIntent.id,
        previousValue: paymentIntentAuditValue(paymentIntent),
        newValue: paymentIntentAuditValue(updatedPaymentIntent),
        requestId,
        reason: input.reason,
      }),
      tx,
    );

    await this.notificationEventsService.emitPaymentEvent(tx, {
      event: isSuccess
        ? FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED
        : FarmerPaymentNotificationEvent.PAYMENT_FAILED,
      farmerProfileId: updatedPaymentIntent.farmerProfileId,
      productCheckoutId: updatedPaymentIntent.checkoutId,
      paymentIntentId: updatedPaymentIntent.id,
      amountPaise: updatedPaymentIntent.amountPaise,
      ...(actor ? { actorUserId: actor.userId, actorRole: actor.role } : {}),
      requestId,
    });

    return updatedPaymentIntent;
  }

  /**
   * Whether an intent is in a state that may still be settled.
   *
   * Terminal intents are not an error here -- a gateway redelivering a capture
   * it already sent is normal, and the caller decides whether that is a no-op
   * (webhook) or a conflict (a farmer confirming twice).
   */
  isTerminal(paymentIntent: PaymentIntent): boolean {
    return (
      paymentIntent.status === PaymentIntentStatus.SUCCEEDED ||
      paymentIntent.status === PaymentIntentStatus.FAILED
    );
  }

  /** Rejects an intent whose checkout or orders have moved on underneath it. */
  ensureCanSettle(paymentIntent: PaymentIntentWithDetails): void {
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

  async recordPaymentEvent(
    tx: Prisma.TransactionClient,
    input: {
      paymentIntent: PaymentIntent;
      eventType: PaymentEventType;
      status: PaymentIntentStatus;
      actor: SettlementActor;
      requestId?: string | undefined;
      payload?: Prisma.InputJsonObject | undefined;
    },
  ): Promise<void> {
    const data: Prisma.PaymentEventUncheckedCreateInput = {
      paymentIntentId: input.paymentIntent.id,
      eventType: input.eventType,
      status: input.status,
      providerReference: input.paymentIntent.providerReference,
      actorUserId: input.actor?.userId ?? null,
      actorRole: (input.actor?.role as PlatformRole | undefined) ?? null,
      requestId: input.requestId ?? null,
    };
    if (input.payload !== undefined) {
      data.payload = input.payload;
    }

    await tx.paymentEvent.create({ data });
  }

  async transitionProductOrders(
    tx: Prisma.TransactionClient,
    input: {
      orders: ProductOrder[];
      toStatus: ProductOrderStatus;
      action: string;
      actor: SettlementActor;
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
        data: { status: input.toStatus },
      });

      await tx.productOrderStatusHistory.create({
        data: {
          productOrderId: order.id,
          fromStatus: order.status,
          toStatus: input.toStatus,
          actorUserId: input.actor?.userId ?? null,
          actorRole: input.actor?.role ?? null,
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
          previousValue: productOrderAuditValue(order),
          newValue: productOrderAuditValue(updatedOrder),
          requestId: input.requestId,
          reason: input.reason,
        }),
        tx,
      );
    }
  }

  withActor(actor: SettlementActor, input: AuditRecordInput): AuditRecordInput {
    if (!actor) {
      return input;
    }

    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }
}
