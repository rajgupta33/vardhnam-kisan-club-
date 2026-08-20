import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentIntentStatus, PaymentProviderMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WebhookPayloadError,
  type CreateIntentInput,
  type CreateIntentResult,
  type CreateRefundInput,
  type CreateRefundResult,
  type ParsedWebhookEvent,
  type PaymentProvider,
  type ProviderIntentStatus,
} from './payment-provider.interface';

/** The mock gateway's webhook body. Shaped after the Indian gateways' envelope. */
interface MockWebhookBody {
  id?: unknown;
  event?: unknown;
  payload?: {
    reference?: unknown;
    amountPaise?: unknown;
    paymentReference?: unknown;
    failureCode?: unknown;
    failureMessage?: unknown;
  };
}

const eventStatuses: Readonly<Record<string, PaymentIntentStatus>> = {
  'payment.captured': PaymentIntentStatus.SUCCEEDED,
  'payment.failed': PaymentIntentStatus.FAILED,
  'payment.authorized': PaymentIntentStatus.PROCESSING,
};

/**
 * The in-process gateway used by development and CI. Nothing leaves the node.
 *
 * It is a mock in the sense that no money moves and no network call is made --
 * but the parts that decide whether the platform may believe a payment are
 * real. Signatures are genuine HMAC-SHA256 over the raw body, compared in
 * constant time, exactly as the Indian gateways sign theirs. So the
 * verification, rejection, deduplication and asynchronous-processing paths are
 * exercised for real in CI, and swapping in a live gateway changes the secret
 * and the payload mapping, not the security model.
 *
 * `MOCK-` prefixes every reference it mints, so a mock-settled payment stays
 * identifiable in the database for ever after.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly name = 'mock';
  readonly mode = PaymentProviderMode.MOCK;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async createIntent(input: CreateIntentInput): Promise<CreateIntentResult> {
    return {
      providerReference: input.reference,
      clientContext: {
        provider: this.name,
        checkoutUrl: `mock://checkout/${input.reference}`,
      },
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }

    const expected = Buffer.from(this.sign(rawBody), 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    // Length is checked separately: `timingSafeEqual` throws rather than
    // returning false when the buffers differ in length, and that throw would
    // itself leak the expected length.
    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    let body: MockWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as MockWebhookBody;
    } catch {
      throw new WebhookPayloadError('Webhook body is not valid JSON', 'INVALID_JSON');
    }

    const providerEventId = this.requireString(body.id, 'id');
    const eventType = this.requireString(body.event, 'event');
    const status = eventStatuses[eventType];
    if (!status) {
      throw new WebhookPayloadError(
        `Webhook event type ${eventType} is not handled`,
        'UNHANDLED_EVENT_TYPE',
      );
    }

    const reference = this.requireString(body.payload?.reference, 'payload.reference');
    const amountPaise = this.optionalAmount(body.payload?.amountPaise);
    if (status === PaymentIntentStatus.SUCCEEDED && amountPaise === null) {
      throw new WebhookPayloadError(
        'Captured payment webhook is missing payload.amountPaise',
        'MISSING_CAPTURE_AMOUNT',
      );
    }
    const providerPaymentReference = this.optionalString(body.payload?.paymentReference);
    const failureCode = this.optionalString(body.payload?.failureCode);
    const failureMessage = this.optionalString(body.payload?.failureMessage);

    return {
      providerEventId,
      eventType,
      reference,
      status,
      amountPaise,
      ...(providerPaymentReference ? { providerPaymentReference } : {}),
      ...(failureCode ? { failureCode } : {}),
      ...(failureMessage ? { failureMessage } : {}),
    };
  }

  /**
   * What this gateway believes about an intent.
   *
   * A real gateway answers from its own books. The mock has none, so it answers
   * from the webhooks it has already delivered -- the same information, just
   * held on our side of the wire. That makes desynchronisation genuinely
   * reproducible rather than simulated: a webhook that arrived, was stored, and
   * then failed to apply leaves the gateway saying `SUCCEEDED` while the
   * platform still says `PROCESSING`, which is exactly the condition
   * reconciliation exists to surface.
   */
  async fetchIntentStatus(providerReference: string): Promise<ProviderIntentStatus> {
    const events = await this.prisma.webhookEvent.findMany({
      where: { provider: this.name },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    });

    for (const event of events) {
      let parsed: ParsedWebhookEvent;
      try {
        parsed = this.parseWebhookEvent(Buffer.from(event.rawPayload, 'utf8'));
      } catch {
        continue;
      }
      if (parsed.reference !== providerReference) {
        continue;
      }

      return {
        providerReference,
        status: parsed.status,
        amountPaise: parsed.amountPaise,
        rawStatus: parsed.eventType,
        ...(parsed.providerPaymentReference
          ? { providerPaymentReference: parsed.providerPaymentReference }
          : {}),
      };
    }

    // No webhook yet: the gateway has an order open and nothing captured. That
    // is not a mismatch, it is a payment the farmer has not completed.
    return {
      providerReference,
      status: PaymentIntentStatus.PENDING,
      amountPaise: null,
      rawStatus: 'order.created',
    };
  }

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    this.logger.debug(
      JSON.stringify({
        message: 'Mock refund created',
        reference: input.reference,
        amountPaise: input.amountPaise,
      }),
    );

    return {
      providerRefundReference: `MOCK-REFUND-${randomUUID()}`,
      // The mock settles immediately. A real gateway usually does not, which is
      // why the caller must not assume `true`.
      settled: true,
    };
  }

  /** Signs a body the way the mock gateway would. Used by tests and tooling. */
  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.webhookSecret()).update(rawBody).digest('hex');
  }

  private webhookSecret(): string {
    return this.configService.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new WebhookPayloadError(`Webhook payload is missing ${field}`, 'MISSING_FIELD');
    }
    return value;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  private optionalAmount(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new WebhookPayloadError(
        'Webhook payload amountPaise must be a non-negative integer',
        'INVALID_AMOUNT',
      );
    }
    return value;
  }
}
