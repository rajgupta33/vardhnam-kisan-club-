import type { NotificationChannel } from '@prisma/client';

/**
 * One outbound message, already localised and rendered. Providers format and
 * transmit; they never decide *whether* to send, who to send to, or in which
 * language -- those decisions belong to the dispatcher.
 */
export interface OutboundMessage {
  notificationId: string;
  /** Phone in E.164, email address, or device token, depending on channel. */
  destination: string;
  title: string;
  body: string;
  category: string;
  locale: string;
}

export interface SendResult {
  providerReferenceId: string;
}

/**
 * A transport for one channel.
 *
 * `send` throws on failure. The queue handler catches, records a failed attempt
 * and lets BullMQ retry with backoff, so a provider must not implement its own
 * retry loop -- that would multiply attempts and defeat the dead-letter budget.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;
  send(message: OutboundMessage): Promise<SendResult>;
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');

/**
 * Thrown when a message cannot be delivered and retrying will not help --
 * an unroutable recipient, say. The handler records the failure and does not
 * retry, so a permanently undeliverable message does not consume the whole
 * attempt budget before dead-lettering.
 */
export class PermanentDeliveryError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'PermanentDeliveryError';
  }
}
