import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  KisanClubMembershipStatus,
  MembershipStatus,
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
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

describe('Kisan Club membership', () => {
  let app: INestApplication;
  let farmerHeaders: Record<string, string>;
  let operationsHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);

    const suffix = randomUUID();
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `kisan-club-${suffix}`,
        legalName: 'Vardhnam Kisan Club Test Context',
        displayName: 'Kisan Club Test Context',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [farmer, operationsUser] = await Promise.all([
      prisma.user.create({
        data: {
          phone: `+919${Math.floor(100000000 + Math.random() * 899999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Kisan Club Test Farmer',
              preferredLocale: 'hi-IN',
              primaryPincode: '207001',
            },
          },
        },
      }),
      prisma.user.create({
        data: { email: `kisan-club-ops-${suffix}@example.local` },
      }),
    ]);
    const [farmerOrganisationMembership] = await Promise.all([
      prisma.organisationMembership.create({
        data: {
          userId: farmer.id,
          organisationId: organisation.id,
          role: PlatformRole.FARMER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.organisationMembership.create({
        data: {
          userId: operationsUser.id,
          organisationId: organisation.id,
          role: PlatformRole.OPERATIONS_MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);

    farmerHeaders = authHeaders(farmer.id, PlatformRole.FARMER, organisation.id);
    operationsHeaders = authHeaders(
      operationsUser.id,
      PlatformRole.OPERATIONS_MANAGER,
      organisation.id,
    );
    expect(farmerOrganisationMembership.userId).toBe(farmer.id);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('represents an enabled non-member without exposing staff membership search', async () => {
    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/membership/me')
      .set(farmerHeaders)
      .expect(200);
    expect(meResponse.body.data).toBeNull();

    await request(app.getHttpServer())
      .get('/api/v1/kisan-club/memberships')
      .set(farmerHeaders)
      .expect(403);
  });

  it('requires explicit terms acceptance and creates one free pending membership', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/membership')
      .set(farmerHeaders)
      .send({ homePincode: '207001', termsVersion: 'v1', termsAccepted: false })
      .expect(400);

    const response = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/membership')
      .set(farmerHeaders)
      .send({
        homePincode: '207001',
        homeVillage: 'Etah Rural',
        homeDistrict: 'Etah',
        homeState: 'Uttar Pradesh',
        termsVersion: 'v1',
        termsAccepted: true,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      status: KisanClubMembershipStatus.PENDING_PROFILE,
      homePincode: '207001',
      termsVersion: 'v1',
      advisoryConsent: false,
      marketingConsent: false,
      preciseLocationConsent: false,
    });
    expect(response.body.data.memberNumber).toMatch(/^VKC-\d{8}-[A-F0-9]{8}$/);

    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/membership')
      .set(farmerHeaders)
      .send({ homePincode: '207001', termsVersion: 'v1', termsAccepted: true })
      .expect(409);
  });

  it('updates each optional consent independently and records the change', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(farmerHeaders)
      .send({ advisoryConsent: true })
      .expect(200);

    expect(response.body.data).toMatchObject({
      advisoryConsent: true,
      marketingConsent: false,
      preciseLocationConsent: false,
    });
    expect(response.body.data.advisoryConsentAt).toEqual(expect.any(String));
    expect(
      await prisma.auditLog.count({
        where: {
          resourceId: response.body.data.id,
          action: 'KISAN_CLUB_CONSENTS_UPDATED',
        },
      }),
    ).toBe(1);
  });

  it('allows staff UUID management and member-number search without exposing it as a route key', async () => {
    const membership = await prisma.kisanClubMembership.findFirstOrThrow();
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/memberships')
      .query({ q: membership.memberNumber })
      .set(operationsHeaders)
      .expect(200);
    expect(listResponse.body.data.total).toBe(1);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/memberships/${membership.id}`)
      .set(operationsHeaders)
      .expect(200);
    expect(detailResponse.body.data).toMatchObject({
      id: membership.id,
      memberNumber: membership.memberNumber,
      farmerProfile: { fullName: expect.any(String) },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/memberships/${membership.id}`)
      .set(farmerHeaders)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/kisan-club/memberships/${membership.id}/suspend`)
      .set(operationsHeaders)
      .send({ reason: 'Test operations review' })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(farmerHeaders)
      .send({ marketingConsent: true })
      .expect(409);
  });

  it('lets the farmer close membership and revokes active optional consents', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/membership/me/close')
      .set(farmerHeaders)
      .send({ reason: 'Farmer requested closure' })
      .expect(201);
    expect(response.body.data).toMatchObject({
      status: KisanClubMembershipStatus.CLOSED,
      advisoryConsent: false,
      marketingConsent: false,
      preciseLocationConsent: false,
    });
    expect(response.body.data.closedAt).toEqual(expect.any(String));
  });
});

function authHeaders(
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
