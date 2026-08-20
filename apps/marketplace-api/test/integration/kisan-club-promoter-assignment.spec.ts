import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  KisanClubMembershipStatus,
  KycDocumentStatus,
  KycDocumentType,
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

describe('Kisan Club promoter assignment', () => {
  let app: INestApplication;
  let operationsHeaders: Record<string, string>;
  let farmerHeaders: Record<string, string>;
  let promoterHeaders: Record<string, string>;
  let otherPromoterHeaders: Record<string, string>;
  let organisationId: string;
  let membershipId: string;
  let promoterUserId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    const suffix = randomUUID();
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `club-assignment-${suffix}`,
        legalName: 'Kisan Club Assignment Test',
        displayName: 'Kisan Club Assignment Test',
        status: OrganisationStatus.ACTIVE,
        kycDocuments: {
          create: {
            documentType: KycDocumentType.PAN,
            status: KycDocumentStatus.APPROVED,
            documentNumber: 'TESTPAN001',
          },
        },
      },
    });
    organisationId = organisation.id;
    const [operations, farmer, promoter, otherPromoter] = await Promise.all([
      prisma.user.create({ data: { email: `club-ops-${suffix}@example.local` } }),
      prisma.user.create({
        data: {
          phone: `+9170${Math.floor(10000000 + Math.random() * 89999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Assigned Farmer',
              village: 'Rampur',
              primaryPincode: '207001',
              kisanClubMembership: {
                create: {
                  memberNumber: `VKC-${suffix.slice(0, 8)}`,
                  status: KisanClubMembershipStatus.AWAITING_PROMOTER,
                  homePincode: '207001',
                  homeVillage: 'Rampur',
                  joinedAt: new Date(),
                  termsVersion: 'v1',
                  termsAcceptedAt: new Date(),
                },
              },
            },
          },
        },
        include: { farmerProfile: { include: { kisanClubMembership: true } } },
      }),
      prisma.user.create({
        data: {
          email: `club-promoter-${suffix}@example.local`,
          profile: { create: { displayName: 'Local Promoter' } },
        },
      }),
      prisma.user.create({ data: { email: `club-other-${suffix}@example.local` } }),
    ]);
    promoterUserId = promoter.id;
    membershipId = farmer.farmerProfile?.kisanClubMembership?.id ?? '';
    await Promise.all([
      membership(operations.id, PlatformRole.OPERATIONS_MANAGER),
      membership(farmer.id, PlatformRole.FARMER),
      membership(promoter.id, PlatformRole.PROMOTER),
      membership(otherPromoter.id, PlatformRole.PROMOTER),
    ]);
    operationsHeaders = authHeaders(operations.id, PlatformRole.OPERATIONS_MANAGER);
    farmerHeaders = authHeaders(farmer.id, PlatformRole.FARMER);
    promoterHeaders = authHeaders(promoter.id, PlatformRole.PROMOTER);
    otherPromoterHeaders = authHeaders(otherPromoter.id, PlatformRole.PROMOTER);

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

  it('creates an eligible promoter profile and atomically assigns the farmer', async () => {
    const territoryResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/territories')
      .set(operationsHeaders)
      .send({
        name: 'Etah pilot',
        state: 'Uttar Pradesh',
        district: 'Etah',
        pincodes: ['207001'],
        villages: ['Rampur'],
      })
      .expect(201);
    const territoryId = territoryResponse.body.data.id as string;

    const territoryList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/territories')
      .query({ q: 'Etah', status: 'ACTIVE' })
      .set(operationsHeaders)
      .expect(200);
    expect(territoryList.body.data).toMatchObject({ total: 1, items: [{ id: territoryId }] });

    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/promoter-profiles')
      .set(operationsHeaders)
      .send({
        promoterUserId,
        promoterOrganisationId: organisationId,
        territoryId,
        homeVillage: 'Rampur',
        homePincode: '207001',
        clubEnabled: true,
        acceptingNewFarmers: true,
        maxActiveFarmers: 10,
      })
      .expect(201);

    const profileList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/promoter-profiles')
      .query({ territoryId, clubEnabled: true })
      .set(operationsHeaders)
      .expect(200);
    expect(profileList.body.data).toMatchObject({
      total: 1,
      items: [
        {
          promoterUserId,
          promoterOrganisationId: organisationId,
          territory: { id: territoryId },
        },
      ],
    });

    const assignmentResponse = await request(app.getHttpServer())
      .post(`/api/v1/kisan-club/memberships/${membershipId}/reassign-promoter`)
      .set(operationsHeaders)
      .send({ assignmentReason: 'AUTO_MATCHED', reason: 'Initial pilot matching' })
      .expect(201);
    expect(assignmentResponse.body.data).toMatchObject({
      membershipId,
      promoterUserId,
      status: 'ACTIVE',
      territoryId,
    });

    const [storedMembership, profile, attribution] = await Promise.all([
      prisma.kisanClubMembership.findUniqueOrThrow({ where: { id: membershipId } }),
      prisma.kisanClubPromoterProfile.findUniqueOrThrow({ where: { promoterUserId } }),
      prisma.promoterAttribution.findFirstOrThrow({
        where: { farmerProfile: { kisanClubMembership: { id: membershipId } }, status: 'ACTIVE' },
      }),
    ]);
    expect(storedMembership.status).toBe(KisanClubMembershipStatus.ACTIVE);
    expect(profile.activeFarmerCount).toBe(1);
    expect(assignmentResponse.body.data.promoterAttributionId).toBe(attribution.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/kisan-club/territories/${territoryId}`)
      .set(operationsHeaders)
      .send({ status: 'INACTIVE' })
      .expect(400);
  });

  it('exposes the relationship only to its farmer and assigned promoter', async () => {
    const farmerView = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/promoter/me')
      .set(farmerHeaders)
      .expect(200);
    expect(farmerView.body.data.promoterUserId).toBe(promoterUserId);

    const promoterView = await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/promoter/farmers/${membershipId}`)
      .set(promoterHeaders)
      .expect(200);
    expect(promoterView.body.data.membership.farmerProfile.fullName).toBe('Assigned Farmer');

    await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/promoter/farmers/${membershipId}`)
      .set(otherPromoterHeaders)
      .expect(404);
  });

  function membership(userId: string, role: PlatformRole) {
    return prisma.organisationMembership.create({
      data: {
        userId,
        organisationId,
        role,
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  function authHeaders(userId: string, role: PlatformRole): Record<string, string> {
    return {
      'x-user-id': userId,
      'x-user-role': role,
      'x-organisation-id': organisationId,
    };
  }
});
