import { createHmac } from 'node:crypto';
import { PaymentIntentStatus, PaymentProviderMode } from '@prisma/client';
import { MockPaymentProvider } from '../src/payments/providers/mock-payment.provider';
import {
  WebhookPayloadError,
  type PaymentProvider,
} from '../src/payments/providers/payment-provider.interface';
import { PaymentProviderRegistry } from '../src/payments/providers/payment-provider.registry';

const secret = 'webhook-secret-for-unit-tests';

function providerWith(config: Record<string, unknown> = {}): MockPaymentProvider {
  const configService = {
    get: (key: string) => config[key],
    getOrThrow: (key: string) => {
      const value = config[key] ?? (key === 'PAYMENT_WEBHOOK_SECRET' ? secret : undefined);
      if (value === undefined) {
        throw new Error(`${key} is not configured`);
      }
      return value;
    },
  };
  const prisma = { webhookEvent: { findMany: jest.fn().mockResolvedValue([]) } };
  return new MockPaymentProvider(configService as never, prisma as never);
}

function body(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      id: 'evt_1',
      event: 'payment.captured',
      payload: {
        reference: 'mock_abc',
        amountPaise: 236000,
        paymentReference: 'pay_1',
      },
      ...overrides,
    }),
    'utf8',
  );
}

function sign(raw: Buffer): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

describe('MockPaymentProvider webhook signatures', () => {
  it('accepts a body signed with the configured secret', () => {
    const provider = providerWith();
    const raw = body();

    expect(provider.verifyWebhookSignature(raw, sign(raw))).toBe(true);
  });

  it('rejects a body whose bytes were altered after signing', () => {
    const provider = providerWith();
    const original = body();
    const signature = sign(original);
    const tampered = Buffer.from(original.toString('utf8').replace('236000', '1'), 'utf8');

    expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const provider = providerWith();
    const raw = body();
    const forged = createHmac('sha256', 'not-the-secret').update(raw).digest('hex');

    expect(provider.verifyWebhookSignature(raw, forged)).toBe(false);
  });

  it('rejects a missing or truncated signature without throwing', () => {
    const provider = providerWith();
    const raw = body();

    expect(provider.verifyWebhookSignature(raw, undefined)).toBe(false);
    expect(provider.verifyWebhookSignature(raw, '')).toBe(false);
    // A shorter buffer would make `timingSafeEqual` throw if the length were
    // not checked first, and that throw would itself leak the expected length.
    expect(provider.verifyWebhookSignature(raw, sign(raw).slice(0, 10))).toBe(false);
  });

  it('is insensitive to key order only through the raw bytes, never the object', () => {
    const provider = providerWith();
    const raw = body();
    const signature = sign(raw);
    // Same data, different serialisation. A verifier that re-serialised the
    // parsed object would call this identical; a byte-exact one must not.
    const reordered = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        id: 'evt_1',
        payload: { amountPaise: 236000, reference: 'mock_abc', paymentReference: 'pay_1' },
      }),
      'utf8',
    );

    expect(provider.verifyWebhookSignature(reordered, signature)).toBe(false);
  });
});

describe('MockPaymentProvider payload parsing', () => {
  it('maps a capture onto a succeeded intent', () => {
    const parsed = providerWith().parseWebhookEvent(body());

    expect(parsed).toMatchObject({
      providerEventId: 'evt_1',
      eventType: 'payment.captured',
      reference: 'mock_abc',
      status: PaymentIntentStatus.SUCCEEDED,
      amountPaise: 236000,
      providerPaymentReference: 'pay_1',
    });
  });

  it('maps an authorisation onto a non-terminal status', () => {
    const parsed = providerWith().parseWebhookEvent(body({ event: 'payment.authorized' }));

    expect(parsed.status).toBe(PaymentIntentStatus.PROCESSING);
  });

  it('refuses an event type it does not handle', () => {
    expect(() => providerWith().parseWebhookEvent(body({ event: 'refund.speculated' }))).toThrow(
      WebhookPayloadError,
    );
  });

  it('refuses a payload with no reference to match against', () => {
    expect(() => providerWith().parseWebhookEvent(body({ payload: { amountPaise: 1 } }))).toThrow(
      WebhookPayloadError,
    );
  });

  it('refuses a non-integer amount rather than coercing it', () => {
    expect(() =>
      providerWith().parseWebhookEvent(
        body({ payload: { reference: 'mock_abc', amountPaise: 1250.5 } }),
      ),
    ).toThrow(WebhookPayloadError);
  });

  it('refuses a captured payment without an authoritative amount', () => {
    expect(() =>
      providerWith().parseWebhookEvent(
        body({ payload: { reference: 'mock_abc', paymentReference: 'pay_1' } }),
      ),
    ).toThrow(/missing payload\.amountPaise/);
  });

  it('refuses a body that is not JSON', () => {
    expect(() => providerWith().parseWebhookEvent(Buffer.from('<html>error</html>'))).toThrow(
      WebhookPayloadError,
    );
  });
});

describe('PaymentProviderRegistry', () => {
  function registryFor(configured: string | undefined): PaymentProviderRegistry {
    const configService = {
      get: (key: string) => (key === 'PAYMENT_PROVIDER' ? configured : undefined),
    };
    return new PaymentProviderRegistry(configService as never, providerWith());
  }

  it('defaults to the mock gateway', () => {
    const provider: PaymentProvider = registryFor(undefined).current();

    expect(provider.name).toBe('mock');
    expect(provider.mode).toBe(PaymentProviderMode.MOCK);
  });

  it('refuses to start on a gateway that has no implementation', () => {
    // A silent fallback to the mock would mean the platform believes it took a
    // farmer's money when nothing was charged.
    expect(() => registryFor('razorpay').current()).toThrow(/not implemented/);
  });

  it('does not resolve a webhook route for a gateway it is not configured for', () => {
    expect(registryFor('mock').forWebhookProvider('cashfree')).toBeUndefined();
    expect(registryFor('mock').forWebhookProvider('mock')?.name).toBe('mock');
  });
});
