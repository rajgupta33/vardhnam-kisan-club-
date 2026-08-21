import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  MembershipStatus,
  NotificationChannel,
  NotificationStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  ProductCheckoutStatus,
  ProductOrderStatus,
  PromoterAttributionStatus,
  SupportTicketCategory,
  SupportTicketStatus,
  TallySyncRecordType,
  TallySyncStatus,
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

type Headers = Record<string, string>;
type DashboardItem = { code: string; label: string; scope: string; count: number };

describe('Dashboards', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedDashboardData>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedDashboardData();

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

  function findItem(items: DashboardItem[], code: string): DashboardItem | undefined {
    return items.find((item) => item.code === code);
  }

  it('requires authentication', async () => {
    await request(requireServer()).get('/api/v1/dashboards/summary').expect(401);
  });

  it('every role can read their own dashboard summary', async () => {
    const server = requireServer();
    for (const headers of [
      seeded.operationsHeaders,
      seeded.distributorAHeaders,
      seeded.promoterAHeaders,
      seeded.farmerHeaders,
    ]) {
      await request(server).get('/api/v1/dashboards/summary').set(headers).expect(200);
    }
  });

  it('shows platform-scoped items with correct counts for operations staff', async () => {
    const response = await request(requireServer())
      .get('/api/v1/dashboards/summary')
      .set(seeded.operationsHeaders)
      .expect(200);
    const items = response.body.data.items as DashboardItem[];

    expect(findItem(items, 'onboarding_pending')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'catalogue_pending_review')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'offers_pending_review')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'support_tickets_open_any')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'tally_sync_pending')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'notifications_failed')?.count).toBeGreaterThanOrEqual(1);
    expect(findItem(items, 'fulfilment_orders_pending_any')?.count).toBeGreaterThanOrEqual(1);

    expect(findItem(items, 'my_promoter_attributions_active')).toBeUndefined();
    expect(findItem(items, 'my_payout_account_action_needed')).toBeUndefined();
  });

  it('scopes offers_pending_review_own to the requesting distributor only', async () => {
    const server = requireServer();

    const responseA = await request(server)
      .get('/api/v1/dashboards/summary')
      .set(seeded.distributorAHeaders)
      .expect(200);
    const itemsA = responseA.body.data.items as DashboardItem[];
    expect(findItem(itemsA, 'offers_pending_review_own')?.count).toBe(1);
    expect(findItem(itemsA, 'fulfilment_orders_pending_own')?.count).toBe(1);
    expect(findItem(itemsA, 'offers_pending_review')).toBeUndefined();

    const responseB = await request(server)
      .get('/api/v1/dashboards/summary')
      .set(seeded.distributorBHeaders)
      .expect(200);
    const itemsB = responseB.body.data.items as DashboardItem[];
    expect(findItem(itemsB, 'offers_pending_review_own')?.count).toBe(0);
    expect(findItem(itemsB, 'fulfilment_orders_pending_own')?.count).toBe(0);
  });

  it('scopes self-owned items to the requesting promoter only', async () => {
    const server = requireServer();

    const responseA = await request(server)
      .get('/api/v1/dashboards/summary')
      .set(seeded.promoterAHeaders)
      .expect(200);
    const itemsA = responseA.body.data.items as DashboardItem[];
    expect(findItem(itemsA, 'my_promoter_attributions_active')?.count).toBe(1);
    expect(findItem(itemsA, 'my_unread_notifications')?.count).toBeGreaterThanOrEqual(1);

    const responseB = await request(server)
      .get('/api/v1/dashboards/summary')
      .set(seeded.promoterBHeaders)
      .expect(200);
    const itemsB = responseB.body.data.items as DashboardItem[];
    expect(findItem(itemsB, 'my_promoter_attributions_active')?.count).toBe(0);
    expect(findItem(itemsB, 'my_unread_notifications')?.count).toBe(0);
  });

  it('gates export behind DASHBOARDS_EXPORT and audits the export', async () => {
    const server = requireServer();

    await request(server)
      .get('/api/v1/dashboards/summary/export')
      .set(seeded.farmerHeaders)
      .expect(403);
    await request(server)
      .get('/api/v1/dashboards/summary/export')
      .set(seeded.distributorAHeaders)
      .expect(403);

    await request(server)
      .get('/api/v1/dashboards/summary/export')
      .set(seeded.operationsHeaders)
      .expect(200);

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'DASHBOARD_EXPORTED', actorUserId: seeded.operationsUserId },
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
  });
});

