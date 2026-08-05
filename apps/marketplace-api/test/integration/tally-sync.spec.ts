import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CommissionEntryStatus,
  CommissionEntryType,
  FinancialLedgerEntryType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductCheckoutStatus,
  ProductOrderStatus,
  SettlementStatus,
  TallySyncRecordType,
  TallySyncStatus,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

describe('Tally sync abstraction', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedTallySyncData>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedTallySyncData();

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

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  it('enqueues a PARTY_MASTER sync record from a real organisation', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.PARTY_MASTER, organisationId: seeded.distributorOrganisationId })
      .expect(201);
    expect(response.body.data.status).toBe(TallySyncStatus.PENDING);
    expect(response.body.data.referenceLabelSnapshot).toBe(seeded.distributorLegalName);
  });

  it('enqueues an ITEM_MASTER sync record from a real product variant', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.ITEM_MASTER, productVariantId: seeded.productVariantId })
      .expect(201);
    expect(response.body.data.recordType).toBe(TallySyncRecordType.ITEM_MASTER);
  });

  it('enqueues an INVOICE sync record from a real product invoice', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.INVOICE, productInvoiceId: seeded.productInvoiceId })
      .expect(201);
    expect(response.body.data.amountPaise).toBe(seeded.productInvoiceTotalPaise);
  });

  it('enqueues a SETTLEMENT sync record from a real settlement', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.SETTLEMENT, settlementId: seeded.settlementId })
      .expect(201);
    expect(response.body.data.referenceNumberSnapshot).toBe(seeded.settlementNumber);
  });

  it('enqueues a COMMISSION_INVOICE sync record from a FINAL commission entry', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.COMMISSION_INVOICE,
        commissionEntryId: seeded.finalCommissionEntryId,
      })
      .expect(201);
    expect(response.body.data.amountPaise).toBe(seeded.finalCommissionEntryAmountPaise);
  });

  it('rejects a COMMISSION_INVOICE sync record from a non-FINAL commission entry', async () => {
    await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.COMMISSION_INVOICE,
        commissionEntryId: seeded.provisionalCommissionEntryId,
      })
      .expect(400);
  });

  it('enqueues a CREDIT_NOTE sync record from a REFUND ledger entry', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.CREDIT_NOTE,
        financialLedgerEntryId: seeded.refundLedgerEntryId,
      })
      .expect(201);
    expect(response.body.data.recordType).toBe(TallySyncRecordType.CREDIT_NOTE);
  });

  it('rejects a CREDIT_NOTE sync record from a non-REFUND ledger entry', async () => {
    await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.CREDIT_NOTE,
        financialLedgerEntryId: seeded.farmerPaymentLedgerEntryId,
      })
      .expect(400);
  });

  it('enqueues a RECEIPT sync record from a FARMER_PAYMENT ledger entry', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.RECEIPT,
        financialLedgerEntryId: seeded.farmerPaymentLedgerEntryId,
      })
      .expect(201);
    expect(response.body.data.recordType).toBe(TallySyncRecordType.RECEIPT);
  });

  it('enqueues a free-form VOUCHER sync record', async () => {
    const response = await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.VOUCHER,
        referenceLabel: 'Opening balance adjustment',
        payload: { note: 'Manual opening balance voucher' },
      })
      .expect(201);
    expect(response.body.data.sourceEntityId).toBeNull();
  });

  it('rejects an enqueue request missing the required field for its recordType', async () => {
    await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.PARTY_MASTER })
      .expect(400);
  });

  it('404s when the referenced source entity does not exist', async () => {
    await request(requireServer())
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.PARTY_MASTER, organisationId: randomUUID() })
      .expect(404);
  });

  it('runs the attempt/retry lifecycle and rejects attempting an already-synced record', async () => {
    const server = requireServer();
    const enqueueResponse = await request(server)
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({
        recordType: TallySyncRecordType.VOUCHER,
        referenceLabel: 'Lifecycle test voucher',
        payload: { note: 'lifecycle' },
      })
      .expect(201);
    const recordId = enqueueResponse.body.data.id as string;

    const failedResponse = await request(server)
      .post(`/api/v1/tally/sync-records/${recordId}/attempt`)
      .set(seeded.financeManagerHeaders)
      .send({ outcome: 'FAILED', errorCode: 'MOCK_DOWN', errorMessage: 'Mock Tally unreachable' })
      .expect(201);
    expect(failedResponse.body.data.status).toBe(TallySyncStatus.FAILED);
    expect(failedResponse.body.data.attemptCount).toBe(1);
    expect(failedResponse.body.data.lastErrorCode).toBe('MOCK_DOWN');

    const syncedResponse = await request(server)
      .post(`/api/v1/tally/sync-records/${recordId}/attempt`)
      .set(seeded.financeManagerHeaders)
      .send({ outcome: 'SYNCED' })
      .expect(201);
    expect(syncedResponse.body.data.status).toBe(TallySyncStatus.SYNCED);
    expect(syncedResponse.body.data.attemptCount).toBe(2);
    expect(syncedResponse.body.data.tallyReferenceId).toBeTruthy();

    await request(server)
      .post(`/api/v1/tally/sync-records/${recordId}/attempt`)
      .set(seeded.financeManagerHeaders)
      .send({ outcome: 'SYNCED' })
      .expect(409);

    const detailResponse = await request(server)
      .get(`/api/v1/tally/sync-records/${recordId}`)
      .set(seeded.financeManagerHeaders)
      .expect(200);
    expect(detailResponse.body.data.attempts).toHaveLength(2);
  });

  it('returns a reconciliation summary grouped by record type and status', async () => {
    const response = await request(requireServer())
      .get('/api/v1/tally/reconciliation')
      .set(seeded.financeManagerHeaders)
      .expect(200);
    const groups = response.body.data as Array<{ recordType: string; status: string; count: number }>;
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((group) => group.status === TallySyncStatus.SYNCED && group.count > 0)).toBe(true);
  });

  it('enforces permissions across roles', async () => {
    const server = requireServer();

    await request(server).get('/api/v1/tally/sync-records').expect(401);

    await request(server)
      .get('/api/v1/tally/sync-records')
      .set(seeded.farmerHeaders)
      .expect(403);
    await request(server)
      .post('/api/v1/tally/sync-records')
      .set(seeded.farmerHeaders)
      .send({ recordType: TallySyncRecordType.VOUCHER, referenceLabel: 'x', payload: {} })
      .expect(403);
    await request(server)
      .get('/api/v1/tally/reconciliation')
      .set(seeded.distributorHeaders)
      .expect(403);

    await request(server)
      .get('/api/v1/tally/sync-records')
      .set(seeded.operationsHeaders)
      .expect(200);
    await request(server)
      .get('/api/v1/tally/reconciliation')
      .set(seeded.operationsHeaders)
      .expect(200);
    await request(server)
      .post('/api/v1/tally/sync-records')
      .set(seeded.operationsHeaders)
      .send({ recordType: TallySyncRecordType.VOUCHER, referenceLabel: 'x', payload: {} })
      .expect(403);

    await request(server)
      .post('/api/v1/tally/sync-records')
      .set(seeded.financeManagerHeaders)
      .send({ recordType: TallySyncRecordType.VOUCHER, referenceLabel: 'Permission check voucher', payload: {} })
      .expect(201);
  });
});

