import type { PaymentIntentStatus, PaymentProviderMode } from '@prisma/client';

/**
 * A payment gateway behind one interface.
 *
 * The contract is deliberately narrow, because the trust boundary is the whole
 * point of this abstraction. A provider translates between the gateway's own
 * vocabulary and the platform's; it never decides whether a payment is valid,
 * never writes to the database, and never marks anything succeeded. Only the
 * services above it do that, and only from a signature-verified webhook or an
 * explicit server-side status fetch.
 */

export interface CreateIntentInput {
  /** Our own reference for the intent, unique across the platform. */
  reference: string;
  amountPaise: number;
  currency: string;
  /** Opaque, non-sensitive context echoed back by the gateway on webhooks. */
  notes: Record<string, string>;
}

export interface CreateIntentResult {
  /** The gateway's identifier for the order/intent it just created. */
  providerReference: string;
  /** What the client needs to open the gateway's checkout, if anything. */
  clientContext?: Record<string, string>;
}

/** The gateway's own view of an intent, normalised. */
export interface ProviderIntentStatus {
  providerReference: string;
  status: PaymentIntentStatus;
  /**
   * Amount the gateway believes it captured. `null` when the gateway has not
   * captured anything yet. Never trusted from a client, only from here.
   */
  amountPaise: number | null;
  /** The gateway's raw status word, kept for reconciliation reporting. */
  rawStatus: string;
  providerPaymentReference?: string;
}

export interface CreateRefundInput {
  /** Our own reference for the refund, used as the gateway idempotency key. */
  reference: string;
  /** The gateway's payment reference the refund is taken against. */
  providerPaymentReference: string;
  amountPaise: number;
  notes: Record<string, string>;
}

export interface CreateRefundResult {
  providerRefundReference: string;
  /** `false` when the gateway accepted the refund but has not settled it yet. */
  settled: boolean;
}

/** A webhook body that passed signature verification, parsed into our terms. */
export interface ParsedWebhookEvent {
  /** The gateway's own event id. Deduplication depends on it being stable. */
  providerEventId: string;
  /** The gateway's event name, stored verbatim for diagnosis. */
  eventType: string;
  /** Our intent reference, recovered from the payload. */
  reference: string;
  status: PaymentIntentStatus;
  /**
   * The authoritative amount, read from the gateway's payload. The platform
   * compares this against the intent and refuses to apply a mismatch.
   */
  amountPaise: number | null;
  providerPaymentReference?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;
  readonly mode: PaymentProviderMode;

  createIntent(input: CreateIntentInput): Promise<CreateIntentResult>;

  /**
   * Byte-exact verification against the raw request body.
   *
   * Takes a `Buffer`, not a parsed object: re-serialising JSON reorders keys and
   * changes whitespace, and the resulting signature would never match. Returns
   * a boolean rather than throwing so the caller owns the response and the
   * security log entry.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;

  /** Throws `WebhookPayloadError` when the body is not an event we understand. */
  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent;

  fetchIntentStatus(providerReference: string): Promise<ProviderIntentStatus>;

  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * Thrown when a signature-verified body still cannot be interpreted.
 *
 * Signature verification passing means the body genuinely came from the
 * gateway, so this is not an attack -- it is a payload shape we do not handle,
 * such as an event type we never subscribed to. The webhook row is kept and
 * marked `FAILED` with the reason, and the job does not retry, because
 * re-parsing identical bytes will fail identically.
 */
export class WebhookPayloadError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}

/**
 * Thrown when the gateway itself is unreachable or errored.
 *
 * Distinct from `WebhookPayloadError` because this one *is* worth retrying:
 * BullMQ backs off and tries again rather than dead-lettering a transient
 * network fault.
 */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
