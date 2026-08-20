import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
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

const prisma = new PrismaClient();

describe('Phase 2E offer operations and inventory ageing', () => {
  let app: INestApplication | undefined;
  let distributorHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let productId: string;
  let offerId: string;
  let distributorOrganisationId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    const seeded = await seedOperationsData();
    distributorHeaders = seeded.distributorHeaders;
    adminHeaders = seeded.adminHeaders;
    productId = seeded.productId;
    offerId = seeded.offerId;
    distributorOrganisationId = seeded.distributorOrganisationId;

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

  it('pauses, reactivates and archives approved offers with discovery and audit effects', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const initialDiscovery = await request(server)
      .get('/api/v1/marketplace/products')
      .query({ pincode: '302001' })
      .expect(200);
    expect(initialDiscovery.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );

    const pauseResponse = await request(server)
      .post(`/api/v1/offers/${offerId}/pause`)
      .set(distributorHeaders)
      .send({ reason: 'Temporary pause for stock reconciliation' })
      .expect(201);
    expect(pauseResponse.body.data.status).toBe(DistributorOfferStatus.PAUSED);

    const pausedDiscovery = await request(server)
      .get('/api/v1/marketplace/products')
      .query({ pincode: '302001' })
      .expect(200);
    // Other suites and the demo seed also place active offers at this pincode,
    // so assert this product specifically dropped out rather than the full list.
    expect(pausedDiscovery.body.data.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );

    const reactivateResponse = await request(server)
      .post(`/api/v1/offers/${offerId}/reactivate`)
      .set(distributorHeaders)
      .send({ reason: 'Stock reconciliation completed' })
      .expect(201);
    expect(reactivateResponse.body.data.status).toBe(DistributorOfferStatus.APPROVED);

    const lowStockResponse = await request(server)
      .get('/api/v1/inventory/reports/low-stock')
      .query({ lowStockThreshold: 5 })
      .set(distributorHeaders)
      .expect(200);
    expect(lowStockResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sellableQuantity: 4,
          isLowStock: true,
          ageingBucket: 'LOW_STOCK',
        }),
      ]),
    );

    const expiringResponse = await request(server)
      .get('/api/v1/inventory/reports/expiring-batches')
      .query({ expiringWithinDays: 10 })
      .set(distributorHeaders)
      .expect(200);
    expect(expiringResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isExpiringSoon: true,
          ageingBucket: expect.stringMatching(/LOW_STOCK|EXPIRING_SOON/),
        }),
      ]),
    );

    const archiveResponse = await request(server)
      .post(`/api/v1/offers/${offerId}/archive`)
      .set(distributorHeaders)
      .send({ reason: 'Campaign offer retired' })
      .expect(201);
    expect(archiveResponse.body.data.status).toBe(DistributorOfferStatus.ARCHIVED);

    const archivedDiscovery = await request(server)
      .get('/api/v1/marketplace/products')
      .query({ pincode: '302001' })
      .expect(200);
    expect(archivedDiscovery.body.data.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: productId })]),
    );

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ organisationId: distributorOrganisationId, limit: 50 })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_PAUSED' }),
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_REACTIVATED' }),
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_ARCHIVED' }),
      ]),
    );
  });
});

async function seedOperationsData(): Promise<{
  distributorHeaders: Record<string, string>;
  adminHeaders: Record<string, string>;
  productId: string;
  offerId: string;
  distributorOrganisationId: string;
}> {
  const suffix = randomUUID();
  const adminOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `phase2e-admin-${suffix}`,
      legalName: 'Phase 2E Admin Organisation',
      displayName: 'Phase 2E Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `phase2e-admin-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 2E Admin',
        },
      },
    },
  });
  await prisma.organisationMembership.create({
    data: {
      userId: adminUser.id,
      organisationId: adminOrganisation.id,
      role: PlatformRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });

  const companyOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.COMPANY,
      slug: `phase2e-company-${suffix}`,
      legalName: 'Phase 2E Seeds Private Limited',
      displayName: 'Phase 2E Seeds',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase2e-distributor-${suffix}`,
      legalName: 'Phase 2E Distributor Private Limited',
      displayName: 'Phase 2E Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const distributorUser = await prisma.user.create({
    data: {
      email: `phase2e-distributor-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 2E Distributor',
        },
      },
    },
  });
  await prisma.organisationMembership.create({
    data: {
      userId: distributorUser.id,
      organisationId: distributorOrganisation.id,
      role: PlatformRole.DISTRIBUTOR_OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 2E Seed Brand',
      slug: `phase2e-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 2E Hybrid Bajra Seed ${suffix}`,
      slug: `phase2e-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P2E-1KG-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125000,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P2E-JPR-${suffix.slice(0, 8)}`,
      name: 'Phase 2E Jaipur Warehouse',
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
      batchNumber: `P2E-BATCH-${suffix.slice(0, 8)}`,
      expiryDate: futureDate(7),
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
      quantityDelta: 4,
      balanceAfter: 4,
      reason: 'Opening stock for Phase 2E operations',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P2E-OFFER-${suffix.slice(0, 8)}`,
      sellingPricePaise: 118000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 20,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return {
    productId: product.id,
    offerId: offer.id,
    distributorOrganisationId: distributorOrganisation.id,
    adminHeaders: {
      'x-user-id': adminUser.id,
      'x-user-role': PlatformRole.SUPER_ADMIN,
      'x-organisation-id': adminOrganisation.id,
    },
    distributorHeaders: {
      'x-user-id': distributorUser.id,
      'x-user-role': PlatformRole.DISTRIBUTOR_OWNER,
      'x-organisation-id': distributorOrganisation.id,
    },
  };
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
