import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  CommissionEntryType,
  CommissionRuleStatus,
  DistributorOfferStatus,
  DeliveryPartnerAvailabilityStatus,
  FulfilmentMode,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  PromoterAttributionStatus,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

describe('Phase 6 promoter attribution', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedPhase6Data>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedPhase6Data();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('rejects attributing a user who is not an active promoter or sales partner', async () => {
    const server = requireServer();

    await request(server)
      .post('/api/v1/promoters/attributions')
      .set(seeded.operationsHeaders)
      .send({
        promoterUserId: seeded.distributorUserId,
        farmerUserId: seeded.farmerAUserId,
        reason: 'Attempted attribution with a non-promoter user',
      })
      .expect(400);
  });

  it('rejects attributing an unknown farmer', async () => {
    const server = requireServer();

    await request(server)
      .post('/api/v1/promoters/attributions')
      .set(seeded.operationsHeaders)
      .send({
        promoterUserId: seeded.promoterUserId,
        farmerUserId: randomUUID(),
        reason: 'Attempted attribution with an unknown farmer',
      })
      .expect(404);
  });

  it('creates an attribution and revokes the prior active one on re-assignment', async () => {
    const server = requireServer();

    const firstResponse = await request(server)
      .post('/api/v1/promoters/attributions')
      .set(seeded.operationsHeaders)
      .send({
        promoterUserId: seeded.promoterUserId,
        farmerUserId: seeded.farmerAUserId,
        reason: 'Promoter assisted this farmer with onboarding',
      })
      .expect(201);
    expect(firstResponse.body.data.status).toBe(PromoterAttributionStatus.ACTIVE);
    const firstAttributionId = firstResponse.body.data.id as string;

    const secondResponse = await request(server)
      .post('/api/v1/promoters/attributions')
      .set(seeded.operationsHeaders)
      .send({
        promoterUserId: seeded.otherPromoterUserId,
        farmerUserId: seeded.farmerAUserId,
        reason: 'Farmer reassigned to a different promoter',
      })
      .expect(201);
    expect(secondResponse.body.data.status).toBe(PromoterAttributionStatus.ACTIVE);

    const firstAttribution = await prisma.promoterAttribution.findUniqueOrThrow({
      where: { id: firstAttributionId },
    });
    expect(firstAttribution.status).toBe(PromoterAttributionStatus.REVOKED);

    const listResponse = await request(server)
      .get('/api/v1/promoters/attributions')
      .query({ farmerUserId: seeded.farmerAUserId })
      .set(seeded.operationsHeaders)
      .expect(200);
    expect(listResponse.body.data.items).toHaveLength(2);
  });

  it('scopes /attributions/me to the requesting promoter and rejects other roles', async () => {
    const server = requireServer();

    await request(server).get('/api/v1/promoters/attributions/me').expect(401);

    const otherPromoterOwnResponse = await request(server)
      .get('/api/v1/promoters/attributions/me')
      .set(seeded.otherPromoterHeaders)
      .expect(200);
    const ownItems = otherPromoterOwnResponse.body.data.items as Array<{ promoterUserId: string }>;
    expect(ownItems.length).toBeGreaterThan(0);
    expect(ownItems.every((item) => item.promoterUserId === seeded.otherPromoterUserId)).toBe(true);

    await request(server)
      .get('/api/v1/promoters/attributions')
      .set(seeded.otherPromoterHeaders)
      .expect(403);
  });

  it('calculates a promoter-commission entry on delivery for an attributed farmer', async () => {
    const server = requireServer();
    const orderId = await driveOrderToDelivered(server, seeded.farmerAHeaders, 'attributed');

    const commissionEntries = await prisma.commissionEntry.findMany({
      where: { productOrderId: orderId },
    });
    // Marketplace commission + distributor payable + promoter commission +
    // the unconditional delivery-fee entry.
    expect(commissionEntries).toHaveLength(4);
    const promoterEntry = commissionEntries.find(
      (entry) => entry.entryType === CommissionEntryType.PROMOTER_COMMISSION,
    );
    expect(promoterEntry).toBeDefined();
    expect(promoterEntry?.amountPaise).toBe(0);
  });

  it('produces exactly the marketplace, payable and delivery-fee entries for a non-attributed farmer', async () => {
    const server = requireServer();
    const orderId = await driveOrderToDelivered(server, seeded.farmerBHeaders, 'unattributed');

    const commissionEntries = await prisma.commissionEntry.findMany({
      where: { productOrderId: orderId },
    });
    expect(commissionEntries).toHaveLength(3);
    expect(
      commissionEntries.some(
        (entry) => entry.entryType === CommissionEntryType.PROMOTER_COMMISSION,
      ),
    ).toBe(false);
  });

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  /** Drives cart -> checkout -> payment -> full fulfilment lifecycle -> OTP delivery. */
  async function driveOrderToDelivered(
    server: Parameters<typeof request>[0],
    farmerHeaders: Headers,
    keySuffix: string,
  ): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId:
          farmerHeaders === seeded.farmerAHeaders
            ? seeded.farmerAAddressId
            : seeded.farmerBAddressId,
        quantity: 1,
        reason: `Selected Phase 6 item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase6-checkout-${keySuffix}-${randomUUID()}`)
      .send({
        farmerAddressId:
          farmerHeaders === seeded.farmerAHeaders
            ? seeded.farmerAAddressId
            : seeded.farmerBAddressId,
        reason: `Farmer confirmed Phase 6 cart for ${keySuffix}`,
      })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase6-intent-${keySuffix}-${randomUUID()}`)
      .send({ checkoutId, reason: `Farmer started mock payment for ${keySuffix}` })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase6-confirm-${keySuffix}-${randomUUID()}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);
    const orderId = confirmResponse.body.data.checkout.orders[0].id as string;

    for (const step of ['accept', 'ready-to-pack', 'pack'] as const) {
      await request(server)
        .post(`/api/v1/fulfilment/orders/${orderId}/${step}`)
        .set(seeded.distributorHeaders)
        .send({ reason: `Phase 6 ${step} for ${keySuffix}` })
        .expect(201);
    }
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(seeded.distributorHeaders)
      .send({ reason: `Invoice generated for ${keySuffix}` })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`)
      .set(seeded.distributorHeaders)
      .send({ reason: `Dispatch staged for ${keySuffix}` })
      .expect(201);

    const assignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: `Assigned for ${keySuffix}`,
      })
      .expect(201);
    const otpCode = assignmentResponse.body.data.deliveryAssignment.mockOtpCode as string;

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: `Accepted for ${keySuffix}` })
      .expect(201);

    const labelResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/dispatch-label`)
      .set(seeded.distributorHeaders)
      .send({ reason: `Package label for ${keySuffix}` })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ packageQrCode: labelResponse.body.data.packageQrCode })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: `Collected for ${keySuffix}` })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        otpCode,
        proofNote: `Delivered for ${keySuffix}`,
        proofLocationStatus: 'UNAVAILABLE',
      })
      .expect(201);

    return orderId;
  }
});

async function seedPhase6Data(): Promise<{
  operationsHeaders: Headers;
  distributorHeaders: Headers;
  deliveryPartnerHeaders: Headers;
  farmerAHeaders: Headers;
  farmerBHeaders: Headers;
  otherPromoterHeaders: Headers;
  distributorUserId: string;
  promoterUserId: string;
  otherPromoterUserId: string;
  farmerAUserId: string;
  farmerAAddressId: string;
  farmerBAddressId: string;
  deliveryPartnerUserId: string;
  offerId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6-admin-${suffix}`,
    legalName: 'Phase 6 Admin Organisation',
    displayName: 'Phase 6 Admin',
  });
  const operationsUser = await createUser(`phase6-ops-${suffix}@example.local`, 'Phase 6 Ops');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `phase6-company-${suffix}`,
    legalName: 'Phase 6 Seeds Private Limited',
    displayName: 'Phase 6 Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 6 Seed Brand',
      slug: `phase6-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 6 Hybrid Bajra Seed ${suffix}`,
      slug: `phase6-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P6-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125_000,
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `phase6-distributor-${suffix}`,
    legalName: 'Phase 6 Jaipur Distributor Private Limited',
    displayName: 'Phase 6 Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `phase6-distributor-${suffix}@example.local`,
    'Phase 6 Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );
  // Invoice generation refuses to stamp a GST invoice without a complete
  // seller address, so the seller needs a distributor profile before any
  // order in this fixture can reach delivery.
  await prisma.distributorProfile.create({
    data: {
      organisationId: distributorOrganisation.id,
      primaryContactName: 'Phase 6 Distributor Owner',
      primaryContactPhone: '+919000000022',
      operatingAddress: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      serviceablePincodes: ['302001'],
    },
  });

  const deliveryOrganisation = await createOrganisation({
    type: OrganisationType.DELIVERY_PARTNER,
    slug: `phase6-delivery-${suffix}`,
    legalName: 'Phase 6 Last Mile Logistics',
    displayName: 'Phase 6 Last Mile',
  });
  const deliveryPartnerUser = await createUser(
    `phase6-delivery-${suffix}@example.local`,
    'Phase 6 Delivery Partner',
  );
  await createMembership(
    deliveryPartnerUser.id,
    deliveryOrganisation.id,
    PlatformRole.DELIVERY_PARTNER,
  );
  await prisma.deliveryPartnerProfile.create({
    data: {
      userId: deliveryPartnerUser.id,
      organisationId: deliveryOrganisation.id,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      availabilityChangedAt: new Date(),
    },
  });

  const promoterOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6-promoter-org-${suffix}`,
    legalName: 'Phase 6 Promoter Network',
    displayName: 'Phase 6 Promoter Network',
  });
  const promoterUser = await createUser(
    `phase6-promoter-${suffix}@example.local`,
    'Phase 6 Promoter',
  );
  await createMembership(promoterUser.id, promoterOrganisation.id, PlatformRole.PROMOTER);
  const otherPromoterUser = await createUser(
    `phase6-sales-partner-${suffix}@example.local`,
    'Phase 6 Sales Partner',
  );
  await createMembership(otherPromoterUser.id, promoterOrganisation.id, PlatformRole.SALES_PARTNER);

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6-farmer-context-${suffix}`,
    legalName: 'Phase 6 Farmer Context',
    displayName: 'Phase 6 Farmer Context',
  });
  const farmerAUser = await prisma.user.create({
    data: {
      phone: `+91006${short}`,
      profile: { create: { displayName: 'Phase 6 Farmer A' } },
    },
  });
  await createMembership(farmerAUser.id, farmerOrganisation.id, PlatformRole.FARMER);
  const farmerBUser = await prisma.user.create({
    data: {
      phone: `+91007${short}`,
      profile: { create: { displayName: 'Phase 6 Farmer B' } },
    },
  });
  await createMembership(farmerBUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P6-JPR-${short}`,
      name: 'Phase 6 Jaipur Distributor Warehouse',
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
      batchNumber: `P6-BATCH-${short}`,
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
      reason: 'Opening stock for Phase 6 promoter-attribution validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P6-OFFER-${short}`,
      sellingPricePaise: 118_000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  const farmerAProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerAUser.id,
      fullName: 'Phase 6 Farmer A',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerAProfile.id,
      label: 'Home',
      recipientName: 'Phase 6 Farmer A',
      phone: '+919999999997',
      addressLine1: 'Khasra 42, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      isDefault: true,
    },
  });
  const farmerBProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerBUser.id,
      fullName: 'Phase 6 Farmer B',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerBAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerBProfile.id,
      label: 'Home',
      recipientName: 'Phase 6 Farmer B',
      phone: '+919999999996',
      addressLine1: 'Khasra 43, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      isDefault: true,
    },
  });

  // The global default commission rule that recordDeliveryCommission falls
  // back to whenever no distributor-specific override exists.
  await prisma.commissionRule.create({
    data: {
      sellerOrganisationId: null,
      marketplaceCommissionBps: 500,
      promoterCommissionBps: 0,
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      reason: 'Phase 6 spec global default commission rate',
    },
  });

  const farmerAHeaders = headersFor(farmerAUser.id, PlatformRole.FARMER, farmerOrganisation.id);
  const farmerBHeaders = headersFor(farmerBUser.id, PlatformRole.FARMER, farmerOrganisation.id);

  return {
    operationsHeaders: headersFor(
      operationsUser.id,
      PlatformRole.OPERATIONS_MANAGER,
      adminOrganisation.id,
    ),
    distributorHeaders: headersFor(
      distributorUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      distributorOrganisation.id,
    ),
    deliveryPartnerHeaders: headersFor(
      deliveryPartnerUser.id,
      PlatformRole.DELIVERY_PARTNER,
      deliveryOrganisation.id,
    ),
    farmerAHeaders,
    farmerBHeaders,
    otherPromoterHeaders: headersFor(
      otherPromoterUser.id,
      PlatformRole.SALES_PARTNER,
      promoterOrganisation.id,
    ),
    distributorUserId: distributorUser.id,
    promoterUserId: promoterUser.id,
    otherPromoterUserId: otherPromoterUser.id,
    farmerAUserId: farmerAUser.id,
    farmerAAddressId: farmerAAddress.id,
    farmerBAddressId: farmerBAddress.id,
    deliveryPartnerUserId: deliveryPartnerUser.id,
    offerId: offer.id,
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
    data: {
      email,
      profile: { create: { displayName } },
    },
  });
}

async function createMembership(
  userId: string,
  organisationId: string,
  role: PlatformRole,
): Promise<void> {
  await prisma.organisationMembership.create({
    data: {
      userId,
      organisationId,
      role,
      status: MembershipStatus.ACTIVE,
    },
  });
}

async function seedPermissions(): Promise<void> {
  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionByCode.set(savedPermission.code, savedPermission.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing permission ${permissionCode}`);
      }
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as PlatformRole,
            permissionId,
          },
        },
        create: {
          role: role as PlatformRole,
          permissionId,
        },
        update: {},
      });
    }
  }
}

function futureDate(daysFromToday: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
}
