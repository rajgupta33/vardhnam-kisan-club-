import { createHmac, randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

const prisma = new PrismaClient();
const webhookSecret = 'integration-payment-webhook-secret';

describe('payment webhook ingress', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;

    await prisma.$connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('rejects a tampered signature and records a security audit without the raw body', async () => {
    if (!app) throw new Error('Nest application did not boot');

    const providerEventId = `evt_${randomUUID()}`;
    const rawBody = JSON.stringify({
      id: providerEventId,
      event: 'payment.captured',
      payload: {
        reference: `MOCK-${randomUUID()}`,
        amountPaise: 12500,
        paymentReference: `pay_${randomUUID()}`,
      },
    });
    const signature = createHmac('sha256', webhookSecret)
      .update(`${rawBody}tampered`)
      .digest('hex');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('content-type', 'application/json')
      .set('x-webhook-signature', signature)
      .send(rawBody)
      .expect(401);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'PAYMENT_WEBHOOK_SIGNATURE_REJECTED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.newValue).toEqual(
      expect.objectContaining({ provider: 'mock', bodyBytes: Buffer.byteLength(rawBody) }),
    );
    expect(JSON.stringify(audit.newValue)).not.toContain(providerEventId);
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it('does not expose a webhook route for an unconfigured provider', async () => {
    if (!app) throw new Error('Nest application did not boot');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/cashfree')
      .set('content-type', 'application/json')
      .set('x-webhook-signature', 'not-used')
      .send('{}')
      .expect(404);
  });
});
