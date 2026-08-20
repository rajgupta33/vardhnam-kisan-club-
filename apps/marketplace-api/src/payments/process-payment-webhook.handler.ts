import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentEventType,
  PaymentIntentStatus,
  Prisma,
  WebhookProcessingStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { PaymentWebhookJob, QueueName } from '../jobs/queue-names';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { paymentIntentDetailInclude, type PaymentIntentWithDetails } from './payment-shapes';
import {
  WebhookPayloadError,
  type ParsedWebhookEvent,
} from './providers/payment-provider.interface';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

interface ProcessPaymentWebhookPayload {
  webhookEventId: string;
}

/**
 * Applies one verified webhook to the payment it refers to.
 *
 * The webhook row is the unit of work, not the job: the row is already durable
 * when this runs, so a lost job is recoverable and a duplicated job is a no-op.
 * Everything that decides money is re-derived from the stored raw payload
 * rather than from the job, because the job is just a nudge.
 *
 * Idempotency has two layers. The row's own status stops a second run of an
 * already-processed event, and the intent's terminal status stops an event that
 * arrived twice under different ids from settling twice. Either alone would
 * leave a gap.
 */
@Injectable()
export class ProcessPaymentWebhookHandler implements JobHandler<ProcessPaymentWebhookPayload> {
  private readonly logger = new Logger(ProcessPaymentWebhookHandler.name);
  readonly queue = QueueName.PAYMENT_WEBHOOKS;
  readonly jobName = PaymentWebhookJob.PROCESS_WEBHOOK;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly settlementService: PaymentSettlementService,
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {}

  async handle(
    envelope: JobEnvelope<ProcessPaymentWebhookPayload>,
    context: JobContext,
  ): Promise<JobResult> {
    const { webhookEventId } = envelope.payload;
    const webhookEvent = await this.prisma.webhookEvent.findUnique({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      // Nothing to retry against. Returning normally rather than throwing keeps
      // a stale job from consuming an attempt budget it can never satisfy.
      return { webhookEventId, outcome: 'MISSING' };
    }

    if (
      webhookEvent.status === WebhookProcessingStatus.PROCESSED ||
      webhookEvent.status === WebhookProcessingStatus.IGNORED
    ) {
      return { webhookEventId, outcome: 'ALREADY_APPLIED', status: webhookEvent.status };
    }

    const provider = this.providerRegistry.forWebhookProvider(webhookEvent.provider);
    if (!provider) {
      await this.markFailed(
        webhookEventId,
        `Provider ${webhookEvent.provider} is no longer configured`,
      );
      return { webhookEventId, outcome: 'PROVIDER_NOT_CONFIGURED' };
    }

    let parsed: ParsedWebhookEvent;
    try {
      parsed = provider.parseWebhookEvent(Buffer.from(webhookEvent.rawPayload, 'utf8'));
    } catch (error) {
      if (error instanceof WebhookPayloadError) {
        // Re-parsing identical bytes will fail identically, so this must not
        // retry -- it would burn the attempt budget and dead-letter something an
        // operator cannot act on any better in five minutes.
        await this.markFailed(webhookEventId, `${error.errorCode}: ${error.message}`);
        return { webhookEventId, outcome: 'UNPARSEABLE', errorCode: error.errorCode };
      }
      throw error;
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: WebhookProcessingStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
    });

    const outcome = await this.applyEvent(parsed, webhookEventId, context.requestId);

    this.logger.log(
      JSON.stringify({
        message: 'Payment webhook processed',
        webhookEventId,
        provider: webhookEvent.provider,
        eventType: parsed.eventType,
        outcome: outcome.outcome,
        requestId: context.requestId,
      }),
    );

    return { webhookEventId, ...outcome };
  }

  private async applyEvent(
    parsed: ParsedWebhookEvent,
    webhookEventId: string,
    requestId?: string,
  ): Promise<JobResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const paymentIntent = (await tx.paymentIntent.findUnique({
          where: { providerReference: parsed.reference },
          include: paymentIntentDetailInclude,
        })) as PaymentIntentWithDetails | null;

