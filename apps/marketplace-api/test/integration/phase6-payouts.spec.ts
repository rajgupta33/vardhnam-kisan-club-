import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  CommissionEntryType,
  CommissionRuleStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PayoutAccountStatus,
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

describe('Phase 6 payout accounts and statements', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedPhase6PayoutsData>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedPhase6PayoutsData();

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

  it('rejects writing a payout account without the permission', async () => {
    const server = requireServer();

    await request(server).put('/api/v1/payouts/accounts/me').expect(401);

    await request(server)
      .put('/api/v1/payouts/accounts/me')
      .set(seeded.farmerHeaders)
      .send({
        accountHolderName: 'Should Be Rejected',
        bankName: 'State Bank of India',
        accountNumber: '000123456789',
        ifscCode: 'SBIN0001234',
      })
      .expect(403);
  });

  it('upserts and masks the own payout account, resetting to pending on re-submission', async () => {
    const server = requireServer();

    const createResponse = await request(server)
      .put('/api/v1/payouts/accounts/me')
      .set(seeded.deliveryPartnerHeaders)
      .send({
        accountHolderName: 'Phase 6 Delivery Partner',
        bankName: 'State Bank of India',
        accountNumber: '000123456789',
        ifscCode: 'SBIN0001234',
      })
      .expect(200);
    expect(createResponse.body.data.status).toBe(PayoutAccountStatus.PENDING_VERIFICATION);
    expect(createResponse.body.data.accountNumber).toBe('********6789');

    const getResponse = await request(server)
      .get('/api/v1/payouts/accounts/me')
      .set(seeded.deliveryPartnerHeaders)
      .expect(200);
    expect(getResponse.body.data.accountNumber).toBe('********6789');

    const accountId = createResponse.body.data.id as string;
    await request(server)
      .post(`/api/v1/payouts/accounts/${accountId}/verify`)
      .set(seeded.operationsHeaders)
      .send({ status: PayoutAccountStatus.VERIFIED })
      .expect(201);

    const resubmitResponse = await request(server)
      .put('/api/v1/payouts/accounts/me')
      .set(seeded.deliveryPartnerHeaders)
      .send({
        accountHolderName: 'Phase 6 Delivery Partner',
        bankName: 'HDFC Bank',
        accountNumber: '000987654321',
        ifscCode: 'HDFC0001234',
      })
      .expect(200);
    expect(resubmitResponse.body.data.status).toBe(PayoutAccountStatus.PENDING_VERIFICATION);
  });

  it('lets ops reject a payout account with a reason and blocks re-review', async () => {
    const server = requireServer();

    const createResponse = await request(server)
      .put('/api/v1/payouts/accounts/me')
      .set(seeded.otherPromoterHeaders)
      .send({
        accountHolderName: 'Phase 6 Promoter',
        bankName: 'ICICI Bank',
        accountNumber: '111222333',
        ifscCode: 'ICIC0001234',
      })
      .expect(200);
    const accountId = createResponse.body.data.id as string;

    const rejectResponse = await request(server)
      .post(`/api/v1/payouts/accounts/${accountId}/verify`)
      .set(seeded.operationsHeaders)
      .send({ status: PayoutAccountStatus.REJECTED, reason: 'Account holder name mismatch' })
      .expect(201);
    expect(rejectResponse.body.data.status).toBe(PayoutAccountStatus.REJECTED);
    expect(rejectResponse.body.data.rejectionReason).toBe('Account holder name mismatch');

    await request(server)
      .post(`/api/v1/payouts/accounts/${accountId}/verify`)
      .set(seeded.operationsHeaders)
      .send({ status: PayoutAccountStatus.VERIFIED })
      .expect(400);
  });

  it('scopes payout statements to the requesting recipient only', async () => {
    const server = requireServer();
    const orderId = await driveOrderToDelivered(server);

    const deliveryPartnerStatement = await request(server)
      .get('/api/v1/payouts/statements/me')
      .set(seeded.deliveryPartnerHeaders)
      .expect(200);
    const deliveryPartnerItems = deliveryPartnerStatement.body.data.items as Array<{
      productOrderId: string;
      entryType: string;
    }>;
    expect(
      deliveryPartnerItems.some(
        (item) => item.productOrderId === orderId && item.entryType === CommissionEntryType.DELIVERY_FEE,
      ),
    ).toBe(true);
    expect(
      deliveryPartnerItems.some(
        (item) => item.entryType === CommissionEntryType.PROMOTER_COMMISSION,
      ),
    ).toBe(false);

    const promoterStatement = await request(server)
      .get('/api/v1/payouts/statements/me')
      .set(seeded.promoterHeaders)
      .expect(200);
    const promoterItems = promoterStatement.body.data.items as Array<{
      productOrderId: string;
      entryType: string;
    }>;
    expect(
      promoterItems.some(
        (item) =>
          item.productOrderId === orderId && item.entryType === CommissionEntryType.PROMOTER_COMMISSION,
      ),
    ).toBe(true);
    expect(promoterItems.some((item) => item.entryType === CommissionEntryType.DELIVERY_FEE)).toBe(
      false,
    );
  });

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  async function driveOrderToDelivered(server: Parameters<typeof request>[0]): Promise<string> {
    const keySuffix = 'payouts';
    await request(server)
      .post('/api/v1/cart/items')
      .set(seeded.farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId: seeded.farmerAddressId,
        quantity: 1,
        reason: `Selected Phase 6 item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase6payouts-checkout-${randomUUID()}`)
      .send({
        farmerAddressId: seeded.farmerAddressId,
        reason: `Farmer confirmed Phase 6 cart for ${keySuffix}`,
      })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase6payouts-intent-${randomUUID()}`)
      .send({ checkoutId, reason: `Farmer started mock payment for ${keySuffix}` })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase6payouts-confirm-${randomUUID()}`)
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

async function seedPhase6PayoutsData(): Promise<{
  operationsHeaders: Headers;
  distributorHeaders: Headers;
  deliveryPartnerHeaders: Headers;
  farmerHeaders: Headers;
  promoterHeaders: Headers;
  otherPromoterHeaders: Headers;
  deliveryPartnerUserId: string;
  farmerAddressId: string;
  offerId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6payouts-admin-${suffix}`,
    legalName: 'Phase 6 Payouts Admin Organisation',
    displayName: 'Phase 6 Payouts Admin',
  });
  const operationsUser = await createUser(
    `phase6payouts-ops-${suffix}@example.local`,
    'Phase 6 Payouts Ops',
  );
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `phase6payouts-company-${suffix}`,
    legalName: 'Phase 6 Payouts Seeds Private Limited',
    displayName: 'Phase 6 Payouts Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 6 Payouts Seed Brand',
      slug: `phase6payouts-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 6 Payouts Hybrid Bajra Seed ${suffix}`,
      slug: `phase6payouts-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P6PO-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      mrpPaise: 125_000,
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `phase6payouts-distributor-${suffix}`,
    legalName: 'Phase 6 Payouts Jaipur Distributor Private Limited',
    displayName: 'Phase 6 Payouts Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `phase6payouts-distributor-${suffix}@example.local`,
    'Phase 6 Payouts Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );

  const deliveryOrganisation = await createOrganisation({
    type: OrganisationType.DELIVERY_PARTNER,
    slug: `phase6payouts-delivery-${suffix}`,
    legalName: 'Phase 6 Payouts Last Mile Logistics',
    displayName: 'Phase 6 Payouts Last Mile',
  });
  const deliveryPartnerUser = await createUser(
    `phase6payouts-delivery-${suffix}@example.local`,
    'Phase 6 Payouts Delivery Partner',
  );
  await createMembership(deliveryPartnerUser.id, deliveryOrganisation.id, PlatformRole.DELIVERY_PARTNER);

  const promoterOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6payouts-promoter-org-${suffix}`,
    legalName: 'Phase 6 Payouts Promoter Network',
    displayName: 'Phase 6 Payouts Promoter Network',
  });
  const promoterUser = await createUser(
    `phase6payouts-promoter-${suffix}@example.local`,
    'Phase 6 Payouts Promoter',
  );
  await createMembership(promoterUser.id, promoterOrganisation.id, PlatformRole.PROMOTER);
  const otherPromoterUser = await createUser(
    `phase6payouts-other-promoter-${suffix}@example.local`,
    'Phase 6 Payouts Other Promoter',
  );
  await createMembership(otherPromoterUser.id, promoterOrganisation.id, PlatformRole.PROMOTER);

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase6payouts-farmer-context-${suffix}`,
    legalName: 'Phase 6 Payouts Farmer Context',
    displayName: 'Phase 6 Payouts Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91008${short}`,
      profile: { create: { displayName: 'Phase 6 Payouts Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);
  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Phase 6 Payouts Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: 'Phase 6 Payouts Farmer',
      phone: '+919999999995',
      addressLine1: 'Khasra 44, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      isDefault: true,
    },
  });

  await prisma.promoterAttribution.create({
    data: {
      promoterUserId: promoterUser.id,
      promoterOrganisationId: promoterOrganisation.id,
      farmerProfileId: farmerProfile.id,
      reason: 'Phase 6 payouts spec attribution',
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P6PO-JPR-${short}`,
      name: 'Phase 6 Payouts Jaipur Distributor Warehouse',
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
      batchNumber: `P6PO-BATCH-${short}`,
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
      reason: 'Opening stock for Phase 6 payouts validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P6PO-OFFER-${short}`,
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
      sellerOrganisationId: null,
      marketplaceCommissionBps: 500,
      promoterCommissionBps: 0,
      deliveryFeePaise: 0,
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      reason: 'Phase 6 payouts spec global default commission rate',
    },
  });

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
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    promoterHeaders: headersFor(promoterUser.id, PlatformRole.PROMOTER, promoterOrganisation.id),
    otherPromoterHeaders: headersFor(
      otherPromoterUser.id,
      PlatformRole.PROMOTER,
      promoterOrganisation.id,
    ),
    deliveryPartnerUserId: deliveryPartnerUser.id,
    farmerAddressId: farmerAddress.id,
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
