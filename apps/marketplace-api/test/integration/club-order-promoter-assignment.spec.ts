import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  CommissionRuleStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  KisanClubAssignmentReason,
  KisanClubAssignmentStatus,
  KisanClubFulfilmentMode,
  KisanClubFulfilmentStatus,
  KisanClubMembershipStatus,
  KisanClubProgrammeStatus,
  KycDocumentStatus,
  KycDocumentType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductOrderStatus,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

/**
 * Covers the one link in the order chain that had no end-to-end proof: the
 * promoter coordination record that `KisanClubFulfilmentService.createForConfirmedOrders`
 * is supposed to create the moment a Club order's payment settles.
 *
 * `kisan-club-fulfilment.spec.ts` inserts that record with a direct Prisma call
 * and starts from there, so it verifies the coordination lifecycle but never the
 * code that produces the record. The unit spec exercises the producer against
 * mocks, which cannot show whether its query actually matches real rows -- and
 * that query is the risk. Eligibility walks membership -> promoter user ->
 * `clubEnabled` profile -> promoter organisation -> approved, unexpired KYC ->
 * active organisation membership in a promoter role. Every one of those failing
 * hits a bare `continue`: no assignment, no error, no log. A Club order simply
 * arrives with nobody coordinating it, and nothing anywhere says so.
 *
 * So these tests drive a real farmer order through cart, checkout and mock
 * payment, then assert the record exists (or deliberately does not) through the
 * promoter's own API rather than by reading the table directly.
 */
describe('Club order promoter assignment on payment confirmation', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedClubOrderData>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
    process.env.KISAN_CLUB_ENABLED = 'true';

    await prisma.$connect();
    await seedPermissions(prisma);
    seeded = await seedClubOrderData();

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

  it('assigns the active member promoter when a Club order is paid', async () => {
    const server = requireServer();
    const orderId = await placeConfirmedOrder(
      server,
      seeded.eligible.farmerHeaders,
      seeded.eligible.farmerAddressId,
      'eligible',
    );

    // The programme is what makes this a Club order at all; without it the
    // producer skips the order before promoter eligibility is even considered.
    const order = await prisma.productOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.isKisanClubOrder).toBe(true);
    expect(order.status).toBe(ProductOrderStatus.CONFIRMED);

    // Read it back the way the promoter's app does, so this also proves the
    // record is visible under own-scope permissions rather than merely present.
    const inbox = await request(server)
      .get('/api/v1/kisan-club/fulfilment/assignments')
      .query({ limit: 50 })
      .set(seeded.eligible.promoterHeaders)
      .expect(200);

    const assignments = inbox.body.data.items as Array<{
      id: string;
      productOrderId: string;
      promoterUserId: string;
      status: string;
      mode: string;
    }>;
    const assignment = assignments.find((item) => item.productOrderId === orderId);
    expect(assignment).toBeDefined();
    expect(assignment).toMatchObject({
      promoterUserId: seeded.eligible.promoterUserId,
      status: KisanClubFulfilmentStatus.ASSIGNED,
      // No benefit token was redeemed, so this is a plain Club order rather
      // than a promoter-assisted purchase.
      mode: KisanClubFulfilmentMode.CLUB_HOME_DELIVERY,
    });

    // The assignment is only half the record; the lifecycle history is what
    // operator surfaces read, and it is written in the same transaction.
    const stored = await prisma.kisanClubFulfilmentAssignment.findUniqueOrThrow({
      where: { productOrderId: orderId },
      include: { statusHistory: true },
    });
    expect(stored.membershipId).toBe(seeded.eligible.membershipId);
    expect(stored.statusHistory).toHaveLength(1);
    expect(stored.statusHistory[0]).toMatchObject({
      toStatus: KisanClubFulfilmentStatus.ASSIGNED,
    });

    // Confirming payment is not a delivery event: the seller order must still be
    // waiting for the distributor, untouched by Club coordination.
    expect(stored.productOrderId).toBe(orderId);
    expect((await prisma.productOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      ProductOrderStatus.CONFIRMED,
    );
  });

  it('leaves a Club order unassigned when the promoter organisation KYC has expired', async () => {
    const server = requireServer();
    const orderId = await placeConfirmedOrder(
      server,
      seeded.expiredKyc.farmerHeaders,
      seeded.expiredKyc.farmerAddressId,
      'expired-kyc',
    );

    // The order itself must be unaffected -- an ineligible promoter is not a
    // checkout failure, and the farmer's paid order still has to stand.
    const order = await prisma.productOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.isKisanClubOrder).toBe(true);
    expect(order.status).toBe(ProductOrderStatus.CONFIRMED);

    // This is the silent-failure mode the suite otherwise could not see. The
    // farmer has an ACTIVE promoter relationship and a clubEnabled profile; only
    // the organisation's KYC expiry disqualifies it.
    const stored = await prisma.kisanClubFulfilmentAssignment.findUnique({
      where: { productOrderId: orderId },
    });
    expect(stored).toBeNull();

    const inbox = await request(server)
      .get('/api/v1/kisan-club/fulfilment/assignments')
      .query({ limit: 50 })
      .set(seeded.expiredKyc.promoterHeaders)
      .expect(200);
    expect(inbox.body.data.items).toHaveLength(0);
  });

  function requireServer() {
    if (!app) throw new Error('Nest application was not initialised');
    return app.getHttpServer();
  }

  async function placeConfirmedOrder(
    server: ReturnType<typeof requireServer>,
    farmerHeaders: Headers,
    farmerAddressId: string,
    keySuffix: string,
  ): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId,
        quantity: 1,
        reason: `Club farmer selected an item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', `club-assign-checkout-${keySuffix}-${randomUUID()}`)
      .send({ farmerAddressId, reason: `Club farmer confirmed cart for ${keySuffix}` })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const intentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', `club-assign-intent-${keySuffix}-${randomUUID()}`)
      .send({ checkoutId, reason: `Club farmer started mock payment for ${keySuffix}` })
      .expect(201);
    const paymentIntentId = intentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', `club-assign-confirm-${keySuffix}-${randomUUID()}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);

    const orders = confirmResponse.body.data.checkout.orders as Array<{
      id: string;
      status: string;
    }>;
    expect(orders).toHaveLength(1);
    expect(orders[0]?.status).toBe(ProductOrderStatus.CONFIRMED);
    return orders[0]!.id;
  }
});