async function seedTallySyncData(): Promise<{
  financeManagerHeaders: Headers;
  operationsHeaders: Headers;
  farmerHeaders: Headers;
  distributorHeaders: Headers;
  distributorOrganisationId: string;
  distributorLegalName: string;
  productVariantId: string;
  productInvoiceId: string;
  productInvoiceTotalPaise: number;
  settlementId: string;
  settlementNumber: string;
  finalCommissionEntryId: string;
  finalCommissionEntryAmountPaise: number;
  provisionalCommissionEntryId: string;
  refundLedgerEntryId: string;
  farmerPaymentLedgerEntryId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `tally-admin-${suffix}`,
    legalName: 'Tally Sync Admin Organisation',
    displayName: 'Tally Sync Admin',
  });
  const financeManagerUser = await createUser(`tally-finance-${suffix}@example.local`, 'Tally Finance Manager');
  await createMembership(financeManagerUser.id, adminOrganisation.id, PlatformRole.FINANCE_MANAGER);
  const operationsUser = await createUser(`tally-ops-${suffix}@example.local`, 'Tally Operations Manager');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `tally-distributor-${suffix}`,
    legalName: 'Tally Sync Jaipur Distributor Private Limited',
    displayName: 'Tally Sync Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `tally-distributor-${suffix}@example.local`,
    'Tally Sync Distributor Owner',
  );
  await createMembership(distributorUser.id, distributorOrganisation.id, PlatformRole.DISTRIBUTOR_OWNER);

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `tally-farmer-context-${suffix}`,
    legalName: 'Tally Sync Farmer Context',
    displayName: 'Tally Sync Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91008${short}`,
      profile: { create: { displayName: 'Tally Sync Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);
  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Tally Sync Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: 'Tally Sync Farmer',
      phone: '+919999999993',
      addressLine1: 'Khasra 12, Station Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      isDefault: true,
    },
  });

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `tally-company-${suffix}`,
    legalName: 'Tally Sync Seeds Private Limited',
    displayName: 'Tally Sync Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Tally Sync Seed Brand',
      slug: `tally-seed-brand-${suffix}`,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Tally Sync Hybrid Bajra Seed ${suffix}`,
      slug: `tally-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
    },
  });
  const productVariant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `TLY-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      mrpPaise: 125_000,
    },
  });

  const checkout = await prisma.productCheckout.create({
    data: {
      farmerProfileId: farmerProfile.id,
      deliveryAddressId: farmerAddress.id,
      serviceablePincode: '302001',
      status: ProductCheckoutStatus.PAID,
      subtotalPaise: 118_000,
      itemCount: 1,
      childOrderCount: 1,
    },
  });
  const order = await prisma.productOrder.create({
    data: {
      checkoutId: checkout.id,
      farmerProfileId: farmerProfile.id,
      deliveryAddressId: farmerAddress.id,
      sellerOrganisationId: distributorOrganisation.id,
      orderNumber: `TLY-ORD-${short}`,
      status: ProductOrderStatus.DELIVERED,
      serviceablePincode: '302001',
      sellerNameSnapshot: distributorOrganisation.legalName,
      sellerGstinSnapshot: distributorOrganisation.gstin,
      deliveryAddressSnapshot: { city: 'Jaipur', pincode: '302001' },
      subtotalPaise: 118_000,
      itemCount: 1,
    },
  });
  const productInvoiceTotalPaise = 118_000;
  const invoice = await prisma.productInvoice.create({
    data: {
      productOrderId: order.id,
      checkoutId: checkout.id,
      farmerProfileId: farmerProfile.id,
      sellerOrganisationId: distributorOrganisation.id,
      invoiceNumber: `TLY-INV-${short}`,
      subtotalPaise: productInvoiceTotalPaise,
      totalPaise: productInvoiceTotalPaise,
      itemCount: 1,
      sellerLegalNameSnapshot: distributorOrganisation.legalName,
      sellerDisplayNameSnapshot: distributorOrganisation.displayName,
      sellerGstinSnapshot: distributorOrganisation.gstin,
      farmerNameSnapshot: 'Tally Sync Farmer',
      deliveryAddressSnapshot: { city: 'Jaipur', pincode: '302001' },
      lineItemsSnapshot: [{ variantId: productVariant.id, quantity: 1, pricePaise: productInvoiceTotalPaise }],
    },
  });

  const commissionRule = await prisma.commissionRule.create({
    data: {
      sellerOrganisationId: distributorOrganisation.id,
      marketplaceCommissionBps: 500,
      effectiveFrom: new Date(),
    },
  });
  const finalCommissionEntryAmountPaise = 5_900;
  const finalCommissionEntry = await prisma.commissionEntry.create({
    data: {
      productOrderId: order.id,
      sellerOrganisationId: distributorOrganisation.id,
      commissionRuleId: commissionRule.id,
      entryType: CommissionEntryType.MARKETPLACE_COMMISSION,
      amountPaise: finalCommissionEntryAmountPaise,
      status: CommissionEntryStatus.FINAL,
      eligibleAt: new Date(),
      finalizedAt: new Date(),
    },
  });
  const provisionalCommissionEntry = await prisma.commissionEntry.create({
    data: {
      productOrderId: order.id,
      sellerOrganisationId: distributorOrganisation.id,
      commissionRuleId: commissionRule.id,
      entryType: CommissionEntryType.DISTRIBUTOR_PAYABLE,
      amountPaise: 112_100,
      status: CommissionEntryStatus.PROVISIONAL,
      eligibleAt: new Date(),
    },
  });

  const settlement = await prisma.settlement.create({
    data: {
      sellerOrganisationId: distributorOrganisation.id,
      settlementNumber: `TLY-STL-${short}`,
      totalPayablePaise: 112_100,
      entryCount: 1,
      status: SettlementStatus.ELIGIBLE,
    },
  });

  const refundLedgerEntry = await prisma.financialLedgerEntry.create({
    data: {
      entryType: FinancialLedgerEntryType.REFUND,
      amountPaise: -5_000,
      organisationId: distributorOrganisation.id,
      productOrderId: order.id,
      reason: 'Farmer-cancelled item refund',
    },
  });
  const farmerPaymentLedgerEntry = await prisma.financialLedgerEntry.create({
    data: {
      entryType: FinancialLedgerEntryType.FARMER_PAYMENT,
      amountPaise: productInvoiceTotalPaise,
      productOrderId: order.id,
      reason: 'Farmer mock payment received',
    },
  });

  return {
    financeManagerHeaders: headersFor(financeManagerUser.id, PlatformRole.FINANCE_MANAGER, adminOrganisation.id),
    operationsHeaders: headersFor(operationsUser.id, PlatformRole.OPERATIONS_MANAGER, adminOrganisation.id),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    distributorHeaders: headersFor(distributorUser.id, PlatformRole.DISTRIBUTOR_OWNER, distributorOrganisation.id),
    distributorOrganisationId: distributorOrganisation.id,
    distributorLegalName: distributorOrganisation.legalName,
    productVariantId: productVariant.id,
    productInvoiceId: invoice.id,
    productInvoiceTotalPaise,
    settlementId: settlement.id,
    settlementNumber: settlement.settlementNumber,
    finalCommissionEntryId: finalCommissionEntry.id,
    finalCommissionEntryAmountPaise,
    provisionalCommissionEntryId: provisionalCommissionEntry.id,
    refundLedgerEntryId: refundLedgerEntry.id,
    farmerPaymentLedgerEntryId: farmerPaymentLedgerEntry.id,
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

async function createMembership(userId: string, organisationId: string, role: PlatformRole): Promise<void> {
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
