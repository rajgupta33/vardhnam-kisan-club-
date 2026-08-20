import { Logger } from '@nestjs/common';
import type { NotificationChannel } from '@prisma/client';
import type {
  NotificationProvider,
  OutboundMessage,
  SendResult,
} from './notification-provider.interface';

/**
 * Records the message and reports success. Nothing leaves the process.
 *
 * This is what development and CI use, and it is deliberately loud about being
 * a mock: the provider reference is prefixed `MOCK-`, so a mock-delivered
 * notification is identifiable in the database and in the portal for ever
 * after. An operator must never have to guess whether a "sent" notification
 * actually went anywhere.
 *
 * The body is logged at debug level only. Notification bodies contain order
 * numbers, amounts and names, and in the OTP case the code itself; logging them
 * at info level would scatter that across every log sink.
 */
export class MockNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(MockNotificationProvider.name);
  readonly name = 'mock';

  constructor(readonly channel: NotificationChannel) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    this.logger.debug(
      JSON.stringify({
        message: 'Mock notification delivered',
        channel: this.channel,
        notificationId: message.notificationId,
        category: message.category,
        locale: message.locale,
      }),
    );

    return {
      providerReferenceId: `MOCK-${this.channel}-${message.notificationId.slice(0, 8).toUpperCase()}`,
    };
  }
}
