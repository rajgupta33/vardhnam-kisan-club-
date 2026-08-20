import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CropCycleStatus,
  FarmOwnershipType,
  KisanClubAssignmentReason,
  KisanClubFulfilmentMode,
  KisanClubFulfilmentStatus,
  KisanClubMembershipStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
  ProductCheckoutStatus,
  ProductOrderStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

describe('Kisan Club intelligence', () => {
  let app: INestApplication;
  let operationsHeaders: Record<string, string>;
  let farmerHeaders: Record<string, string>;
  let wheatId: string;
  let territoryId: string;
  let promoterUserId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    const suffix = randomUUID();
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `club-intelligence-${suffix}`,
        legalName: 'Kisan Club Intelligence Test',
        displayName: 'Kisan Club Intelligence Test',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const seller = await prisma.organisation.create({
      data: {
        type: OrganisationType.DISTRIBUTOR,
        slug: `club-intelligence-seller-${suffix}`,
        legalName: 'Intelligence Test Distributor',
        displayName: 'Intelligence Test Distributor',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [operations, promoter, farmer, suspendedFarmer] = await Promise.all([
      prisma.user.create({ data: { email: `intelligence-ops-${suffix}@example.local` } }),
      prisma.user.create({
        data: {
          email: `intelligence-promoter-${suffix}@example.local`,
          profile: { create: { displayName: 'Etah Club Promoter' } },
        },
      }),
      createFarmer(suffix, 'Active Intelligence Farmer', KisanClubMembershipStatus.ACTIVE),
      createFarmer(
        `${suffix}-suspended`,
        'Suspended Intelligence Farmer',
        KisanClubMembershipStatus.SUSPENDED,
      ),
    ]);
    promoterUserId = promoter.id;
    await Promise.all([
      createMembership(organisation.id, operations.id, PlatformRole.OPERATIONS_MANAGER),
      createMembership(organisation.id, promoter.id, PlatformRole.PROMOTER),
      createMembership(organisation.id, farmer.id, PlatformRole.FARMER),
      createMembership(organisation.id, suspendedFarmer.id, PlatformRole.FARMER),
    ]);
    operationsHeaders = authHeaders(
      organisation.id,
      operations.id,
      PlatformRole.OPERATIONS_MANAGER,
    );
    farmerHeaders = authHeaders(organisation.id, farmer.id, PlatformRole.FARMER);

    const [wheat, mustard, territory] = await Promise.all([
      prisma.crop.create({
        data: { code: `WHEAT-${suffix}`, nameEn: 'Wheat', nameHi: 'गेहूँ' },
      }),
      prisma.crop.create({
        data: { code: `MUSTARD-${suffix}`, nameEn: 'Mustard', nameHi: 'सरसों' },
      }),
      prisma.promoterTerritory.create({
        data: {
          name: 'Etah pilot',
          state: 'Uttar Pradesh',
          district: 'Etah',
          pincodes: ['207001'],
        },
      }),
    ]);
    wheatId = wheat.id;
    territoryId = territory.id;
    const activeProfile = farmer.farmerProfile;
    const suspendedProfile = suspendedFarmer.farmerProfile;
    if (!activeProfile?.kisanClubMembership || !suspendedProfile?.kisanClubMembership) {
      throw new Error('Kisan Club farmer fixtures were not created');
    }
    const activeMembershipId = activeProfile.kisanClubMembership.id;
    const suspendedMembershipId = suspendedProfile.kisanClubMembership.id;

    const [activeFarm, suspendedFarm] = await Promise.all([
      prisma.farm.create({
        data: {
          membershipId: activeMembershipId,
          farmerProfileId: activeProfile.id,
          name: 'Active pilot farm',
          district: 'Etah',
          state: 'Uttar Pradesh',
          pincode: '207001',
          areaAcres: 4,
          ownershipType: FarmOwnershipType.OWNED,
        },
      }),
      prisma.farm.create({
        data: {
          membershipId: suspendedMembershipId,
          farmerProfileId: suspendedProfile.id,
          name: 'Suspended farm',
          district: 'Etah',
          state: 'Uttar Pradesh',
          pincode: '207001',
          areaAcres: 9,
          ownershipType: FarmOwnershipType.OWNED,
        },
      }),
    ]);
    await Promise.all([
      prisma.farmCropCycle.create({
        data: {
          farmId: activeFarm.id,
          cropId: wheat.id,
          areaAcres: 2.25,
          season: 'KHARIF_2026',
          sowingDate: new Date('2026-07-01T00:00:00.000Z'),
          status: CropCycleStatus.ACTIVE,
        },
      }),
      prisma.farmCropCycle.create({
        data: {
          farmId: activeFarm.id,
          cropId: mustard.id,
          areaAcres: 1.5,
          season: 'RABI_2026',
          status: CropCycleStatus.PLANNED,
        },
      }),
      prisma.farmCropCycle.create({
        data: {
          farmId: suspendedFarm.id,
          cropId: wheat.id,
          areaAcres: 9,
          season: 'KHARIF_2026',
          status: CropCycleStatus.ACTIVE,
        },
      }),
      prisma.kisanClubPromoterProfile.create({
        data: {
          promoterUserId: promoter.id,
          promoterOrganisationId: organisation.id,
          territoryId: territory.id,
          clubEnabled: true,
          acceptingNewFarmers: true,
          maxActiveFarmers: 10,
          activeFarmerCount: 0,
        },
      }),
      prisma.kisanClubPromoterAssignment.create({
        data: {
          membershipId: activeMembershipId,
          promoterUserId: promoter.id,
          territoryId: territory.id,
          assignmentReason: KisanClubAssignmentReason.MANUAL_OPS,
          assignedByUserId: operations.id,
          assignedByRole: PlatformRole.OPERATIONS_MANAGER,
          reason: 'Intelligence test assignment',
        },
      }),
    ]);

    const checkout = await prisma.productCheckout.create({
      data: {
        farmerProfileId: activeProfile.id,
        serviceablePincode: '207001',
        status: ProductCheckoutStatus.PAID,
        subtotalPaise: 20_000,
        farmerPayablePaise: 20_000,
        itemCount: 2,
        childOrderCount: 2,
      },
    });
    const orders = await Promise.all(
      [KisanClubFulfilmentStatus.COMPLETED, KisanClubFulfilmentStatus.FAILED].map(
        async (status, index) => {
          const order = await prisma.productOrder.create({
            data: {
              checkoutId: checkout.id,
              farmerProfileId: activeProfile.id,
              sellerOrganisationId: seller.id,
              orderNumber: `VAG-INT-${index}-${suffix.slice(0, 8)}`,
              status: ProductOrderStatus.CONFIRMED,
              serviceablePincode: '207001',
              sellerNameSnapshot: seller.legalName,
              deliveryAddressSnapshot: { district: 'Etah', pincode: '207001' },
              subtotalPaise: 10_000,
              farmerPayablePaise: 10_000,
              isKisanClubOrder: true,
              itemCount: 1,
            },
          });
          return prisma.kisanClubFulfilmentAssignment.create({
            data: {
              productOrderId: order.id,
              membershipId: activeMembershipId,
              promoterUserId: promoter.id,
              mode: KisanClubFulfilmentMode.CLUB_HOME_DELIVERY,
              status,
              ...(status === KisanClubFulfilmentStatus.COMPLETED
                ? { completedAt: new Date() }
                : { failureReason: 'Farmer unavailable' }),
            },
          });
        },
      ),
    );
    expect(orders).toHaveLength(2);

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
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('returns privacy-scoped crop aggregates with exact backend acreage', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/intelligence/crop-summary')
      .query({ state: 'uttar pradesh', district: 'ETAH' })
      .set(operationsHeaders)
      .expect(200);

    expect(response.body.data).toMatchObject({
      totals: {
        cropCycleCount: 2,
        farmCount: 1,
        cropCount: 2,
        districtCount: 1,
        areaAcres: 3.75,
      },
      byDistrict: [{ state: 'Uttar Pradesh', district: 'Etah', cycleCount: 2, areaAcres: 3.75 }],
    });
    expect(response.body.data.bySowingMonth).toEqual([
      { month: '2026-07', cycleCount: 1, areaAcres: 2.25 },
      { month: 'NOT_RECORDED', cycleCount: 1, areaAcres: 1.5 },
    ]);

    const wheatResponse = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/intelligence/crop-summary')
      .query({ cropId: wheatId, status: CropCycleStatus.ACTIVE })
      .set(operationsHeaders)
      .expect(200);
    expect(wheatResponse.body.data.totals).toMatchObject({ cropCycleCount: 1, areaAcres: 2.25 });
  });

  it('reports current-holder promoter operations without trusting denormalised counts', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/intelligence/promoter-performance')
      .query({ territoryId, promoterUserId, clubEnabled: true })
      .set(operationsHeaders)
      .expect(200);

    expect(response.body.data).toMatchObject({
      total: 1,
      pageSummary: {
        profileCount: 1,
        enabledProfileCount: 1,
        activeFarmerCount: 1,
        totalCapacity: 10,
        totalFulfilmentCount: 2,
        resolvedCompletionRateBps: 5000,
      },
      items: [
        {
          promoterUserId,
          promoterName: 'Etah Club Promoter',
          activeFarmerCount: 1,
          remainingCapacity: 9,
          fulfilment: {
            totalCount: 2,
            resolvedCount: 2,
            completedCount: 1,
            failedCount: 1,
            resolvedCompletionRateBps: 5000,
          },
        },
      ],
    });
  });

  it('rejects users without the aggregate intelligence permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/kisan-club/intelligence/crop-summary')
      .set(farmerHeaders)
      .expect(403);
  });

  function createFarmer(suffix: string, fullName: string, status: KisanClubMembershipStatus) {
    return prisma.user.create({
      data: {
        email: `intelligence-farmer-${suffix}@example.local`,
        farmerProfile: {
          create: {
            fullName,
            primaryPincode: '207001',
            kisanClubMembership: {
              create: {
                memberNumber: `VKC-I-${suffix.slice(0, 8)}-${status}`,
                status,
                homePincode: '207001',
                joinedAt: new Date(),
                termsVersion: 'v1',
                termsAcceptedAt: new Date(),
              },
            },
          },
        },
      },
      include: { farmerProfile: { include: { kisanClubMembership: true } } },
    });
  }

  function createMembership(organisationId: string, userId: string, role: PlatformRole) {
    return prisma.organisationMembership.create({
      data: { organisationId, userId, role, status: MembershipStatus.ACTIVE },
    });
  }

  function authHeaders(
    organisationId: string,
    userId: string,
    role: PlatformRole,
  ): Record<string, string> {
    return {
      'x-user-id': userId,
      'x-user-role': role,
      'x-organisation-id': organisationId,
    };
  }
});
