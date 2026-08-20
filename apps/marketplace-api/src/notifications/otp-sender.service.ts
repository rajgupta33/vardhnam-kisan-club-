import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import { renderOtpMessage } from './notification-templates';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';

export interface OtpDispatchResult {
  /** True when the code was handed to a real transport. */
  delivered: boolean;
  /**
   * The code itself, returned **only** when SMS is mocked so local and CI
   * callers can complete a login. Never populated against a real provider.
   */
  mockOtpCode?: string;
}

/**
 * Sends one-time codes over SMS.
 *
 * OTPs deliberately do **not** go through the `Notification` table. A row there
 * is readable through `GET /notifications/me`, so persisting the code would let
 * anyone holding a session read a code sent to a phone they do not control --
 * defeating the point of a second factor. The code is rendered and handed
 * straight to the provider, and only its hash is stored, on `OtpChallenge`.
 *
 * Delivery is synchronous rather than queued: a user is staring at a code entry
 * screen, and a queue hop adds latency with no benefit. A failure to send is
 * surfaced to the caller so they can retry, rather than being swallowed.
 */
@Injectable()
export class OtpSenderService {
  private readonly logger = new Logger(OtpSenderService.name);

  constructor(
    private readonly providers: NotificationProviderRegistry,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(input: {
    phone: string;
    code: string;
    expiryMinutes: number;
    locale?: string | undefined;
    /** Correlates the send with the challenge that produced it. */
    challengeId: string;
  }): Promise<OtpDispatchResult> {
    const provider = this.providers.forChannel(NotificationChannel.SMS);
    const isMock = this.providers.isMock(NotificationChannel.SMS);

    if (!provider) {
      throw new Error('No SMS provider is configured for OTP delivery');
    }

    const body = renderOtpMessage(input.code, input.expiryMinutes, input.locale ?? 'en-IN');

    await provider.send({
      notificationId: input.challengeId,
      destination: input.phone,
      title: 'Vardhnam OTP',
      body,
      category: 'AUTH_OTP',
      locale: input.locale ?? 'en-IN',
    });

    this.logger.log(
      JSON.stringify({
        message: 'OTP dispatched',
        challengeId: input.challengeId,
        provider: provider.name,
        // Neither the code nor the full phone number is logged.
        phoneSuffix: input.phone.slice(-4),
      }),
    );

    return {
      delivered: !isMock,
      ...(isMock ? { mockOtpCode: input.code } : {}),
    };
  }

  /**
   * Whether SMS is still mocked. Used by the go-live checks and by callers that
   * must not expose a code in a response.
   */
  isSmsMocked(): boolean {
    return this.providers.isMock(NotificationChannel.SMS);
  }
}
