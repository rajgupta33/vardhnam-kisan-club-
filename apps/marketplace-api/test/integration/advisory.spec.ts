import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
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

describe('Kisan Club advisory', () => {
  let app: INestApplication;
  let authorHeaders: Record<string, string>;
  let reviewerHeaders: Record<string, string>;
  let farmerHeaders: Record<string, string>;
  let otherFarmerHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    await prisma.crop.upsert({
      where: { code: 'WHEAT' },
      create: { code: 'WHEAT', nameEn: 'Wheat', nameHi: 'गेहूँ' },
      update: { nameEn: 'Wheat', nameHi: 'गेहूँ', isActive: true },
    });

    const suffix = randomUUID();
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `advisory-${suffix}`,
        legalName: 'Vardhnam Advisory Test Context',
        displayName: 'Advisory Test Context',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [author, reviewer, farmer, otherFarmer] = await Promise.all([
      prisma.user.create({ data: { email: `advisory-author-${suffix}@example.local` } }),
      prisma.user.create({ data: { email: `advisory-reviewer-${suffix}@example.local` } }),
      prisma.user.create({
        data: {
          phone: uniquePhone('82'),
          farmerProfile: {
            create: {
              fullName: 'Advisory Farmer',
              primaryPincode: '207001',
              preferredLocale: 'hi-IN',
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          phone: uniquePhone('83'),
          farmerProfile: {
            create: {
              fullName: 'Other Advisory Farmer',
              primaryPincode: '207001',
              preferredLocale: 'en-IN',
            },
          },
        },
      }),
    ]);

    await Promise.all([
      createMembership(author.id, organisation.id, PlatformRole.AGRONOMIST),
      createMembership(reviewer.id, organisation.id, PlatformRole.AGRONOMIST),
      createMembership(farmer.id, organisation.id, PlatformRole.FARMER),
      createMembership(otherFarmer.id, organisation.id, PlatformRole.FARMER),
    ]);

    authorHeaders = authHeaders(author.id, PlatformRole.AGRONOMIST, organisation.id);
    reviewerHeaders = authHeaders(reviewer.id, PlatformRole.AGRONOMIST, organisation.id);
    farmerHeaders = authHeaders(farmer.id, PlatformRole.FARMER, organisation.id);
    otherFarmerHeaders = authHeaders(otherFarmer.id, PlatformRole.FARMER, organisation.id);

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

  it('publishes a consent-gated, independently approved, localised and owner-scoped advisory once', async () => {
    const cropResponse = await request(app.getHttpServer())
      .get('/api/v1/farms/reference/crops')
      .set(farmerHeaders)
      .expect(200);
    const wheat = cropResponse.body.data.find((crop: { code: string }) => crop.code === 'WHEAT');
    expect(wheat).toBeDefined();

    await joinClub(app, farmerHeaders);
    await joinClub(app, otherFarmerHeaders);
    await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(otherFarmerHeaders)
      .send({ advisoryConsent: true })
      .expect(200);

    const farmResponse = await request(app.getHttpServer())
      .post('/api/v1/farms')
      .set(farmerHeaders)
      .send({
        name: 'Advisory field',
        village: 'Etah Rural',
        district: 'Etah',
        state: 'Uttar Pradesh',
        pincode: '207001',
        areaAcres: 2,
        ownershipType: 'OWNED',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/farms/${farmResponse.body.data.id}/crop-cycles`)
      .set(farmerHeaders)
      .send({
        cropId: wheat.id,
        varietyName: 'HD-2967',
        areaAcres: 2,
        season: 'KHARIF_2026',
        sowingDate: daysAgo(10),
      })
      .expect(201);

    const ruleResponse = await request(app.getHttpServer())
      .post('/api/v1/advisory/rules')
      .set(authorHeaders)
      .send({
        cropName: 'Wheat',
        varietyName: 'HD-2967',
        category: 'CROP_STAGE',
        minDaysAfterSowing: 5,
        maxDaysAfterSowing: 20,
        eligibleStates: ['Uttar Pradesh'],
        eligibleDistricts: ['Etah'],
        seasons: ['KHARIF_2026'],
        titleEn: 'Check early crop establishment',
        bodyEn: 'Inspect plant emergence and record any uneven patches.',
        titleHi: 'फसल की शुरुआती बढ़वार देखें',
        bodyHi: 'पौधों का उगना देखें और असमान हिस्सों को दर्ज करें।',
        sourceReference: 'Approved KVK crop-stage practice note',
        reason: 'Integration-test authoring record',
      })
      .expect(201);
    const ruleId = ruleResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/advisory/rules/${ruleId}/submit`)
      .set(authorHeaders)
      .send({ reason: 'Ready for independent agronomic review' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/advisory/rules/${ruleId}/review`)
      .set(authorHeaders)
      .send({ approved: true, reason: 'Self approval must not be accepted' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/advisory/rules/${ruleId}/review`)
      .set(reviewerHeaders)
      .send({ approved: true, reason: 'Reviewed against the cited practice note' })
      .expect(201);

    const beforeConsent = await request(app.getHttpServer())
      .post('/api/v1/advisory/generate')
      .set(authorHeaders)
      .expect(201);
    expect(beforeConsent.body.data.generated).toBe(0);

    await request(app.getHttpServer()).get('/api/v1/advisory/me').set(farmerHeaders).expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(farmerHeaders)
      .send({ advisoryConsent: true })
      .expect(200);

    const firstGeneration = await request(app.getHttpServer())
      .post('/api/v1/advisory/generate')
      .set(authorHeaders)
      .expect(201);
    expect(firstGeneration.body.data).toMatchObject({ generated: 1, approvedRules: 1 });

    const replay = await request(app.getHttpServer())
      .post('/api/v1/advisory/generate')
      .set(authorHeaders)
      .expect(201);
    expect(replay.body.data.generated).toBe(0);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/advisory/me')
      .set(farmerHeaders)
      .expect(200);
    expect(listResponse.body.data.total).toBe(1);
    expect(listResponse.body.data.items[0]).toMatchObject({
      status: 'DELIVERED',
      title: 'फसल की शुरुआती बढ़वार देखें',
      cropCycle: { cropName: 'गेहूँ', varietyName: 'HD-2967' },
    });
    const eventId = listResponse.body.data.items[0].id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/advisory/me/${eventId}`)
      .set(otherFarmerHeaders)
      .expect(404);

    const readResponse = await request(app.getHttpServer())
      .post(`/api/v1/advisory/me/${eventId}/read`)
      .set(farmerHeaders)
      .expect(201);
    expect(readResponse.body.data).toMatchObject({ status: 'READ' });
    expect(readResponse.body.data.readAt).toEqual(expect.any(String));

    const notification = await prisma.notification.findFirstOrThrow({
      where: { relatedResourceType: 'AdvisoryEvent', relatedResourceId: eventId },
    });
    expect(notification).toMatchObject({
      category: 'CLUB_ADVISORY_PUBLISHED',
      title: 'फसल की शुरुआती बढ़वार देखें',
      status: 'SENT',
    });
    expect(
      await prisma.auditLog.count({
        where: {
          resourceId: { in: [ruleId, eventId, notification.id] },
          action: {
            in: [
              'ADVISORY_RULE_CREATED',
              'ADVISORY_RULE_SUBMITTED',
              'ADVISORY_RULE_APPROVED',
              'ADVISORY_EVENT_GENERATED',
              'NOTIFICATION_ENQUEUED',
              'ADVISORY_EVENT_READ',
            ],
          },
        },
      }),
    ).toBe(6);
  });
});

async function createMembership(userId: string, organisationId: string, role: PlatformRole) {
  return prisma.organisationMembership.create({
    data: { userId, organisationId, role, status: MembershipStatus.ACTIVE },
  });
}

async function joinClub(app: INestApplication, headers: Record<string, string>) {
  await request(app.getHttpServer())
    .post('/api/v1/kisan-club/membership')
    .set(headers)
    .send({ homePincode: '207001', termsVersion: 'v1', termsAccepted: true })
    .expect(201);
}

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

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function uniquePhone(prefix: string): string {
  return `+91${prefix}${Math.floor(10000000 + Math.random() * 89999999)}`;
}
