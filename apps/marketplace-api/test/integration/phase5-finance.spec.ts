import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  CommissionEntryStatus,
  CommissionEntryType,
  CommissionRuleStatus,
  DistributorOfferStatus,
  FinancialLedgerEntryType,
  FulfilmentMode,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
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

describe('Phase 5 finance: payment ledger, commission rules, distributor payable, settlements', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedPhase5Data>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedPhase5Data();

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

  it('creates and versions commission rules, superseding the prior active version', async () => {
    const server = requireServer();
    // A throwaway organisation, isolated from the seeded distributor used by
    // the delivery/commission tests below, so versioning a rule here can't
    // change the global-rule fallback those tests depend on.
    const scopedOrganisation = await createOrganisation({
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase5-rule-scope-${randomUUID()}`,
      legalName: 'Phase 5 Rule Scope Distributor',
      displayName: 'Phase 5 Rule Scope Distributor',
    });
    const scopedOrganisationId = scopedOrganisation.id;

    const firstResponse = await request(server)
      .post('/api/v1/finance/commission-rules')
      .set(seeded.financeManagerHeaders)
      .send({
        sellerOrganisationId: scopedOrganisationId,
        marketplaceCommissionBps: 700,
        reason: 'Initial negotiated rate',
      })
      .expect(201);
    expect(firstResponse.body.data.status).toBe(CommissionRuleStatus.ACTIVE);
    const firstRuleId = firstResponse.body.data.id as string;

    const secondResponse = await request(server)
      .post('/api/v1/finance/commission-rules')
      .set(seeded.financeManagerHeaders)
      .send({
        sellerOrganisationId: scopedOrganisationId,
        marketplaceCommissionBps: 600,
        reason: 'Renegotiated rate',
      })
      .expect(201);
    expect(secondResponse.body.data.status).toBe(CommissionRuleStatus.ACTIVE);

    const listResponse = await request(server)
      .get('/api/v1/finance/commission-rules')
      .query({ sellerOrganisationId: scopedOrganisationId })
      .set(seeded.financeManagerHeaders)
      .expect(200);
    const rules = listResponse.body.data.items as Array<{ id: string; status: string }>;
    expect(rules).toHaveLength(2);
    expect(rules.find((rule) => rule.id === firstRuleId)?.status).toBe(
      CommissionRuleStatus.INACTIVE,
    );
  });

  it('rejects commission-rule access without finance permissions', async () => {
    const server = requireServer();

    await request(server).get('/api/v1/finance/ledger').expect(401);

    await request(server)
      .get('/api/v1/finance/ledger')
      .set(seeded.farmerHeaders)
      .expect(403);
  });

  it('calculates commission entries and a farmer-payment ledger entry when an order is delivered', async () => {
    const server = requireServer();
    const orderId = await driveOrderToDelivered(server, 'commission-calc');

    const commissionEntries = await prisma.commissionEntry.findMany({
      where: { productOrderId: orderId },
      orderBy: { entryType: 'asc' },
    });
    // Marketplace commission + distributor payable + an unconditional
    // delivery-fee entry (every delivered order has a delivery partner).
    expect(commissionEntries).toHaveLength(3);
    const marketplaceEntry = commissionEntries.find(
      (entry) => entry.entryType === CommissionEntryType.MARKETPLACE_COMMISSION,
    );
    const payableEntry = commissionEntries.find(
      (entry) => entry.entryType === CommissionEntryType.DISTRIBUTOR_PAYABLE,
    );
    expect(marketplaceEntry?.status).toBe(CommissionEntryStatus.PROVISIONAL);
    expect(marketplaceEntry?.amountPaise).toBe(5900);
    expect(payableEntry?.status).toBe(CommissionEntryStatus.PROVISIONAL);
    expect(payableEntry?.amountPaise).toBe(112_100);

    const commissionLedgerEntries = await prisma.financialLedgerEntry.findMany({
      where: { productOrderId: orderId },
    });
    expect(commissionLedgerEntries).toHaveLength(3);

    const paymentIntent = await prisma.paymentIntent.findFirstOrThrow({
      where: { checkout: { orders: { some: { id: orderId } } } },
    });
    const farmerPaymentLedgerEntry = await prisma.financialLedgerEntry.findFirst({
      where: {
        entryType: FinancialLedgerEntryType.FARMER_PAYMENT,
        paymentIntentId: paymentIntent.id,
      },
    });
    expect(farmerPaymentLedgerEntry?.amountPaise).toBe(118_000);

    const listResponse = await request(server)
      .get('/api/v1/finance/commission-entries')
      .query({ productOrderId: orderId })
      .set(seeded.financeManagerHeaders)
      .expect(200);
    expect(listResponse.body.data.items).toHaveLength(3);

    seeded.deliveredOrderId = orderId;
  });

  it('finalizes eligible commission entries once the return window has elapsed', async () => {
    const server = requireServer();
    const orderId = seeded.deliveredOrderId;

    await prisma.commissionEntry.updateMany({
      where: { productOrderId: orderId },
      data: { eligibleAt: new Date(Date.now() - 60_000) },
    });

    const finalizeResponse = await request(server)
      .post('/api/v1/finance/commission-entries/finalize-eligible')
      .set(seeded.financeManagerHeaders)
      .expect(201);
    expect(finalizeResponse.body.data.finalizedCount).toBeGreaterThanOrEqual(2);

    const entries = await prisma.commissionEntry.findMany({ where: { productOrderId: orderId } });
    expect(entries.every((entry) => entry.status === CommissionEntryStatus.FINAL)).toBe(true);
  });

  it('creates a settlement covering the finalized distributor payable entry', async () => {
    const server = requireServer();

    const createResponse = await request(server)
      .post('/api/v1/finance/settlements')
      .set(seeded.financeManagerHeaders)
      .send({ sellerOrganisationId: seeded.distributorOrganisationId })
      .expect(201);
    expect(createResponse.body.data.totalPayablePaise).toBe(112_100);
    expect(createResponse.body.data.entryCount).toBe(1);
    const settlementId = createResponse.body.data.id as string;

    const getResponse = await request(server)
      .get(`/api/v1/finance/settlements/${settlementId}`)
      .set(seeded.financeManagerHeaders)
      .expect(200);
    expect(getResponse.body.data.commissionEntries).toHaveLength(1);

    await request(server)
      .post('/api/v1/finance/settlements')
      .set(seeded.financeManagerHeaders)
      .send({ sellerOrganisationId: seeded.distributorOrganisationId })
      .expect(400);
  });

  it('reverses a commission entry pair, writes refund ledger entries, and blocks a second reversal', async () => {
    const server = requireServer();
    const orderId = await driveOrderToDelivered(server, 'reversal');

    const marketplaceEntry = await prisma.commissionEntry.findFirstOrThrow({
      where: { productOrderId: orderId, entryType: CommissionEntryType.MARKETPLACE_COMMISSION },
    });

    const reverseResponse = await request(server)
      .post(`/api/v1/finance/commission-entries/${marketplaceEntry.id}/reverse`)
      .set(seeded.financeManagerHeaders)
      .send({ reason: 'Order returned and inspected' })
      .expect(201);
    // Marketplace commission + distributor payable + the unconditional
    // delivery-fee entry all get reversed together -- reversal today
    // operates on every non-reversed entry for the order, not per-type.
    expect(reverseResponse.body.data.reversedEntries).toHaveLength(3);

    const entries = await prisma.commissionEntry.findMany({ where: { productOrderId: orderId } });
    expect(entries.every((entry) => entry.status === CommissionEntryStatus.REVERSED)).toBe(true);

    const refundLedgerEntries = await prisma.financialLedgerEntry.findMany({
      where: { productOrderId: orderId, entryType: FinancialLedgerEntryType.REFUND },
    });
    expect(refundLedgerEntries).toHaveLength(3);
    // <= 0, not < 0: the delivery fee's placeholder amount is 0 pending
    // business approval, and -0 is not strictly less than 0 in JS.
    expect(refundLedgerEntries.every((entry) => entry.amountPaise <= 0)).toBe(true);

    await request(server)
      .post(`/api/v1/finance/commission-entries/${marketplaceEntry.id}/reverse`)
      .set(seeded.financeManagerHeaders)
      .send({ reason: 'Attempting a second reversal' })
      .expect(400);
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
    keySuffix: string,
  ): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(seeded.farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId: seeded.farmerAddressId,
        quantity: 1,
        reason: `Selected Phase 5 item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase5-checkout-${keySuffix}-${randomUUID()}`)
      .send({
        farmerAddressId: seeded.farmerAddressId,
        reason: `Farmer confirmed Phase 5 cart for ${keySuffix}`,
      })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase5-intent-${keySuffix}-${randomUUID()}`)
      .send({ checkoutId, reason: `Farmer started mock payment for ${keySuffix}` })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase5-confirm-${keySuffix}-${randomUUID()}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);
    const orderId = confirmResponse.body.data.checkout.orders[0].id as string;

    for (const step of ['accept', 'ready-to-pack', 'pack'] as const) {
      await request(server)
        .post(`/api/v1/fulfilment/orders/${orderId}/${step}`)
        .set(seeded.distributorHeaders)
        .send({ reason: `Phase 5 ${step} for ${keySuffix}` })
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
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: `Collected for ${keySuffix}` })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ otpCode, proofNote: `Delivered for ${keySuffix}` })
      .expect(201);

    return orderId;
  }
});