interface ClubFarmerFixture {
  farmerHeaders: Headers;
  farmerAddressId: string;
  membershipId: string;
  promoterHeaders: Headers;
  promoterUserId: string;
}

async function seedClubOrderData(): Promise<{
  offerId: string;
  eligible: ClubFarmerFixture;
  expiredKyc: ClubFarmerFixture;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const platformOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `club-assign-platform-${suffix}`,
    legalName: 'Club Assignment Platform',
    displayName: 'Club Assignment Platform',
  });
  const adminUser = await createUser(`club-assign-admin-${suffix}@example.local`, 'Club Admin');
  await createMembership(adminUser.id, platformOrganisation.id, PlatformRole.SUPER_ADMIN);

  // The Club catalogue is Vardhnam-only: `KisanClubProgrammeService` refuses to
  // enrol a product owned by anyone else, so a company-owned product here would
  // describe a state the programme API cannot produce. The distributor below is
  // still the seller of record -- Vardhnam owns the catalogue, not the sale.
  const companyOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `club-assign-company-${suffix}`,
    legalName: 'Club Assignment Seeds Private Limited',
    displayName: 'Club Assignment Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Club Assignment Brand',
      slug: `club-assign-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Club Assignment Hybrid Wheat Seed ${suffix}`,
      slug: `club-assign-hybrid-wheat-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Wheat'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `CA-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125_000,
    },
  });

  // What makes an order a Club order. Without an ACTIVE programme covering the
  // product, `isKisanClubOrder` stays false and the producer never looks at the
  // promoter relationship at all.
  await prisma.kisanClubProductProgramme.create({
    data: {
      productId: product.id,
      variantId: variant.id,
      status: KisanClubProgrammeStatus.ACTIVE,
      startsAt: new Date(Date.now() - 86_400_000),
      eligiblePincodes: ['302001'],
      createdByUserId: adminUser.id,
      createdByRole: PlatformRole.SUPER_ADMIN,
      reason: 'Club order promoter assignment fixture',
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `club-assign-distributor-${suffix}`,
    legalName: 'Club Assignment Jaipur Distributor Private Limited',
    displayName: 'Club Assignment Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `CA-JPR-${short}`,
      name: 'Club Assignment Jaipur Warehouse',
      addressLine1: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      status: WarehouseStatus.ACTIVE,
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: variant.id,
      batchNumber: `CA-BATCH-${short}`,
      expiryDate: futureDate(180),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      productId: product.id,
      variantId: variant.id,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: 40,
      balanceAfter: 40,
      reason: 'Opening stock for Club promoter assignment fixture',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `CA-OFFER-${short}`,
      sellingPricePaise: 118_000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  await prisma.commissionRule.create({
    data: {
      marketplaceCommissionBps: 500,
      promoterCommissionBps: 0,
      deliveryFeePaise: 2500,
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: new Date(Date.now() - 86_400_000),
      createdByUserId: adminUser.id,
      createdByRole: PlatformRole.SUPER_ADMIN,
      reason: 'Club order promoter assignment fixture',
    },
  });

  const eligible = await createClubFarmerWithPromoter({
    label: 'eligible',
    suffix,
    // Approved and still valid: the promoter should receive the order.
    kycExpiresAt: futureDate(365),
    promoterOrganisationType: OrganisationType.VARDHNAM,
  });
  const expiredKyc = await createClubFarmerWithPromoter({
    label: 'expired',
    suffix,
    // Approved but lapsed. Everything else about this promoter is eligible, so
    // the expiry is the only thing that can disqualify them.
    kycExpiresAt: futureDate(-1),
    // Deliberately a partner organisation rather than VARDHNAM. First-party
    // organisations are verified by being first-party (see
    // `promoter-eligibility.ts`), so an expired document on a VARDHNAM org
    // proves nothing -- this case would pass no matter what the KYC rule did.
    promoterOrganisationType: OrganisationType.SERVICE_PROVIDER,
  });

  return { offerId: offer.id, eligible, expiredKyc };
}

async function createClubFarmerWithPromoter(input: {
  label: string;
  suffix: string;
  kycExpiresAt: Date;
  promoterOrganisationType: OrganisationType;
}): Promise<ClubFarmerFixture> {
  const { label, suffix, kycExpiresAt, promoterOrganisationType } = input;
  const short = `${label}-${suffix.slice(0, 6)}`;

  const promoterOrganisation = await createOrganisation({
    type: promoterOrganisationType,
    slug: `club-assign-promoter-org-${label}-${suffix}`,
    legalName: `Club Assignment Promoter Network ${label}`,
    displayName: `Club Assignment Promoter Network ${label}`,
  });
  await prisma.kycDocument.create({
    data: {
      organisationId: promoterOrganisation.id,
      documentType: KycDocumentType.PAN,
      status: KycDocumentStatus.APPROVED,
      documentNumber: `CAPAN${label.toUpperCase().slice(0, 4)}`,
      expiresAt: kycExpiresAt,
    },
  });

  const promoterUser = await createUser(
    `club-assign-promoter-${label}-${suffix}@example.local`,
    `Club Promoter ${label}`,
  );
  await createMembership(promoterUser.id, promoterOrganisation.id, PlatformRole.PROMOTER);
  await prisma.kisanClubPromoterProfile.create({
    data: {
      promoterUserId: promoterUser.id,
      promoterOrganisationId: promoterOrganisation.id,
      homeVillage: 'Rampura',
      homePincode: '302001',
      clubEnabled: true,
      acceptingNewFarmers: true,
      maxActiveFarmers: 50,
      activeFarmerCount: 1,
    },
  });

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `club-assign-farmer-context-${label}-${suffix}`,
    legalName: `Club Assignment Farmer Context ${label}`,
    displayName: `Club Assignment Farmer Context ${label}`,
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+9190${randomDigits(8)}`,
      profile: { create: { displayName: `Club Farmer ${label}` } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: `Club Farmer ${label}`,
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: `Club Farmer ${label}`,
      phone: `+9199${randomDigits(8)}`,
      addressLine1: 'Khasra 42, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      isDefault: true,
    },
  });

  const membership = await prisma.kisanClubMembership.create({
    data: {
      farmerProfileId: farmerProfile.id,
      memberNumber: `VKC-CA-${short}`.slice(0, 40),
      status: KisanClubMembershipStatus.ACTIVE,
      homePincode: '302001',
      homeVillage: 'Rampura',
      homeDistrict: 'Jaipur',
      homeState: 'Rajasthan',
      joinedAt: new Date(),
      termsVersion: 'v1',
      termsAcceptedAt: new Date(),
    },
  });
  await prisma.kisanClubPromoterAssignment.create({
    data: {
      membershipId: membership.id,
      promoterUserId: promoterUser.id,
      status: KisanClubAssignmentStatus.ACTIVE,
      assignmentReason: KisanClubAssignmentReason.MANUAL_OPS,
      reason: 'Club order promoter assignment fixture',
    },
  });

  return {
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    farmerAddressId: farmerAddress.id,
    membershipId: membership.id,
    promoterHeaders: headersFor(promoterUser.id, PlatformRole.PROMOTER, promoterOrganisation.id),
    promoterUserId: promoterUser.id,
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
  gstin?: string;
}) {
  return prisma.organisation.create({
    data: {
      type: input.type,
      slug: input.slug,
      legalName: input.legalName,
      displayName: input.displayName,
      gstin: input.gstin ?? null,
      registeredStateCode: input.gstin?.slice(0, 2) ?? null,
      gstinVerifiedAt: input.gstin ? new Date() : null,
      status: OrganisationStatus.ACTIVE,
    },
  });
}

async function createUser(email: string, displayName: string) {
  return prisma.user.create({
    data: { email, profile: { create: { displayName } } },
  });
}

async function createMembership(
  userId: string,
  organisationId: string,
  role: PlatformRole,
): Promise<void> {
  await prisma.organisationMembership.create({
    data: { userId, organisationId, role, status: MembershipStatus.ACTIVE },
  });
}

function randomDigits(count: number): string {
  let value = '';
  for (let index = 0; index < count; index += 1) {
    value += Math.floor(Math.random() * 10).toString();
  }
  return value;
}

function futureDate(daysFromToday: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
}
