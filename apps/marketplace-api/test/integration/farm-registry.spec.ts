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

describe('Farm and crop registry', () => {
  let app: INestApplication;
  let farmerHeaders: Record<string, string>;
  let otherFarmerHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    const suffix = randomUUID();
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `farm-registry-${suffix}`,
        legalName: 'Farm Registry Test Context',
        displayName: 'Farm Registry Test Context',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [farmer, otherFarmer] = await Promise.all([
      prisma.user.create({
        data: {
          phone: `+9180${Math.floor(10000000 + Math.random() * 89999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Primary Farmer',
              primaryPincode: '207001',
              preferredLocale: 'hi-IN',
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          phone: `+9181${Math.floor(10000000 + Math.random() * 89999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Other Farmer',
              primaryPincode: '207001',
              preferredLocale: 'hi-IN',
            },
          },
        },
      }),
    ]);
    await Promise.all(
      [farmer, otherFarmer].map((user) =>
        prisma.organisationMembership.create({
          data: {
            userId: user.id,
            organisationId: organisation.id,
            role: PlatformRole.FARMER,
            status: MembershipStatus.ACTIVE,
          },
        }),
      ),
    );
    farmerHeaders = authHeaders(farmer.id, organisation.id);
    otherFarmerHeaders = authHeaders(otherFarmer.id, organisation.id);

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

  it('keeps the crop vocabulary controlled and completes a farmer-owned registry journey', async () => {
    const cropResponse = await request(app.getHttpServer())
      .get('/api/v1/farms/reference/crops')
      .set(farmerHeaders)
      .expect(200);
    const wheat = cropResponse.body.data.find((crop: { code: string }) => crop.code === 'WHEAT');
    expect(wheat).toMatchObject({ nameEn: 'Wheat', nameHi: 'गेहूँ', isActive: true });

    await request(app.getHttpServer())
      .post('/api/v1/farms')
      .set(farmerHeaders)
      .send(baseFarm())
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/membership')
      .set(farmerHeaders)
      .send({ homePincode: '207001', termsVersion: 'v1', termsAccepted: true })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/farms')
      .set(farmerHeaders)
      .send({ ...baseFarm(), latitude: 27.55, longitude: 78.66 })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(farmerHeaders)
      .send({ preciseLocationConsent: true })
      .expect(200);

    const farmResponse = await request(app.getHttpServer())
      .post('/api/v1/farms')
      .set(farmerHeaders)
      .send({ ...baseFarm(), latitude: 27.55, longitude: 78.66 })
      .expect(201);
    const farmId = farmResponse.body.data.id as string;

    await request(app.getHttpServer())
      .patch('/api/v1/kisan-club/membership/me/consents')
      .set(farmerHeaders)
      .send({ preciseLocationConsent: false })
      .expect(200);
    expect(
      await prisma.farm.findUniqueOrThrow({
        where: { id: farmId },
        select: { latitude: true, longitude: true },
      }),
    ).toEqual({ latitude: null, longitude: null });
    expect(
      await prisma.auditLog.count({
        where: { resourceId: farmId, action: 'FARM_PRECISE_LOCATION_REMOVED' },
      }),
    ).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/farms/${farmId}/crop-cycles`)
      .set(otherFarmerHeaders)
      .expect(404);

    const cycleResponse = await request(app.getHttpServer())
      .post(`/api/v1/farms/${farmId}/crop-cycles`)
      .set(farmerHeaders)
      .send({
        cropId: wheat.id,
        areaAcres: 2.25,
        season: 'KHARIF_2026',
        sowingDate: '2026-07-01',
        expectedHarvestDate: '2026-10-01',
      })
      .expect(201);
    const cycleId = cycleResponse.body.data.id as string;
    expect(cycleResponse.body.data.crop.code).toBe('WHEAT');

    const membership = await prisma.kisanClubMembership.findFirstOrThrow({
      where: { farmerProfile: { user: { phone: { startsWith: '+9180' } } } },
    });
    expect(membership.status).toBe(KisanClubMembershipStatus.AWAITING_PROMOTER);

    const activityResponse = await request(app.getHttpServer())
      .post(`/api/v1/farms/crop-cycles/${cycleId}/activities`)
      .set(farmerHeaders)
      .send({
        activityType: 'IRRIGATION',
        occurredOn: '2026-08-01',
        notes: 'First irrigation',
      })
      .expect(201);
    expect(activityResponse.body.data).toMatchObject({
      cropCycleId: cycleId,
      recordedSource: 'FARMER',
    });

    const harvestResponse = await request(app.getHttpServer())
      .post(`/api/v1/farms/${farmId}/crop-cycles/${cycleId}/harvest`)
      .set(farmerHeaders)
      .send({ actualHarvestDate: '2026-08-10', yieldQuintals: 10.5 })
      .expect(201);
    expect(harvestResponse.body.data).toMatchObject({ status: 'HARVESTED' });

    const activities = await request(app.getHttpServer())
      .get(`/api/v1/farms/crop-cycles/${cycleId}/activities`)
      .set(farmerHeaders)
      .expect(200);
    expect(activities.body.data).toHaveLength(2);
    expect(activities.body.data.map((item: { activityType: string }) => item.activityType)).toEqual(
      expect.arrayContaining(['IRRIGATION', 'HARVEST']),
    );

    expect(
      await prisma.auditLog.count({
        where: {
          resourceId: { in: [farmId, cycleId, activityResponse.body.data.id] },
          action: { in: ['FARM_CREATED', 'FARM_CROP_CYCLE_CREATED', 'FARM_ACTIVITY_CREATED'] },
        },
      }),
    ).toBeGreaterThanOrEqual(3);
  });
});

function baseFarm() {
  return {
    name: 'North field',
    village: 'Etah Rural',
    district: 'Etah',
    state: 'Uttar Pradesh',
    pincode: '207001',
    areaAcres: 3,
    ownershipType: 'OWNED',
    irrigationSource: 'TUBE_WELL',
  };
}

function authHeaders(userId: string, organisationId: string): Record<string, string> {
  return {
    'x-user-id': userId,
    'x-user-role': PlatformRole.FARMER,
    'x-organisation-id': organisationId,
  };
}
