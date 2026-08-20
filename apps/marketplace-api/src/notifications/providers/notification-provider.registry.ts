import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { MockNotificationProvider } from './mock-notification.provider';
import type { NotificationProvider } from './notification-provider.interface';

/**
 * Chooses the transport for each channel from the existing provider env flags.
 *
 * `IN_APP` has no provider and never appears here: an in-app notification is
 * satisfied by its own database row plus `GET /notifications/me`, so it is
 * delivered the moment it is created.
 */
const channelEnvVar: Readonly<Record<Exclude<NotificationChannel, 'IN_APP'>, string>> = {
  [NotificationChannel.SMS]: 'SMS_PROVIDER',
  [NotificationChannel.WHATSAPP]: 'WHATSAPP_PROVIDER',
  [NotificationChannel.EMAIL]: 'EMAIL_PROVIDER',
  [NotificationChannel.PUSH]: 'PUSH_PROVIDER',
};

@Injectable()
export class NotificationProviderRegistry {
  private readonly providers = new Map<NotificationChannel, NotificationProvider>();

  constructor(private readonly configService: ConfigService) {}

  /** Returns undefined for `IN_APP`, which needs no transport. */
  forChannel(channel: NotificationChannel): NotificationProvider | undefined {
    if (channel === NotificationChannel.IN_APP) {
      return undefined;
    }

    const cached = this.providers.get(channel);
    if (cached) {
      return cached;
    }

    const provider = this.create(channel);
    this.providers.set(channel, provider);
    return provider;
  }

  /** Whether this channel is currently backed by a mock transport. */
  isMock(channel: NotificationChannel): boolean {
    return this.forChannel(channel)?.name === 'mock';
  }

  private create(channel: Exclude<NotificationChannel, 'IN_APP'>): NotificationProvider {
    const configured = this.configService.get<string>(channelEnvVar[channel]) ?? 'mock';

    if (configured === 'mock') {
      return new MockNotificationProvider(channel);
    }

    // Fails loudly rather than falling back to the mock. A silent fallback would
    // mean the platform believes it sent an OTP that never left the process --
    // the user simply never receives it and cannot log in, with nothing in the
    // logs to say why.
    throw new Error(
      `${channelEnvVar[channel]}=${configured} is not implemented. Add a NotificationProvider for ${channel} before enabling it.`,
    );
  }
}
