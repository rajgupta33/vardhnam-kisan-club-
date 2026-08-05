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
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

describe('Notifications abstraction', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedNotificationData>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedNotificationData();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  async function enqueue(server: Parameters<typeof request>[0], recipientUserId: string) {
    const response = await request(server)
      .post('/api/v1/notifications')
      .set(seeded.operationsHeaders)
      .send({
        recipientUserId,
        channel: NotificationChannel.SMS,
        category: 'SUPPORT_TICKET_ASSIGNED',
        title: 'Your ticket was assigned',
        body: 'A support agent has been assigned to your ticket.',
      })
      .expect(201);
    return response.body.data.id as string;
  }

  it('enqueues a notification for a real recipient', async () => {
    const server = requireServer();
    const response = await request(server)
      .post('/api/v1/notifications')
      .set(seeded.operationsHeaders)
      .send({
        recipientUserId: seeded.farmerUserId,
        channel: NotificationChannel.EMAIL,
        category: 'ORDER_DELIVERED',
        title: 'Your order was delivered',
        body: 'Your order has been delivered successfully.',
      })
      .expect(201);
    expect(response.body.data.status).toBe(NotificationStatus.PENDING);
    expect(response.body.data.channel).toBe(NotificationChannel.EMAIL);
  });

  it('rejects enqueue by a role without NOTIFICATIONS_MANAGE', async () => {
    await request(requireServer())
      .post('/api/v1/notifications')
      .set(seeded.farmerHeaders)
      .send({
        recipientUserId: seeded.farmerUserId,
        channel: NotificationChannel.IN_APP,
        category: 'TEST',
        title: 'Test',
        body: 'Test body',
      })
      .expect(403);

    await request(requireServer())
      .post('/api/v1/notifications')
      .set(seeded.supportAgentHeaders)
      .send({
        recipientUserId: seeded.farmerUserId,
        channel: NotificationChannel.IN_APP,
        category: 'TEST',
        title: 'Test',
        body: 'Test body',
      })
      .expect(403);
  });

  it('404s when the recipient does not exist', async () => {
    await request(requireServer())
      .post('/api/v1/notifications')
      .set(seeded.operationsHeaders)
      .send({
        recipientUserId: randomUUID(),
        channel: NotificationChannel.PUSH,
        category: 'TEST',
        title: 'Test',
        body: 'Test body',
      })
      .expect(404);
  });

  it('runs the attempt/retry lifecycle and rejects attempting an already-sent notification', async () => {
    const server = requireServer();
    const notificationId = await enqueue(server, seeded.farmerUserId);

    const failedResponse = await request(server)
      .post(`/api/v1/notifications/${notificationId}/attempt`)
      .set(seeded.operationsHeaders)
      .send({ outcome: 'FAILED', errorCode: 'MOCK_DOWN', errorMessage: 'Mock SMS gateway unreachable' })
      .expect(201);
    expect(failedResponse.body.data.status).toBe(NotificationStatus.FAILED);
    expect(failedResponse.body.data.attemptCount).toBe(1);

    const sentResponse = await request(server)
      .post(`/api/v1/notifications/${notificationId}/attempt`)
      .set(seeded.operationsHeaders)
      .send({ outcome: 'SENT' })
      .expect(201);
    expect(sentResponse.body.data.status).toBe(NotificationStatus.SENT);
    expect(sentResponse.body.data.attemptCount).toBe(2);
    expect(sentResponse.body.data.providerReferenceId).toBeTruthy();

    await request(server)
      .post(`/api/v1/notifications/${notificationId}/attempt`)
      .set(seeded.operationsHeaders)
      .send({ outcome: 'SENT' })
      .expect(409);
  });

  it('scopes /notifications/me to the recipient and rejects reading someone else\'s notification', async () => {
    const server = requireServer();
    const notificationId = await enqueue(server, seeded.farmerUserId);

    const myNotificationsResponse = await request(server)
      .get('/api/v1/notifications/me')
      .set(seeded.farmerHeaders)
      .expect(200);
    const myNotifications = myNotificationsResponse.body.data.items as Array<{ recipientUserId: string }>;
    expect(myNotifications.length).toBeGreaterThan(0);
    expect(myNotifications.every((n) => n.recipientUserId === seeded.farmerUserId)).toBe(true);

    await request(server)
      .get(`/api/v1/notifications/${notificationId}`)
      .set(seeded.farmerHeaders)
      .expect(200);

    await request(server)
      .get(`/api/v1/notifications/${notificationId}`)
      .set(seeded.otherFarmerHeaders)
      .expect(403);

    const otherFarmerNotificationsResponse = await request(server)
      .get('/api/v1/notifications/me')
      .set(seeded.otherFarmerHeaders)
      .expect(200);
    expect(otherFarmerNotificationsResponse.body.data.items).toHaveLength(0);
  });

  it('marks a notification read and is idempotent on a second call', async () => {
    const server = requireServer();
    const notificationId = await enqueue(server, seeded.farmerUserId);

    const firstReadResponse = await request(server)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set(seeded.farmerHeaders)
      .expect(201);
    expect(firstReadResponse.body.data.readAt).toBeTruthy();

    const secondReadResponse = await request(server)
      .post(`/api/v1/notifications/${notificationId}/read`)
      .set(seeded.farmerHeaders)
      .expect(201);
    expect(secondReadResponse.body.data.readAt).toBe(firstReadResponse.body.data.readAt);
  });

  it('enforces permissions across roles', async () => {
    const server = requireServer();

    await request(server).get('/api/v1/notifications').expect(401);

    await request(server)
      .get('/api/v1/notifications')
      .set(seeded.farmerHeaders)
      .expect(403);

    await request(server)
      .get('/api/v1/notifications')
      .set(seeded.supportAgentHeaders)
      .expect(200);
    await request(server)
      .post('/api/v1/notifications')
      .set(seeded.supportAgentHeaders)
      .send({
        recipientUserId: seeded.farmerUserId,
        channel: NotificationChannel.IN_APP,
        category: 'TEST',
        title: 'Test',
        body: 'Test body',
      })
      .expect(403);

    await request(server)
      .get('/api/v1/notifications')
      .set(seeded.operationsHeaders)
      .expect(200);
    await request(server)
      .post('/api/v1/notifications')
      .set(seeded.operationsHeaders)
      .send({
        recipientUserId: seeded.farmerUserId,
        channel: NotificationChannel.IN_APP,
        category: 'TEST',
        title: 'Test',
        body: 'Test body',
      })
      .expect(201);
  });
});