        if (!paymentIntent) {
          // An authentic event for an intent we have no record of. Kept as a
          // failure rather than discarded: it means either a reference we lost
          // or a gateway account shared with something else, and both need a
          // human.
          await this.setStatus(tx, webhookEventId, {
            status: WebhookProcessingStatus.FAILED,
            failureReason: `No payment intent for provider reference ${parsed.reference}`,
          });
          return { outcome: 'INTENT_NOT_FOUND' };
        }

        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: { paymentIntentId: paymentIntent.id },
        });

        await this.settlementService.recordPaymentEvent(tx, {
          paymentIntent,
          eventType: PaymentEventType.WEBHOOK_RECEIVED,
          status: paymentIntent.status,
          actor: undefined,
          requestId,
          payload: {
            webhookEventId,
            providerEventId: parsed.providerEventId,
            eventType: parsed.eventType,
            reportedStatus: parsed.status,
          },
        });

        if (
          parsed.status !== PaymentIntentStatus.SUCCEEDED &&
          parsed.status !== PaymentIntentStatus.FAILED
        ) {
          // An authorisation, not a capture. Nothing settles on it; it is
          // recorded on the timeline and the intent stays where it is.
          await this.setStatus(tx, webhookEventId, {
            status: WebhookProcessingStatus.IGNORED,
            failureReason: null,
          });
          return { outcome: 'NON_TERMINAL_EVENT', reportedStatus: parsed.status };
        }

        if (this.settlementService.isTerminal(paymentIntent)) {
          // The redelivery case, and the reason five deliveries produce one
          // state change: the intent is already where this event would put it.
          await this.setStatus(tx, webhookEventId, {
            status: WebhookProcessingStatus.IGNORED,
            failureReason: null,
          });
          return { outcome: 'ALREADY_TERMINAL', intentStatus: paymentIntent.status };
        }

        // The amount is taken from the gateway's payload and checked against
        // what we asked for. A gateway that captured a different amount than
        // the checkout is not something to reconcile automatically -- it is a
        // finance incident, and settling it either way would hide it.
        if (
          parsed.status === PaymentIntentStatus.SUCCEEDED &&
          (parsed.amountPaise === null || parsed.amountPaise !== paymentIntent.amountPaise)
        ) {
          const mismatchReason =
            parsed.amountPaise === null
              ? 'Captured payment webhook did not report an amount'
              : `Amount mismatch: gateway reported ${parsed.amountPaise}, intent is ${paymentIntent.amountPaise}`;
          await this.setStatus(tx, webhookEventId, {
            status: WebhookProcessingStatus.FAILED,
            failureReason: mismatchReason,
          });
          await this.auditService.record(
            {
              action: 'PAYMENT_WEBHOOK_AMOUNT_MISMATCH',
              resourceType: 'PaymentIntent',
              resourceId: paymentIntent.id,
              newValue: {
                webhookEventId,
                providerEventId: parsed.providerEventId,
                intentAmountPaise: paymentIntent.amountPaise,
                reportedAmountPaise: parsed.amountPaise,
              },
              requestId,
              reason: 'Gateway captured an amount that does not match the payment intent',
            },
            tx,
          );
          this.logger.error(
            JSON.stringify({
              message: 'Payment webhook amount mismatch',
              webhookEventId,
              paymentIntentId: paymentIntent.id,
              intentAmountPaise: paymentIntent.amountPaise,
              reportedAmountPaise: parsed.amountPaise,
              requestId,
            }),
          );
          return { outcome: 'AMOUNT_MISMATCH' };
        }

        this.settlementService.ensureCanSettle(paymentIntent);

        await this.settlementService.settle(tx, {
          paymentIntent,
          outcome: parsed.status,
          actor: undefined,
          requestId,
          source: 'webhook',
          reason: `Settled from ${parsed.eventType} webhook`,
          ...(parsed.failureCode ? { failureCode: parsed.failureCode } : {}),
          ...(parsed.failureMessage ? { failureMessage: parsed.failureMessage } : {}),
          ...(parsed.providerPaymentReference
            ? { providerPaymentReference: parsed.providerPaymentReference }
            : {}),
          providerStatus: parsed.eventType,
        });

        await this.setStatus(tx, webhookEventId, {
          status: WebhookProcessingStatus.PROCESSED,
          failureReason: null,
        });

        return { outcome: 'SETTLED', intentStatus: parsed.status };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async setStatus(
    tx: Prisma.TransactionClient,
    webhookEventId: string,
    data: { status: WebhookProcessingStatus; failureReason: string | null },
  ): Promise<void> {
    await tx.webhookEvent.update({
      where: { id: webhookEventId },
      data: { ...data, processedAt: new Date() },
    });
  }

  private async markFailed(webhookEventId: string, failureReason: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: WebhookProcessingStatus.FAILED,
        failureReason,
        attemptCount: { increment: 1 },
        processedAt: new Date(),
      },
    });
  }
}
