import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentEventType, PaymentIntentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ListReconciliationQueryDto } from './dto/list-reconciliation-query.dto';
import { PaymentSettlementService } from './payment-settlement.service';
import { PaymentProviderError } from './providers/payment-provider.interface';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

export interface ReconciliationSweepResult {
  checked: number;
  mismatched: number;
  unreachable: number;
}

/**
 * Finds payments the platform and the gateway no longer agree about.
 *
 * Deliberately does not resolve them. A payment stuck in `PROCESSING` while the
 * gateway says it captured means money moved and the platform missed it; that
 * is a finance incident with a farmer on the other end of it, and quietly
 * settling it on a cron would erase the evidence of how often it happens. The
 * sweep records the disagreement; a human decides, and the ordinary remedies --
 * the gateway redelivering, or an operator replaying the dead-lettered webhook
 * from `/admin/jobs` -- go through the same verified path as any other payment.
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly settlementService: PaymentSettlementService,
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {}

  /**
   * Asks the gateway about every intent that has sat in `PROCESSING` too long.
   *
   * A gateway that is unreachable is counted, not thrown: one dead endpoint
   * must not stop the sweep from checking the rest, and the next run will pick
   * up whatever it missed.
   */
  async sweepStaleIntents(requestId?: string): Promise<ReconciliationSweepResult> {
    const staleMinutes =
      this.configService.get<number>('PAYMENT_RECONCILIATION_STALE_MINUTES') ?? 30;
    const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

    const stale = await this.prisma.paymentIntent.findMany({
      where: {
        status: PaymentIntentStatus.PROCESSING,
        updatedAt: { lt: staleBefore },
      },
      orderBy: { updatedAt: 'asc' },
      // Bounded so one sweep cannot make hundreds of gateway calls in a burst.
      take: 200,
    });

    const provider = this.providerRegistry.current();
    const result: ReconciliationSweepResult = { checked: 0, mismatched: 0, unreachable: 0 };

    for (const intent of stale) {
      result.checked += 1;
      try {
        const providerStatus = await provider.fetchIntentStatus(intent.providerReference);

        await this.prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            providerStatus: providerStatus.rawStatus,
            lastProviderSyncAt: new Date(),
            ...(providerStatus.providerPaymentReference
              ? { providerPaymentReference: providerStatus.providerPaymentReference }
              : {}),
          },
        });

        await this.settlementService.recordPaymentEvent(this.prisma, {
          paymentIntent: intent,
          eventType: PaymentEventType.STATUS_FETCHED,
          status: intent.status,
          actor: undefined,
          requestId,
          payload: {
            providerStatus: providerStatus.rawStatus,
            normalisedStatus: providerStatus.status,
            reportedAmountPaise: providerStatus.amountPaise,
          },
        });

        // Only a terminal provider status is a disagreement. A gateway that
        // still says pending simply agrees the payment is unfinished.
        const providerIsTerminal =
          providerStatus.status === PaymentIntentStatus.SUCCEEDED ||
          providerStatus.status === PaymentIntentStatus.FAILED;
        if (!providerIsTerminal) {
          continue;
        }

        result.mismatched += 1;
        await this.recordMismatch(intent.id, {
          intentStatus: intent.status,
          intentAmountPaise: intent.amountPaise,
          providerStatus: providerStatus.rawStatus,
          providerNormalisedStatus: providerStatus.status,
          providerAmountPaise: providerStatus.amountPaise,
          requestId,
        });
      } catch (error) {
        if (error instanceof PaymentProviderError) {
          result.unreachable += 1;
          this.logger.warn(
            JSON.stringify({
              message: 'Payment reconciliation could not reach the gateway',
              paymentIntentId: intent.id,
              errorCode: error.errorCode,
              requestId,
            }),
          );
          continue;
        }
        throw error;
      }
    }

    this.logger.log(
      JSON.stringify({ message: 'Payment reconciliation sweep complete', ...result, requestId }),
    );

    return result;
  }

  /**
   * What finance sees.
   *
   * Reads the state the sweep recorded rather than calling the gateway per row:
   * a report that made one network call per payment would be slow, would fail
   * as a whole when the gateway blinked, and would hammer a rate limit the
   * moment a page was refreshed.
   */
  async listDisagreements(query: ListReconciliationQueryDto) {
    const staleMinutes =
      this.configService.get<number>('PAYMENT_RECONCILIATION_STALE_MINUTES') ?? 30;
    const staleBefore = new Date(Date.now() - staleMinutes * 60_000);
    const { page, limit, skip } = paginationOffset(query);

    const where: Prisma.PaymentIntentWhereInput = {
      OR: [
        // The gateway has told us something terminal and we are still open.
        {
          status: PaymentIntentStatus.PROCESSING,
          events: { some: { eventType: PaymentEventType.RECONCILIATION_MISMATCH } },
        },
        // Nobody has told us anything and it has been too long.
        {
          status: PaymentIntentStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
        // A webhook arrived for this intent and could not be applied.
        {
          webhookEvents: { some: { status: 'FAILED' } },
        },
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentIntent.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip,
        take: limit,
        include: {
          webhookEvents: {
            where: { status: 'FAILED' },
            orderBy: { receivedAt: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.paymentIntent.count({ where }),
    ]);

    return {
      items: items.map((intent) => ({
        id: intent.id,
        checkoutId: intent.checkoutId,
        farmerProfileId: intent.farmerProfileId,
        providerMode: intent.providerMode,
        providerReference: intent.providerReference,
        providerPaymentReference: intent.providerPaymentReference,
        platformStatus: intent.status,
        providerStatus: intent.providerStatus,
        lastProviderSyncAt: intent.lastProviderSyncAt,
        amountPaise: intent.amountPaise,
        currency: intent.currency,
        staleSince: intent.updatedAt,
        minutesStale: Math.max(0, Math.floor((Date.now() - intent.updatedAt.getTime()) / 60_000)),
        failedWebhooks: intent.webhookEvents.map((event) => ({
          id: event.id,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          failureReason: event.failureReason,
          attemptCount: event.attemptCount,
          receivedAt: event.receivedAt,
        })),
      })),
      page,
      limit,
      total,
      staleAfterMinutes: staleMinutes,
    };
  }

  private async recordMismatch(
    paymentIntentId: string,
    detail: {
      intentStatus: PaymentIntentStatus;
      intentAmountPaise: number;
      providerStatus: string;
      providerNormalisedStatus: PaymentIntentStatus;
      providerAmountPaise: number | null;
      requestId?: string | undefined;
    },
  ): Promise<void> {
    const intent = await this.prisma.paymentIntent.findUniqueOrThrow({
      where: { id: paymentIntentId },
    });

    await this.settlementService.recordPaymentEvent(this.prisma, {
      paymentIntent: intent,
      eventType: PaymentEventType.RECONCILIATION_MISMATCH,
      status: intent.status,
      actor: undefined,
      requestId: detail.requestId,
      payload: {
        platformStatus: detail.intentStatus,
        providerStatus: detail.providerStatus,
        providerNormalisedStatus: detail.providerNormalisedStatus,
        intentAmountPaise: detail.intentAmountPaise,
        providerAmountPaise: detail.providerAmountPaise,
      },
    });

    await this.auditService.record({
      action: 'PAYMENT_RECONCILIATION_MISMATCH',
      resourceType: 'PaymentIntent',
      resourceId: paymentIntentId,
      newValue: {
        platformStatus: detail.intentStatus,
        providerStatus: detail.providerStatus,
        intentAmountPaise: detail.intentAmountPaise,
        providerAmountPaise: detail.providerAmountPaise,
      },
      requestId: detail.requestId,
      reason: 'Gateway and platform disagree about a payment intent',
    });

    this.logger.error(
      JSON.stringify({
        message: 'Payment reconciliation mismatch',
        paymentIntentId,
        platformStatus: detail.intentStatus,
        providerStatus: detail.providerStatus,
        requestId: detail.requestId,
      }),
    );
  }
}
