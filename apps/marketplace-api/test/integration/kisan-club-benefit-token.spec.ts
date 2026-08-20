import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  KisanClubAssignmentReason,
  KisanClubBenefitStatus,
  KisanClubBenefitTokenStatus,
  KisanClubBenefitType,
  KisanClubMembershipStatus,
  KisanClubProgrammeStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductCheckoutStatus,
  ProductOrderStatus,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

describe('Kisan Club benefit token assisted checkout', () => {
  let app: INestApplication | undefined;
  let farmerHeaders: Record<string, string>;
  let promoterHeaders: Record<string, string>;
  let membershipId: string;
  let offerId: string;
  let farmerUserId: string;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);

    const suffix = randomUUID();
    const [context, productOwner, distributor] = await Promise.all([
      createOrganisation(OrganisationType.VARDHNAM, `token-context-${suffix}`, 'Club Context'),
      createOrganisation(OrganisationType.VARDHNAM, `token-owner-${suffix}`, 'Vardhnam Inputs'),
      createOrganisation(
        OrganisationType.DISTRIBUTOR,
        `token-distributor-${suffix}`,
        'Etah Distributor',
      ),
    ]);
    const [farmer, promoter] = await Promise.all([
      prisma.user.create({
        data: {
          phone: `+9161${Math.floor(10000000 + Math.random() * 89999999)}`,
          farmerProfile: {
            create: {
              fullName: 'Benefit Token Farmer',
              primaryPincode: '207001',
              district: 'Etah',
              addresses: {
                create: {
                  label: 'Home',
                  recipientName: 'Benefit Token Farmer',
                  phone: '9876543210',
                  addressLine1: 'Pilot village',
                  city: 'Etah',
                  district: 'Etah',
                  state: 'Uttar Pradesh',
                  stateCode: '09',
                  pincode: '207001',
                  isDefault: true,
                },
              },
              kisanClubMembership: {
                create: {
                  memberNumber: `VKC-TOKEN-${suffix.slice(0, 8)}`,
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
        include: { farmerProfile: { include: { kisanClubMembership: true } } },
      }),
      prisma.user.create({
        data: { phone: `+9162${Math.floor(10000000 + Math.random() * 89999999)}` },
      }),
    ]);
    membershipId = farmer.farmerProfile?.kisanClubMembership?.id ?? '';
    farmerUserId = farmer.id;
    if (!membershipId) throw new Error('Kisan Club membership fixture was not created');

    await Promise.all([
      prisma.organisationMembership.create({
        data: {
          userId: farmer.id,
          organisationId: context.id,
          role: PlatformRole.FARMER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.organisationMembership.create({
        data: {
          userId: promoter.id,
          organisationId: context.id,
          role: PlatformRole.PROMOTER,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.kisanClubPromoterProfile.create({
        data: {
          promoterUserId: promoter.id,
          promoterOrganisationId: context.id,
          homePincode: '207001',
          clubEnabled: true,
        },
      }),
      prisma.kisanClubPromoterAssignment.create({
        data: {
          membershipId,
          promoterUserId: promoter.id,
          assignmentReason: KisanClubAssignmentReason.AUTO_MATCHED,
        },
      }),
    ]);
    farmerHeaders = authHeaders(farmer.id, PlatformRole.FARMER, context.id);
    promoterHeaders = authHeaders(promoter.id, PlatformRole.PROMOTER, context.id);
    offerId = await seedBenefitOffer(productOwner.id, distributor.id, suffix);

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

  it('issues a one-time bearer code and creates an unpaid seller order exactly once', async () => {
    if (!app) throw new Error('Nest application did not boot');
    const issueResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/benefit-tokens')
      .set(farmerHeaders)
      .send({ offerId, quantity: 2 })
      .expect(201);

    expect(issueResponse.body.data).toMatchObject({
      membershipId,
      offerId,
      quantity: 2,
      quotedUnitPricePaise: 10000,
      quotedBenefitPaise: 2000,
      quotedFarmerPayablePaise: 18000,
      status: KisanClubBenefitTokenStatus.ISSUED,
    });
    expect(issueResponse.body.data.code).toMatch(/^VKC-[A-F0-9]{8}-\d{6}$/);

    const storedIssuedToken = await prisma.kisanClubBenefitToken.findUniqueOrThrow({
      where: { id: issueResponse.body.data.id },
    });
    expect(storedIssuedToken.tokenHash).not.toContain(issueResponse.body.data.code);
    expect(storedIssuedToken.tokenSalt).not.toBe(issueResponse.body.data.code);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/kisan-club/benefit-tokens/me')
      .set(farmerHeaders)
      .expect(200);
    expect(JSON.stringify(listResponse.body.data)).not.toContain(issueResponse.body.data.code);
    expect(JSON.stringify(listResponse.body.data)).not.toContain(storedIssuedToken.tokenHash);

    const idempotencyKey = randomUUID();
    const redemption = {
      code: issueResponse.body.data.code,
      membershipId,
      reason: 'Promoter prepared the Club order for farmer payment',
    };
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/benefit-tokens/redeem')
      .set(promoterHeaders)
      .set('Idempotency-Key', idempotencyKey)
      .send(redemption)
      .expect(201);
    const replayResponse = await request(app.getHttpServer())
      .post('/api/v1/kisan-club/benefit-tokens/redeem')
      .set(promoterHeaders)
      .set('Idempotency-Key', idempotencyKey)
      .send(redemption)
      .expect(201);

    expect(replayResponse.body.data).toEqual(firstResponse.body.data);
    expect(firstResponse.body.data).toMatchObject({
      status: ProductCheckoutStatus.PENDING_PAYMENT,
      subtotalPaise: 20000,
      clubBenefitPaise: 2000,
      farmerPayablePaise: 18000,
      childOrderCount: 1,
      assistedPurchase: {
        benefitTokenId: issueResponse.body.data.id,
        paymentRequiredInApp: true,
      },
    });

    const productOrderId = firstResponse.body.data.assistedPurchase.productOrderId;
    const [storedToken, order, redemptionCount, fulfilmentCount, checkoutCount] = await Promise.all(
      [
        prisma.kisanClubBenefitToken.findUniqueOrThrow({
          where: { id: issueResponse.body.data.id },
        }),
        prisma.productOrder.findUniqueOrThrow({ where: { id: productOrderId } }),
        prisma.kisanClubBenefitRedemption.count({
          where: { benefitTokenId: issueResponse.body.data.id },
        }),
        prisma.kisanClubFulfilmentAssignment.count({ where: { productOrderId } }),
        prisma.productCheckout.count({ where: { farmerProfile: { userId: farmerUserId } } }),
      ],
    );
    expect(storedToken).toMatchObject({
      status: KisanClubBenefitTokenStatus.REDEEMED,
      consumedByUserId: promoterHeaders['x-user-id'],
      productOrderId,
    });
    expect(order).toMatchObject({
      status: ProductOrderStatus.INVENTORY_RESERVED,
      subtotalPaise: 20000,
      clubBenefitPaise: 2000,
      farmerPayablePaise: 18000,
      isKisanClubOrder: true,
    });
    expect(redemptionCount).toBe(1);
    expect(fulfilmentCount).toBe(0);
    expect(checkoutCount).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/kisan-club/benefit-tokens/redeem')
      .set(promoterHeaders)
      .set('Idempotency-Key', randomUUID())
      .send(redemption)
      .expect(409);
  });
});

async function createOrganisation(type: OrganisationType, slug: string, name: string) {
  return prisma.organisation.create({
    data: { type, slug, legalName: name, displayName: name, status: OrganisationStatus.ACTIVE },
  });
}

async function seedBenefitOffer(
  productOwnerId: string,
  distributorId: string,
  suffix: string,
): Promise<string> {
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: productOwnerId,
      name: `Token Brand ${suffix.slice(0, 8)}`,
      slug: `token-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: productOwnerId,
      brandId: brand.id,
      name: 'Club Wheat Seed',
      slug: `token-product-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Wheat'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `TOKEN-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 12000,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorId,
      code: `TOKEN-WH-${suffix.slice(0, 8)}`,
      name: 'Etah Token Warehouse',
      addressLine1: 'Pilot market',
      city: 'Etah',
      state: 'Uttar Pradesh',
      pincode: '207001',
      status: WarehouseStatus.ACTIVE,
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      distributorOrganisationId: distributorId,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: variant.id,
      batchNumber: `TOKEN-BATCH-${suffix.slice(0, 8)}`,
      expiryDate: new Date('2027-08-01T00:00:00.000Z'),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: distributorId,
      warehouseId: warehouse.id,
      batchId: batch.id,
      productId: product.id,
      variantId: variant.id,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: 20,
      balanceAfter: 20,
      reason: 'Benefit token integration stock',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorId,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `TOKEN-OFFER-${suffix.slice(0, 8)}`,
      sellingPricePaise: 10000,
      serviceablePincodes: ['207001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });
  const programme = await prisma.kisanClubProductProgramme.create({
    data: {
      productId: product.id,
      variantId: variant.id,
      status: KisanClubProgrammeStatus.ACTIVE,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2027-12-31T23:59:59.000Z'),
      eligiblePincodes: ['207001'],
    },
  });
  await prisma.kisanClubBenefitRule.create({
    data: {
      programmeId: programme.id,
      benefitType: KisanClubBenefitType.FLAT_AMOUNT_OFF,
      flatAmountPaise: 1000,
      minimumQuantity: 1,
      eligiblePincodes: ['207001'],
      status: KisanClubBenefitStatus.ACTIVE,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2027-12-31T23:59:59.000Z'),
      reason: 'Benefit token integration rule',
    },
  });
  return offer.id;
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
