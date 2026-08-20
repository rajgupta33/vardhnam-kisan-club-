import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  NotificationChannel,
  NotificationStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { NotificationDeliveryService } from '../../src/notifications/notification-delivery.service';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

describe('Notification delivery', () => {
  let app: INestApplication;
  let delivery: NotificationDeliveryService;
  let farmerUserId: string;
  let farmerHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();

    delivery = app.get(NotificationDeliveryService);

    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `notify-${randomUUID()}`,
        legalName: 'Notification Test Context',
        displayName: 'Notification Test Context',
        status: OrganisationStatus.ACTIVE,
      },
    });

    const farmer = await prisma.user.create({
      data: {
        phone: `+9195${randomDigits()}`,
        farmerProfile: {
          create: { fullName: 'Notify Farmer', primaryPincode: '302001', preferredLocale: 'hi-IN' },
        },
      },
    });
    farmerUserId = farmer.id;
    await prisma.organisationMembership.create({
      data: {
        userId: farmer.id,
        organisationId: organisation.id,
        role: PlatformRole.FARMER,
        status: MembershipStatus.ACTIVE,
      },
    });
    farmerHeaders = headers(farmer.id, PlatformRole.FARMER, organisation.id);

    const admin = await prisma.user.create({ data: { phone: `+9196${randomDigits()}` } });
    await prisma.organisationMembership.create({
      data: {
        userId: admin.id,
        organisationId: organisation.id,
        role: PlatformRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    adminHeaders = headers(admin.id, PlatformRole.ADMIN, organisation.id);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('sends a pending SMS through the provider and records the attempt', async () => {
    const notification = await createNotification(NotificationChannel.SMS, 'ORDER_DELIVERED');

    const outcome = await delivery.deliver(notification.id);

    expect(outcome.status).toBe(NotificationStatus.SENT);
    // The mock transport is identifiable for ever after, so nobody can mistake a
    // mock-delivered notification for one that actually reached a phone.
    expect(outcome.providerReferenceId).toMatch(/^MOCK-SMS-/);

    const stored = await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(stored.status).toBe(NotificationStatus.SENT);
    expect(stored.attemptCount).toBe(1);

    const attempts = await prisma.notificationAttempt.findMany({
      where: { notificationId: notification.id },
    });
    expect(attempts).toHaveLength(1);
    // The worker made this attempt, not a person.
    expect(attempts[0]?.performedByUserId).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'NOTIFICATION_SENT', resourceId: notification.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBeNull();
    expect(audit?.reason).toContain('job:send-notification');
  });

  it('treats a replayed delivery as a no-op rather than sending twice', async () => {
    const notification = await createNotification(NotificationChannel.SMS, 'ORDER_DELIVERED');

    await delivery.deliver(notification.id);
    const second = await delivery.deliver(notification.id);

    expect(second.skippedReason).toBe('ALREADY_SENT');
    const stored = await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(stored.attemptCount).toBe(1);
  });

  it('records a failure when the recipient has no destination for the channel', async () => {
    // Push has no device-token registration yet, so it must record an explicit
    // failure rather than silently reporting success.
    const notification = await createNotification(NotificationChannel.PUSH, 'ORDER_DELIVERED');

    const outcome = await delivery.deliver(notification.id);

    expect(outcome.status).toBe(NotificationStatus.FAILED);
    expect(outcome.skippedReason).toBe('NO_DESTINATION');
  });

  it('delivers an in-app notification without a transport', async () => {
    const notification = await createNotification(NotificationChannel.IN_APP, 'ORDER_DELIVERED');

    const outcome = await delivery.deliver(notification.id);

    expect(outcome.status).toBe(NotificationStatus.SENT);
    expect(outcome.providerReferenceId).toBeUndefined();
  });

  it('suppresses an opted-out optional category, and records why', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/notifications/preferences/me')
      .set(farmerHeaders)
      .send({ preferences: [{ category: 'ADVISORY', channel: 'SMS', enabled: false }] })
      .expect(200);

    const notification = await createNotification(NotificationChannel.SMS, 'ADVISORY');
    const outcome = await delivery.deliver(notification.id);

    expect(outcome.skippedReason).toBe('SUPPRESSED_BY_PREFERENCE');
    // Recorded as failed rather than sent: claiming delivery for a message
    // deliberately not sent would make the notification log untrustworthy.
    expect(outcome.status).toBe(NotificationStatus.FAILED);
  });

  it('refuses to let a recipient switch off a transactional category', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/notifications/preferences/me')
      .set(farmerHeaders)
      .send({ preferences: [{ category: 'ORDER_DELIVERED', channel: 'SMS', enabled: false }] })
      .expect(400);

    expect(response.body.error.details.rejectedCategories).toContain('ORDER_DELIVERED');
  });

  it('still delivers a transactional category even with a stale disabled preference', async () => {
    // A category can be reclassified as the domain grows; a preference saved
    // while it was optional must not silence it afterwards.
    await prisma.notificationPreference.create({
      data: {
        userId: farmerUserId,
        category: 'ORDER_DELIVERED',
        channel: NotificationChannel.SMS,
        enabled: false,
      },
    });

    const notification = await createNotification(NotificationChannel.SMS, 'ORDER_DELIVERED');
    const outcome = await delivery.deliver(notification.id);

    expect(outcome.status).toBe(NotificationStatus.SENT);
  });

  it('exposes which categories a recipient may adjust', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences/me')
      .set(farmerHeaders)
      .expect(200);

    expect(response.body.data.optOutableCategories).toContain('ADVISORY');
    expect(response.body.data.optOutableCategories).not.toContain('ORDER_DELIVERED');
  });

  it('lets operations re-queue a failed notification for delivery', async () => {
    const notification = await createNotification(NotificationChannel.SMS, 'ORDER_DELIVERED');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/notifications/${notification.id}/dispatch`)
      .set(adminHeaders)
      .expect(201);

    expect(response.body.data.queued).toBe(true);
  });

  async function createNotification(channel: NotificationChannel, category: string) {
    return prisma.notification.create({
      data: {
        recipientUserId: farmerUserId,
        channel,
        category,
        title: 'ऑर्डर वितरित',
        body: 'आपका ऑर्डर वितरित कर दिया गया है।',
        status: NotificationStatus.PENDING,
      },
    });
  }

  function randomDigits(): string {
    return String(Math.floor(10000000 + Math.random() * 89999999));
  }

  function headers(
    userId: string,
    role: PlatformRole,
    organisationId: string,
  ): Record<string, string> {
    return {
      'x-user-id': userId,
      'x-user-role': role,
      'x-organisation-id': organisationId,
    };
  }
});
