import { Module } from '@nestjs/common';
import { OtpSenderService } from './otp-sender.service';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';

/**
 * The transport layer on its own, depending on nothing but configuration.
 *
 * `AuthModule` needs to send OTPs and is `@Global`, sitting below
 * `NotificationsModule` in the dependency graph (`NotificationsModule` →
 * `AccessModule` → `AuthModule`). Importing the full notifications module there
 * would close that loop. Keeping providers and the OTP sender in a leaf module
 * lets both import it without a `forwardRef`.
 */
@Module({
  providers: [NotificationProviderRegistry, OtpSenderService],
  exports: [NotificationProviderRegistry, OtpSenderService],
})
export class NotificationTransportModule {}
