import { createHash } from 'node:crypto';
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, WebhookProcessingStatus, type WebhookEvent } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { QueueService } from '../jobs/queue.service';
import { PaymentWebhookJob, QueueName } from '../jobs/queue-names';
import { PrismaService } from '../prisma/prisma.service';
import {
  WebhookPayloadError,
  type ParsedWebhookEvent,
} from './providers/payment-provider.interface';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

export interface WebhookIngestResult {
  webhookEventId: string;
  status: WebhookProcessingStatus;
  /** True when this body had already been received under the same event id. */
  duplicate: boolean;
}

/**
 * Accepts webhooks from a payment gateway.
 *
 * The order of operations here is the security model, so it is worth stating:
 * verify the signature against the raw bytes, then persist the raw bytes, then
 * enqueue, then return 200. Nothing is interpreted before it is proven
 * authentic, and nothing is interpreted inside the request at all -- a gateway
 * that does not get its 200 within a few seconds retries, and a slow
 * interpretation would turn one payment into a storm of redeliveries.
 */
@Injectable()
export class PaymentWebhooksService {
  private readonly logger = new Logger(PaymentWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {}

  async ingest(input: {
    providerName: string;
    rawBody: Buffer | undefined;
    signature: string | undefined;
    requestId?: string | undefined;
    sourceIp?: string | undefined;
  }): Promise<WebhookIngestResult> {
    const provider = this.providerRegistry.forWebhookProvider(input.providerName);
    if (!provider) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Unknown payment provider',
      });
    }

    // An empty raw body means the body parser did not keep the bytes, which
    // makes verification impossible. Treating that as "unverified" rather than
    // as a server error keeps the endpoint fail-closed.
    const rawBody = input.rawBody ?? Buffer.alloc(0);
    if (rawBody.length === 0 || !provider.verifyWebhookSignature(rawBody, input.signature)) {
      await this.recordRejectedSignature(input.providerName, rawBody, input);
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Webhook signature verification failed',
      });
    }

    const payloadDigest = this.digest(rawBody);

    let parsed: ParsedWebhookEvent;
    try {
      parsed = provider.parseWebhookEvent(rawBody);
    } catch (error) {
      if (error instanceof WebhookPayloadError) {
        // Authentic but uninterpretable. Stored anyway: a payload we cannot read
        // today is still the only evidence of what the gateway sent.
        return this.storeUnparseable(input.providerName, rawBody, payloadDigest, input, error);
      }
      throw error;
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.providerName,
          providerEventId: parsed.providerEventId,
        },
      },
    });

    if (existing) {
      if (existing.payloadDigest !== payloadDigest) {
        // Same event id, different bytes. Not a redelivery -- the gateway has
        // changed its account of an event it already sent, and that is an
        // operator's decision, not something to overwrite silently.
        this.logger.warn(
          JSON.stringify({
            message: 'Webhook redelivered with a different payload',
            provider: input.providerName,
            providerEventId: parsed.providerEventId,
            webhookEventId: existing.id,
            requestId: input.requestId,
          }),
        );
        await this.auditService.record({
          action: 'PAYMENT_WEBHOOK_PAYLOAD_CONFLICT',
          resourceType: 'WebhookEvent',
          resourceId: existing.id,
          newValue: {
            provider: input.providerName,
            providerEventId: parsed.providerEventId,
            storedDigest: existing.payloadDigest,
            receivedDigest: payloadDigest,
          },
          requestId: input.requestId,
          reason: 'Gateway redelivered an event id with different content',
        });
      }

      // A redelivery is re-enqueued rather than ignored outright: the first
      // delivery may still be stuck, and the handler is idempotent, so a second
      // run of an already-applied event costs one no-op.
      await this.enqueue(existing.id, input.requestId);
      return { webhookEventId: existing.id, status: existing.status, duplicate: true };
    }

    try {
      const created = await this.prisma.webhookEvent.create({
        data: {
          provider: input.providerName,
          providerEventId: parsed.providerEventId,
          eventType: parsed.eventType,
          rawPayload: rawBody.toString('utf8'),
          payloadDigest,
          signature: input.signature ?? '',
          status: WebhookProcessingStatus.RECEIVED,
          requestId: input.requestId ?? null,
        },
      });

      await this.enqueue(created.id, input.requestId);
      this.logger.log(
        JSON.stringify({
          message: 'Payment webhook accepted',
          provider: input.providerName,
          providerEventId: parsed.providerEventId,
          eventType: parsed.eventType,
          webhookEventId: created.id,
          requestId: input.requestId,
        }),
      );

      return { webhookEventId: created.id, status: created.status, duplicate: false };
    } catch (error) {
      // Two deliveries of the same event arriving at once. The unique
      // constraint decides which one wins, so there is no read-then-write race
      // to lose.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.webhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: input.providerName,
              providerEventId: parsed.providerEventId,
            },
          },
        });
        await this.enqueue(raced.id, input.requestId);
        return { webhookEventId: raced.id, status: raced.status, duplicate: true };
      }
      throw error;
    }
  }

  private async storeUnparseable(
    providerName: string,
    rawBody: Buffer,
    payloadDigest: string,
    input: { signature?: string | undefined; requestId?: string | undefined },
    error: WebhookPayloadError,
  ): Promise<WebhookIngestResult> {
    const providerEventId = `unparsed:${payloadDigest}`;
    let created: WebhookEvent;
    try {
      created = await this.prisma.webhookEvent.create({
        data: {
          provider: providerName,
          // No usable event id, so the digest stands in. It is stable across
          // redeliveries of identical bytes, which is exactly what dedupe needs.
          providerEventId,
          eventType: 'unparsed',
          rawPayload: rawBody.toString('utf8'),
          payloadDigest,
          signature: input.signature ?? '',
          status: WebhookProcessingStatus.FAILED,
          failureReason: `${error.errorCode}: ${error.message}`,
          requestId: input.requestId ?? null,
          processedAt: new Date(),
        },
      });
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === 'P2002'
      ) {
        const existing = await this.prisma.webhookEvent.findUniqueOrThrow({
          where: { provider_providerEventId: { provider: providerName, providerEventId } },
        });
        return { webhookEventId: existing.id, status: existing.status, duplicate: true };
      }
      throw createError;
    }

    this.logger.warn(
      JSON.stringify({
        message: 'Payment webhook could not be parsed',
        provider: providerName,
        webhookEventId: created.id,
        errorCode: error.errorCode,
        requestId: input.requestId,
      }),
    );

    return {
      webhookEventId: created.id,
      status: WebhookProcessingStatus.FAILED,
      duplicate: false,
    };
  }

  /**
   * Logs and audits a rejected signature without storing the body.
   *
   * A body that failed verification did not come from the gateway, so keeping
   * it would mean storing attacker-controlled content in the payment tables.
   * The digest is enough to correlate repeated attempts.
   */
  private async recordRejectedSignature(
    providerName: string,
    rawBody: Buffer,
    input: { requestId?: string | undefined; sourceIp?: string | undefined },
  ): Promise<void> {
    const digest = this.digest(rawBody);
    this.logger.warn(
      JSON.stringify({
        message: 'Payment webhook signature rejected',
        provider: providerName,
        payloadDigest: digest,
        bodyBytes: rawBody.length,
        sourceIp: input.sourceIp,
        requestId: input.requestId,
      }),
    );

    await this.auditService.record({
      action: 'PAYMENT_WEBHOOK_SIGNATURE_REJECTED',
      resourceType: 'WebhookEvent',
      newValue: {
        provider: providerName,
        payloadDigest: digest,
        bodyBytes: rawBody.length,
        sourceIp: input.sourceIp ?? null,
      },
      requestId: input.requestId,
      reason: 'Webhook signature did not match the configured secret',
    });
  }

  private async enqueue(webhookEventId: string, requestId?: string): Promise<void> {
    await this.queueService.enqueue(
      QueueName.PAYMENT_WEBHOOKS,
      PaymentWebhookJob.PROCESS_WEBHOOK,
      { webhookEventId },
      // Deliberately no fixed job id. Keying the job by the webhook row would
      // stop a redelivery from re-enqueuing while the previous job is still in
      // Redis -- including when that job failed, which is precisely the case a
      // redelivery is meant to rescue. Deduplication belongs to the unique
      // constraint on the webhook row and to the handler, which is idempotent.
      requestId ? { requestId } : {},
    );
  }

  private digest(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }
}
