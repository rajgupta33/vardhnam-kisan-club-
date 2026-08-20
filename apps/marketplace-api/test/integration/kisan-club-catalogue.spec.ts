import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  KisanClubMembershipStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

describe('Kisan Club catalogue', () => {
  let app: INestApplication | undefined;
  let operationsHeaders: Record<string, string>;
  let farmerHeaders: Record<string, string>;
  let vardhnamProductId: string;
  let thirdPartyProductId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);
    const suffix = randomUUID();
    const context = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `club-catalogue-context-${suffix}`,
        legalName: 'Club Catalogue Context',
        displayName: 'Club Catalogue Context',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const [operations, farmer] = await Promise.all([
      prisma.user.create({ data: { email: `club-catalogue-ops-${suffix}@example.local` } }),
      prisma.user.create({
        data: {
          phone: `+9160${Math.floor(10000000 + Math.random() * 89999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Club Catalogue Farmer',
              primaryPincode: '207001',
              district: 'Etah',
              kisanClubMembership: {
                create: {
                  memberNumber: `VKC-CAT-${suffix.slice(0, 8)}`,
                  status: KisanClubMembershipStatus.ACTIVE,
                  homePincode: '207001',
                  homeDistrict: 'Etah',
                  joinedAt: new Date(),
                  termsVersion: 'v1',
                  termsAcceptedAt: new Date(),
                },
              },
            },
          },
        },
      }),
    ]);
    await Promise.all([
      prisma.organisationMembership.create({
        data: {
          userId: operations.id,
          organisationId: context.id,
          role: PlatformRole.OPERATIONS_MANAGER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.organisationMembership.create({
        data: {
          userId: farmer.id,
          organisationId: context.id,
          role: PlatformRole.FARMER,
          status: MembershipStatus.ACTIVE,
        },
      }),
    ]);
    operationsHeaders = headers(operations.id, PlatformRole.OPERATIONS_MANAGER, context.id);
    farmerHeaders = headers(farmer.id, PlatformRole.FARMER, context.id);
    vardhnamProductId = await seedStockedProduct(OrganisationType.VARDHNAM, suffix, 'Vardhnam');
    thirdPartyProductId = await seedStockedProduct(OrganisationType.COMPANY, suffix, 'Third Party');

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
    await app?.close();
    await prisma.$disconnect();
  });

  it('rejects third-party enrolment and exposes only active region-eligible Vardhnam products', async () => {
    if (!app) throw new Error('Nest application did not boot');
    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/programmes')
      .set(operationsHeaders)
      .send({
        productId: thirdPartyProductId,
        startsAt: '2026-08-01T00:00:00.000Z',
        reason: 'Must be rejected',
      })
      .expect(400);

    const programmeResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/programmes')
      .set(operationsHeaders)
      .send({
        productId: vardhnamProductId,
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2027-08-01T00:00:00.000Z',
        eligiblePincodes: ['207001'],
        eligibleDistricts: ['Etah'],
        displayPriority: 50,
        reason: 'Etah Club pilot',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/kisan-club/programmes/${programmeResponse.body.data.id}`)
      .set(operationsHeaders)
      .send({ status: 'ACTIVE', reason: 'Approved for pilot' })
      .expect(200);

    const programmeList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/programmes')
      .query({ status: 'ACTIVE', productId: vardhnamProductId })
      .set(operationsHeaders)
      .expect(200);
    expect(programmeList.body.data).toMatchObject({
      total: 1,
      items: [{ id: programmeResponse.body.data.id, status: 'ACTIVE' }],
    });

    const benefitResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/benefit-rules')
      .set(operationsHeaders)
      .send({
        programmeId: programmeResponse.body.data.id,
        benefitType: 'FLAT_AMOUNT_OFF',
        flatAmountPaise: 500,
        maxBenefitPaise: 1000,
        minimumQuantity: 1,
        eligiblePincodes: ['207001'],
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2027-08-01T00:00:00.000Z',
        totalUsageLimit: 100,
        perMemberUsageLimit: 2,
        reason: 'Etah launch benefit',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/kisan-club/benefit-rules/${benefitResponse.body.data.id}`)
      .set(operationsHeaders)
      .send({ status: 'ACTIVE', reason: 'Approved within pilot budget' })
      .expect(200);

    const benefitList = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/benefit-rules')
      .query({ status: 'ACTIVE', programmeId: programmeResponse.body.data.id })
      .set(operationsHeaders)
      .expect(200);
    expect(benefitList.body.data).toMatchObject({
      total: 1,
      items: [
        {
          id: benefitResponse.body.data.id,
          flatAmountPaise: 500,
          percentBps: null,
          usageCount: 0,
        },
      ],
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/products')
      .query({ pincode: '207001' })
      .set(farmerHeaders)
      .expect(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      id: vardhnamProductId,
      clubProgrammes: [expect.objectContaining({ id: programmeResponse.body.data.id })],
    });
    expect(JSON.stringify(response.body.data)).not.toContain(thirdPartyProductId);
  });
});

async function seedStockedProduct(
  ownerType: OrganisationType,
  suffix: string,
  label: string,
): Promise<string> {
  const key = `${label.toLowerCase().replaceAll(' ', '-')}-${randomUUID()}`;
  const owner = await prisma.organisation.create({
    data: {
      type: ownerType,
      slug: `${key}-owner`,
      legalName: `${label} Product Owner`,
      displayName: `${label} Product Owner`,
      status: OrganisationStatus.ACTIVE,
    },
  });
  const distributor = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `${key}-distributor`,
      legalName: `${label} Distributor`,
      displayName: `${label} Distributor`,
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: owner.id,
      name: `${label} Brand`,
      slug: `${key}-brand`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: owner.id,
      brandId: brand.id,
      name: `${label} Wheat Seed`,
      slug: `${key}-product`,
      category: 'Seeds',
      cropTargets: ['Wheat'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `${key.slice(0, 30)}-${suffix.slice(0, 5)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 120000,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributor.id,
      code: `${key.slice(0, 30)}-WH`,
      name: `${label} Warehouse`,
      addressLine1: 'Pilot market',
      city: 'Etah',
      state: 'Uttar Pradesh',
      pincode: '207001',
      status: WarehouseStatus.ACTIVE,
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      distributorOrganisationId: distributor.id,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: variant.id,
      batchNumber: `${key.slice(0, 35)}-B`,
      expiryDate: new Date('2027-08-01T00:00:00.000Z'),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: distributor.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      productId: product.id,
      variantId: variant.id,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: 20,
      balanceAfter: 20,
      reason: 'Club catalogue test stock',
    },
  });
  await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributor.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `${key.slice(0, 35)}-O`,
      sellingPricePaise: 110000,
      serviceablePincodes: ['207001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });
  return product.id;
}

function headers(userId: string, role: PlatformRole, organisationId: string) {
  return {
    'x-user-id': userId,
    'x-user-role': role,
    'x-organisation-id': organisationId,
  };
}
