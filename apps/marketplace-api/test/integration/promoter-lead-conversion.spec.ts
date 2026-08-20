import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FarmerLeadStatus,
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

describe('Promoter farmer-lead conversion', () => {
  let app: INestApplication;
  let promoterUserId: string;
  let promoterOrganisationId: string;
  let farmerOrganisationId: string;
  let headers: Record<string, string>;
  let operationsHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    const suffix = randomUUID();
    const [promoterOrganisation, farmerOrganisation] = await Promise.all([
      prisma.organisation.create({
        data: {
          type: OrganisationType.VARDHNAM,
          slug: `promoter-lead-${suffix}`,
          legalName: 'Promoter Lead Test Network',
          displayName: 'Promoter Lead Test Network',
          status: OrganisationStatus.ACTIVE,
        },
      }),
      prisma.organisation.create({
        data: {
          type: OrganisationType.VARDHNAM,
          slug: `farmer-lead-${suffix}`,
          legalName: 'Farmer Lead Test Context',
          displayName: 'Farmer Lead Test Context',
          status: OrganisationStatus.ACTIVE,
        },
      }),
    ]);
    const [promoter, operationsUser] = await Promise.all([
      prisma.user.create({
        data: { phone: `+9170${Math.floor(10000000 + Math.random() * 89999999)}` },
      }),
      prisma.user.create({
        data: { email: `territory-ops-${suffix}@vardhnam.test` },
      }),
    ]);
    await prisma.organisationMembership.createMany({
      data: [
        {
          userId: promoter.id,
          organisationId: promoterOrganisation.id,
          role: PlatformRole.PROMOTER,
          status: MembershipStatus.ACTIVE,
        },
        {
          userId: operationsUser.id,
          organisationId: promoterOrganisation.id,
          role: PlatformRole.OPERATIONS_MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      ],
    });
    promoterUserId = promoter.id;
    promoterOrganisationId = promoterOrganisation.id;
    farmerOrganisationId = farmerOrganisation.id;
    headers = authHeaders(promoter.id, promoterOrganisation.id);
    operationsHeaders = {
      'x-user-id': operationsUser.id,
      'x-user-role': PlatformRole.OPERATIONS_MANAGER,
      'x-organisation-id': promoterOrganisation.id,
    };

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

  it('links only an OTP-registered farmer and replays without duplicate attribution', async () => {
    const phone = `+9171${Math.floor(10000000 + Math.random() * 89999999)}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/promoters/leads')
      .set(headers)
      .send({ fullName: 'Verified Farmer', phone, source: 'FIELD_VISIT' })
      .expect(201);
    const leadId = created.body.data.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/promoters/leads/${leadId}`)
      .set(headers)
      .send({ status: FarmerLeadStatus.CONTACTED })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/promoters/leads/${leadId}/convert`)
      .set(headers)
      .send({})
      .expect(409);

    const farmer = await prisma.user.create({
      data: {
        phone,
        farmerProfile: { create: { fullName: 'Verified Farmer' } },
      },
      include: { farmerProfile: true },
    });
    await prisma.organisationMembership.create({
      data: {
        userId: farmer.id,
        organisationId: farmerOrganisationId,
        role: PlatformRole.FARMER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const converted = await request(app.getHttpServer())
      .post(`/api/v1/promoters/leads/${leadId}/convert`)
      .set(headers)
      .send({})
      .expect(201);
    expect(converted.body.data).toMatchObject({
      lead: {
        id: leadId,
        status: FarmerLeadStatus.CONVERTED,
        convertedFarmerProfileId: farmer.farmerProfile!.id,
      },
      farmerProfileId: farmer.farmerProfile!.id,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/promoters/leads/${leadId}/convert`)
      .set(headers)
      .send({})
      .expect(201);
    expect(
      await prisma.promoterAttribution.count({
        where: { farmerProfileId: farmer.farmerProfile!.id, promoterUserId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { resourceId: leadId, action: 'FARMER_LEAD_CONVERTED' },
      }),
    ).toBe(1);
    expect(
      await prisma.farmerLead.findUniqueOrThrow({
        where: { id: leadId },
        select: { promoterOrganisationId: true },
      }),
    ).toEqual({ promoterOrganisationId });
  });

  it('lets operations assign an active territory that only the scoped promoter reads', async () => {
    const territory = await prisma.promoterTerritory.create({
      data: {
        name: 'Etah North',
        state: 'Uttar Pradesh',
        district: 'Etah',
        blocks: ['Sakit'],
        pincodes: ['207001'],
        villages: ['Nagla'],
      },
    });
    const assigned = await request(app.getHttpServer())
      .put(`/api/v1/promoters/territory-assignments/${promoterUserId}`)
      .set(operationsHeaders)
      .send({
        promoterOrganisationId,
        territoryId: territory.id,
      })
      .expect(200);
    expect(assigned.body.data).toMatchObject({
      assigned: true,
      promoterUserId,
      promoterOrganisationId,
      territory: { id: territory.id, pincodes: ['207001'] },
    });

    const own = await request(app.getHttpServer())
      .get('/api/v1/promoters/territories/me')
      .set(headers)
      .expect(200);
    expect(own.body.data).toEqual(assigned.body.data);
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'PROMOTER_TERRITORY_ASSIGNED',
          organisationId: promoterOrganisationId,
        },
      }),
    ).toBe(1);
  });

  it('lets a promoter survey an actively attributed farmer outside Kisan Club', async () => {
    const phone = `+9173${Math.floor(10000000 + Math.random() * 89999999)}`;
    const farmer = await prisma.user.create({
      data: {
        phone,
        farmerProfile: { create: { fullName: 'General Survey Farmer' } },
        memberships: {
          create: {
            organisationId: farmerOrganisationId,
            role: PlatformRole.FARMER,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      include: { farmerProfile: true },
    });
    await prisma.promoterAttribution.create({
      data: {
        promoterUserId,
        promoterOrganisationId,
        farmerProfileId: farmer.farmerProfile!.id,
        createdByUserId: promoterUserId,
        createdByRole: PlatformRole.PROMOTER,
        reason: 'General survey integration attribution',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/promoters/surveys')
      .set(headers)
      .send({
        farmerProfileId: farmer.farmerProfile!.id,
        farm: {
          name: 'North field',
          village: 'Nagla',
          district: 'Etah',
          state: 'Uttar Pradesh',
          pincode: '207001',
          areaAcres: 2.5,
          ownershipType: 'OWNED',
        },
      })
      .expect(201);
    expect(response.body.data).toMatchObject({
      farm: {
        farmerProfileId: farmer.farmerProfile!.id,
        membershipId: null,
        pincode: '207001',
      },
      cropCycle: null,
    });
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'PROMOTER_FARM_SURVEY_CREATED',
          resourceId: response.body.data.farm.id as string,
          actorUserId: promoterUserId,
        },
      }),
    ).toBe(1);
  });

  it('registers a present farmer by OTP without returning a farmer login session', async () => {
    await prisma.organisation.upsert({
      where: { slug: 'vardhnam-farmer-context' },
      update: { status: OrganisationStatus.ACTIVE },
      create: {
        type: OrganisationType.VARDHNAM,
        slug: 'vardhnam-farmer-context',
        legalName: 'Vardhnam Farmer Context',
        displayName: 'Vardhnam Farmer Context',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const phone = `+9172${Math.floor(10000000 + Math.random() * 89999999)}`;
    const created = await request(app.getHttpServer())
      .post('/api/v1/promoters/leads')
      .set(headers)
      .send({ fullName: 'Assisted Farmer', phone, source: 'FIELD_VISIT' })
      .expect(201);
    const leadId = created.body.data.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/promoters/leads/${leadId}`)
      .set(headers)
      .send({ status: FarmerLeadStatus.CONTACTED })
      .expect(200);

    const otp = await request(app.getHttpServer())
      .post(`/api/v1/promoters/leads/${leadId}/farmer-otp/request`)
      .set(headers)
      .send({})
      .expect(201);
    expect(otp.body.data.mockOtpCode).toMatch(/^[0-9]{6}$/);

    const verified = await request(app.getHttpServer())
      .post(`/api/v1/promoters/leads/${leadId}/farmer-otp/verify`)
      .set(headers)
      .send({ code: otp.body.data.mockOtpCode, preferredLocale: 'hi-IN' })
      .expect(201);
    expect(verified.body.data).toMatchObject({
      lead: { id: leadId, status: FarmerLeadStatus.CONVERTED },
    });
    expect(verified.body.data).not.toHaveProperty('accessToken');
    expect(verified.body.data).not.toHaveProperty('refreshToken');

    const farmer = await prisma.user.findFirstOrThrow({ where: { phone } });
    expect(await prisma.refreshToken.count({ where: { userId: farmer.id } })).toBe(0);
    expect(
      await prisma.promoterAttribution.count({
        where: { farmerProfile: { userId: farmer.id }, promoterUserId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          resourceId: farmer.id,
          action: 'AUTH_FARMER_OTP_VERIFIED',
          actorUserId: promoterUserId,
          actorRole: PlatformRole.PROMOTER,
        },
      }),
    ).toBe(1);
  });
});

function authHeaders(userId: string, organisationId: string): Record<string, string> {
  return {
    'x-user-id': userId,
    'x-user-role': PlatformRole.PROMOTER,
    'x-organisation-id': organisationId,
  };
}