async function seedPhase5Data(): Promise<{
  financeManagerHeaders: Headers;
  operationsHeaders: Headers;
  distributorHeaders: Headers;
  deliveryPartnerHeaders: Headers;
  farmerHeaders: Headers;
  farmerAddressId: string;
  deliveryPartnerUserId: string;
  distributorOrganisationId: string;
  offerId: string;
  deliveredOrderId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase5-admin-${suffix}`,
    legalName: 'Phase 5 Admin Organisation',
    displayName: 'Phase 5 Admin',
  });
  const financeManagerUser = await createUser(
    `phase5-finance-${suffix}@example.local`,
    'Phase 5 Finance Manager',
  );
  await createMembership(financeManagerUser.id, adminOrganisation.id, PlatformRole.FINANCE_MANAGER);

  const operationsUser = await createUser(`phase5-ops-${suffix}@example.local`, 'Phase 5 Ops');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `phase5-company-${suffix}`,
    legalName: 'Phase 5 Seeds Private Limited',
    displayName: 'Phase 5 Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 5 Seed Brand',
      slug: `phase5-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 5 Hybrid Bajra Seed ${suffix}`,
      slug: `phase5-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P5-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      mrpPaise: 125_000,
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `phase5-distributor-${suffix}`,
    legalName: 'Phase 5 Jaipur Distributor Private Limited',
    displayName: 'Phase 5 Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `phase5-distributor-${suffix}@example.local`,
    'Phase 5 Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );

  const deliveryOrganisation = await createOrganisation({
    type: OrganisationType.DELIVERY_PARTNER,
    slug: `phase5-delivery-${suffix}`,
    legalName: 'Phase 5 Last Mile Logistics',
    displayName: 'Phase 5 Last Mile',
  });
  const deliveryPartnerUser = await createUser(
    `phase5-delivery-${suffix}@example.local`,
    'Phase 5 Delivery Partner',
  );
  await createMembership(deliveryPartnerUser.id, deliveryOrganisation.id, PlatformRole.DELIVERY_PARTNER);

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase5-farmer-context-${suffix}`,
    legalName: 'Phase 5 Farmer Context',
    displayName: 'Phase 5 Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91005${short}`,
      profile: { create: { displayName: 'Phase 5 Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P5-JPR-${short}`,
      name: 'Phase 5 Jaipur Distributor Warehouse',
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
      batchNumber: `P5-BATCH-${short}`,
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
      reason: 'Opening stock for Phase 5 finance validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P5-OFFER-${short}`,
      sellingPricePaise: 118_000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Phase 5 Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: 'Phase 5 Farmer',
      phone: '+919999999998',
      addressLine1: 'Khasra 42, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
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
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      reason: 'Phase 5 spec global default commission rate',
    },
  });

  return {
    financeManagerHeaders: headersFor(
      financeManagerUser.id,
      PlatformRole.FINANCE_MANAGER,
      adminOrganisation.id,
    ),
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
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    farmerAddressId: farmerAddress.id,
    deliveryPartnerUserId: deliveryPartnerUser.id,
    distributorOrganisationId: distributorOrganisation.id,
    offerId: offer.id,
    deliveredOrderId: '',
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