async function seedNotificationData(): Promise<{
  operationsHeaders: Headers;
  supportAgentHeaders: Headers;
  farmerHeaders: Headers;
  otherFarmerHeaders: Headers;
  farmerUserId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `notif-admin-${suffix}`,
    legalName: 'Notifications Admin Organisation',
    displayName: 'Notifications Admin',
  });
  const operationsUser = await createUser(`notif-ops-${suffix}@example.local`, 'Notifications Operations Manager');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);
  const supportAgentUser = await createUser(`notif-agent-${suffix}@example.local`, 'Notifications Support Agent');
  await createMembership(supportAgentUser.id, adminOrganisation.id, PlatformRole.SUPPORT_AGENT);

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `notif-farmer-context-${suffix}`,
    legalName: 'Notifications Farmer Context',
    displayName: 'Notifications Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91007${short}`,
      profile: { create: { displayName: 'Notifications Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const otherFarmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `notif-other-farmer-context-${suffix}`,
    legalName: 'Other Notifications Farmer Context',
    displayName: 'Other Notifications Farmer Context',
  });
  const otherFarmerUser = await prisma.user.create({
    data: {
      phone: `+91006${short}`,
      profile: { create: { displayName: 'Other Notifications Farmer' } },
    },
  });
  await createMembership(otherFarmerUser.id, otherFarmerOrganisation.id, PlatformRole.FARMER);

  return {
    operationsHeaders: headersFor(operationsUser.id, PlatformRole.OPERATIONS_MANAGER, adminOrganisation.id),
    supportAgentHeaders: headersFor(supportAgentUser.id, PlatformRole.SUPPORT_AGENT, adminOrganisation.id),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    otherFarmerHeaders: headersFor(otherFarmerUser.id, PlatformRole.FARMER, otherFarmerOrganisation.id),
    farmerUserId: farmerUser.id,
  };
}

function headersFor(userId: string, role: PlatformRole, organisationId: string): Headers {
  return {
    'x-user-id': userId,
    'x-user-role': role,
    'x-organisation-id': organisationId,
  };
}

async function createOrganisation(input: {
  type: OrganisationType;
  slug: string;
  legalName: string;
  displayName: string;
}) {
  return prisma.organisation.create({
    data: {
      type: input.type,
      slug: input.slug,
      legalName: input.legalName,
      displayName: input.displayName,
      status: OrganisationStatus.ACTIVE,
    },
  });
}

async function createUser(email: string, displayName: string) {
  return prisma.user.create({
    data: {
      email,
      profile: { create: { displayName } },
    },
  });
}

async function createMembership(userId: string, organisationId: string, role: PlatformRole): Promise<void> {
  await prisma.organisationMembership.create({
    data: {
      userId,
      organisationId,
      role,
      status: MembershipStatus.ACTIVE,
    },
  });
}

async function seedPermissions(): Promise<void> {
  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionByCode.set(savedPermission.code, savedPermission.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing permission ${permissionCode}`);
      }
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as PlatformRole,
            permissionId,
          },
        },
        create: {
          role: role as PlatformRole,
          permissionId,
        },
        update: {},
      });
    }
  }
}