async function seedDashboardData(): Promise<{
  operationsHeaders: Headers;
  distributorAHeaders: Headers;
  distributorBHeaders: Headers;
  promoterAHeaders: Headers;
  promoterBHeaders: Headers;
  farmerHeaders: Headers;
  operationsUserId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `dash-admin-${suffix}`,
    legalName: 'Dashboards Admin Organisation',
    displayName: 'Dashboards Admin',
  });
  const operationsUser = await createUser(`dash-ops-${suffix}@example.local`, 'Dashboards Operations Manager');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  await prisma.organisation.create({
    data: {
      type: OrganisationType.COMPANY,
      slug: `dash-pending-org-${suffix}`,
      legalName: 'Dashboards Pending Verification Org',
      displayName: 'Dashboards Pending Verification Org',
      status: OrganisationStatus.PENDING_VERIFICATION,
    },
  });

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `dash-company-${suffix}`,
    legalName: 'Dashboards Seeds Private Limited',
    displayName: 'Dashboards Seeds',
  });
  await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Dashboards Seed Brand',
      slug: `dash-seed-brand-${suffix}`,
      status: CatalogueStatus.SUBMITTED,
    },
  });

  const distributorAOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `dash-distributor-a-${suffix}`,
    legalName: 'Dashboards Distributor A Private Limited',
    displayName: 'Dashboards Distributor A',
  });
  const distributorAUser = await createUser(`dash-dist-a-${suffix}@example.local`, 'Dashboards Distributor A Owner');
  await createMembership(distributorAUser.id, distributorAOrganisation.id, PlatformRole.DISTRIBUTOR_OWNER);

  const distributorBOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `dash-distributor-b-${suffix}`,
    legalName: 'Dashboards Distributor B Private Limited',
    displayName: 'Dashboards Distributor B',
  });
  const distributorBUser = await createUser(`dash-dist-b-${suffix}@example.local`, 'Dashboards Distributor B Owner');
  await createMembership(distributorBUser.id, distributorBOrganisation.id, PlatformRole.DISTRIBUTOR_OWNER);

  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: (await prisma.brand.findFirstOrThrow({
        where: { companyOrganisationId: companyOrganisation.id },
      })).id,
      name: `Dashboards Hybrid Bajra Seed ${suffix}`,
      slug: `dash-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `DASH-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: 1,
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125_000,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorAOrganisation.id,
      code: `DASH-WH-${short}`,
      name: 'Dashboards Distributor A Warehouse',
      addressLine1: 'Plot 1, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      distributorOrganisationId: distributorAOrganisation.id,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: variant.id,
      batchNumber: `DASH-BATCH-${short}`,
      expiryDate: futureDate(180),
    },
  });
  await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorAOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `DASH-OFFER-${short}`,
      sellingPricePaise: 118_000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.SUBMITTED,
    },
  });

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `dash-farmer-context-${suffix}`,
    legalName: 'Dashboards Farmer Context',
    displayName: 'Dashboards Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91005${short}`,
      profile: { create: { displayName: 'Dashboards Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);
  await prisma.supportTicket.create({
    data: {
      raisedByUserId: farmerUser.id,
      raisedByRole: PlatformRole.FARMER,
      category: SupportTicketCategory.OTHER,
      subject: 'Dashboards test ticket',
      description: 'Seeded for dashboards summary test',
      status: SupportTicketStatus.OPEN,
      slaDueAt: futureDate(2),
    },
  });

  await prisma.tallySyncRecord.create({
    data: {
      recordType: TallySyncRecordType.VOUCHER,
      referenceLabelSnapshot: 'Dashboards test voucher',
      payloadSnapshot: { note: 'seeded' },
      status: TallySyncStatus.PENDING,
    },
  });

  const promoterAOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `dash-promoter-a-context-${suffix}`,
    legalName: 'Dashboards Promoter A Context',
    displayName: 'Dashboards Promoter A Context',
  });
  const promoterAUser = await createUser(`dash-promoter-a-${suffix}@example.local`, 'Dashboards Promoter A');
  await createMembership(promoterAUser.id, promoterAOrganisation.id, PlatformRole.PROMOTER);

  const promoterBOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `dash-promoter-b-context-${suffix}`,
    legalName: 'Dashboards Promoter B Context',
    displayName: 'Dashboards Promoter B Context',
  });
  const promoterBUser = await createUser(`dash-promoter-b-${suffix}@example.local`, 'Dashboards Promoter B');
  await createMembership(promoterBUser.id, promoterBOrganisation.id, PlatformRole.PROMOTER);

  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Dashboards Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const checkout = await prisma.productCheckout.create({
    data: {
      farmerProfileId: farmerProfile.id,
      serviceablePincode: '302001',
      status: ProductCheckoutStatus.PAID,
      subtotalPaise: 118_000,
      farmerPayablePaise: 118_000,
      itemCount: 1,
      childOrderCount: 1,
    },
  });
  await prisma.productOrder.create({
    data: {
      checkoutId: checkout.id,
      farmerProfileId: farmerProfile.id,
      sellerOrganisationId: distributorAOrganisation.id,
      orderNumber: `PO-DASH-${short}`,
      status: ProductOrderStatus.CONFIRMED,
      serviceablePincode: '302001',
      sellerNameSnapshot: distributorAOrganisation.displayName,
      deliveryAddressSnapshot: {
        recipientName: 'Dashboards Farmer',
        pincode: '302001',
      },
      subtotalPaise: 118_000,
      farmerPayablePaise: 118_000,
      itemCount: 1,
    },
  });
  await prisma.promoterAttribution.create({
    data: {
      promoterUserId: promoterAUser.id,
      promoterOrganisationId: promoterAOrganisation.id,
      farmerProfileId: farmerProfile.id,
      status: PromoterAttributionStatus.ACTIVE,
    },
  });

  await prisma.notification.create({
    data: {
      recipientUserId: farmerUser.id,
      channel: NotificationChannel.SMS,
      category: 'DASHBOARDS_TEST_FAILED',
      title: 'Dashboards test notification',
      body: 'Seeded as a failed notification',
      status: NotificationStatus.FAILED,
    },
  });
  await prisma.notification.create({
    data: {
      recipientUserId: promoterAUser.id,
      channel: NotificationChannel.IN_APP,
      category: 'DASHBOARDS_TEST_UNREAD',
      title: 'Dashboards test unread notification',
      body: 'Seeded as unread',
      status: NotificationStatus.SENT,
    },
  });

  return {
    operationsHeaders: headersFor(operationsUser.id, PlatformRole.OPERATIONS_MANAGER, adminOrganisation.id),
    distributorAHeaders: headersFor(
      distributorAUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      distributorAOrganisation.id,
    ),
    distributorBHeaders: headersFor(
      distributorBUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      distributorBOrganisation.id,
    ),
    promoterAHeaders: headersFor(promoterAUser.id, PlatformRole.PROMOTER, promoterAOrganisation.id),
    promoterBHeaders: headersFor(promoterBUser.id, PlatformRole.PROMOTER, promoterBOrganisation.id),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    operationsUserId: operationsUser.id,
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
}) {
  return prisma.organisation.create({
    data: {
      type: input.type,
      slug: input.slug,
      legalName: input.legalName,
      displayName: input.displayName,
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

function futureDate(daysFromToday: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
}
