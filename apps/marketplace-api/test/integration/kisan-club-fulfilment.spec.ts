import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
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

describe('Kisan Club fulfilment HTTP workflow', () => {
  let app: INestApplication;
  let assignmentId: string;
  let orderId: string;
  let membershipId: string;
  let promoterHeaders: Record<string, string>;
  let otherPromoterHeaders: Record<string, string>;
  let operationsHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);

    const suffix = randomUUID();
    const platform = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `club-fulfilment-platform-${suffix}`,
        legalName: 'Vardhnam Club Fulfilment Test',
        displayName: 'Vardhnam Club Fulfilment Test',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const seller = await prisma.organisation.create({
      data: {
        type: OrganisationType.DISTRIBUTOR,
        slug: `club-fulfilment-seller-${suffix}`,
        legalName: 'Club Test Distributor Private Limited',
        displayName: 'Club Test Distributor',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [operations, promoter, otherPromoter, farmer] = await Promise.all([
      prisma.user.create({ data: { email: `club-fulfilment-ops-${suffix}@example.local` } }),
      prisma.user.create({
        data: {
          email: `club-fulfilment-promoter-${suffix}@example.local`,
          profile: { create: { displayName: 'Assigned Club Promoter' } },
        },
      }),
      prisma.user.create({
        data: { email: `club-fulfilment-other-${suffix}@example.local` },
      }),
      prisma.user.create({
        data: {
          phone: `+9171${suffix.replaceAll('-', '').slice(0, 8)}`,
          farmerProfile: {
            create: {
              fullName: 'Club Fulfilment Farmer',
              village: 'Rampur',
              primaryPincode: '207001',
              kisanClubMembership: {
                create: {
                  memberNumber: `VKC-F-${suffix.slice(0, 8)}`,
                  status: KisanClubMembershipStatus.ACTIVE,
                  homePincode: '207001',
                  homeVillage: 'Rampur',
                  homeDistrict: 'Etah',
                  homeState: 'Uttar Pradesh',
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
    ]);

    const farmerProfileId = farmer.farmerProfile?.id;
    membershipId = farmer.farmerProfile?.kisanClubMembership?.id ?? '';
    if (!farmerProfileId || !membershipId) throw new Error('Farmer Club fixture was not created');

    await Promise.all([
      createMembership(platform.id, operations.id, PlatformRole.OPERATIONS_MANAGER),
      createMembership(platform.id, promoter.id, PlatformRole.PROMOTER),
      createMembership(platform.id, otherPromoter.id, PlatformRole.PROMOTER),
      createMembership(platform.id, farmer.id, PlatformRole.FARMER),
    ]);

    const checkout = await prisma.productCheckout.create({
      data: {
        farmerProfileId,
        serviceablePincode: '207001',
        status: ProductCheckoutStatus.PAID,
        subtotalPaise: 125_000,
        clubBenefitPaise: 5_000,
        farmerPayablePaise: 120_000,
        itemCount: 1,
        childOrderCount: 1,
      },
    });
    const order = await prisma.productOrder.create({
      data: {
        checkoutId: checkout.id,
        farmerProfileId,
        sellerOrganisationId: seller.id,
        orderNumber: `VAG-CLUB-F-${suffix.slice(0, 8)}`,
        status: ProductOrderStatus.CONFIRMED,
        serviceablePincode: '207001',
        sellerNameSnapshot: seller.legalName,
        deliveryAddressSnapshot: {
          line1: 'Test farm',
          village: 'Rampur',
          district: 'Etah',
          state: 'Uttar Pradesh',
          pincode: '207001',
        },
        subtotalPaise: 125_000,
        clubBenefitPaise: 5_000,
        farmerPayablePaise: 120_000,
        isKisanClubOrder: true,
        itemCount: 1,
      },
    });
    orderId = order.id;
    const assignment = await prisma.kisanClubFulfilmentAssignment.create({
      data: {
        productOrderId: order.id,
        membershipId,
        promoterUserId: promoter.id,
        mode: KisanClubFulfilmentMode.CLUB_HOME_DELIVERY,
        status: KisanClubFulfilmentStatus.ASSIGNED,
        statusHistory: {
          create: {
            toStatus: KisanClubFulfilmentStatus.ASSIGNED,
            changedByUserId: operations.id,
            changedByRole: PlatformRole.OPERATIONS_MANAGER,
            reason: 'Confirmed Club order assigned for coordination',
          },
        },
      },
    });
    assignmentId = assignment.id;

    operationsHeaders = authHeaders(platform.id, operations.id, PlatformRole.OPERATIONS_MANAGER);
    promoterHeaders = authHeaders(platform.id, promoter.id, PlatformRole.PROMOTER);
    otherPromoterHeaders = authHeaders(platform.id, otherPromoter.id, PlatformRole.PROMOTER);

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

  it('enforces assignment scope and preserves the seller order state during coordination', async () => {
    const operationsList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/fulfilment/assignments')
      .query({ status: KisanClubFulfilmentStatus.ASSIGNED, membershipId })
      .set(operationsHeaders)
      .expect(200);
    expect(operationsList.body.data).toMatchObject({
      total: 1,
      items: [
        { id: assignmentId, productOrderId: orderId, promoterName: 'Assigned Club Promoter' },
      ],
    });

    const ownDetail = await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/fulfilment/assignments/${assignmentId}`)
      .set(promoterHeaders)
      .expect(200);
    expect(ownDetail.body.data).toMatchObject({
      id: assignmentId,
      status: KisanClubFulfilmentStatus.ASSIGNED,
      member: { fullName: 'Club Fulfilment Farmer' },
      order: { status: ProductOrderStatus.CONFIRMED, sellerNameSnapshot: sellerName() },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/kisan-club/fulfilment/assignments/${assignmentId}`)
      .set(otherPromoterHeaders)
      .expect(403);

    const otherList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/fulfilment/assignments')
      .set(otherPromoterHeaders)
      .expect(200);
    expect(otherList.body.data).toMatchObject({ total: 0, items: [] });

    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/kisan-club/fulfilment/assignments/${assignmentId}/accept`)
      .set(promoterHeaders)
      .send({ reason: 'Promoter confirmed local coordination' })
      .expect(201);
    expect(accepted.body.data).toMatchObject({
      id: assignmentId,
      status: KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
      order: { status: ProductOrderStatus.CONFIRMED },
    });
    expect(accepted.body.data.statusHistory).toHaveLength(2);

    await request(app.getHttpServer())
      .post(`/api/v1/kisan-club/fulfilment/assignments/${assignmentId}/complete`)
      .set(promoterHeaders)
      .send({ reason: 'Attempted illegal shortcut' })
      .expect(409);

    const storedOrder = await prisma.productOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(storedOrder.status).toBe(ProductOrderStatus.CONFIRMED);
  });

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

  function sellerName(): string {
    return 'Club Test Distributor Private Limited';
  }
});
