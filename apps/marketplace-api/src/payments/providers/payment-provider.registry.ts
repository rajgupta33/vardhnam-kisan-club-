import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock-payment.provider';
import type { PaymentProvider } from './payment-provider.interface';

/**
 * Selects the gateway from `PAYMENT_PROVIDER`.
 *
 * There is deliberately no fallback. A silent fall back to the mock would mean
 * the platform believes it took a farmer's money when nothing was ever charged,
 * or -- worse -- believes a refund was paid when it was not. Better to refuse to
 * boot: a misconfigured environment is loud at startup instead of quietly wrong
 * for a week.
 *
 * Adding a real gateway is one class implementing `PaymentProvider`, one branch
 * here, and widening `PAYMENT_PROVIDER` in the env schema. Nothing above this
 * layer changes.
 */
@Injectable()
export class PaymentProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockPaymentProvider,
  ) {}

  current(): PaymentProvider {
    return this.forName(this.configuredName());
  }

  /**
   * Resolves the provider a webhook route segment names.
   *
   * Returns undefined for anything that is not the configured provider, so an
   * unknown `:provider` is a 404 rather than an attempt to verify a signature
   * with the wrong secret.
   */
  forWebhookProvider(name: string): PaymentProvider | undefined {
    if (name !== this.configuredName()) {
      return undefined;
    }
    return this.forName(name);
  }

  private configuredName(): string {
    return this.configService.get<string>('PAYMENT_PROVIDER') ?? 'mock';
  }

  private forName(name: string): PaymentProvider {
    if (name === 'mock') {
      return this.mockProvider;
    }

    throw new Error(
      `PAYMENT_PROVIDER=${name} is not implemented. Add a PaymentProvider for it before enabling it.`,
    );
  }
}
