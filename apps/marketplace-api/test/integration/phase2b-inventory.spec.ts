import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

describe('Phase 2B inventory foundation workflow', () => {
  let app: INestApplication | undefined;
  let adminHeaders: Record<string, string>;
  let distributorHeaders: Record<string, string>;
  let secondDistributorHeaders: Record<string, string>;
  let companyHeaders: Record<string, string>;
  let variantId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();

    const suffix = randomUUID();
    const adminOrganisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `phase2b-admin-${suffix}`,
        legalName: 'Phase 2B Admin Organisation',
        displayName: 'Phase 2B Admin',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: `phase2b-admin-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2B Admin',
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
    adminHeaders = {
      'x-user-id': adminUser.id,
      'x-user-role': PlatformRole.SUPER_ADMIN,
      'x-organisation-id': adminOrganisation.id,
    };

    const companyOrganisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.COMPANY,
        slug: `phase2b-company-${suffix}`,
        legalName: 'Phase 2B Seeds Private Limited',
        displayName: 'Phase 2B Seeds',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const companyUser = await prisma.user.create({
      data: {
        email: `phase2b-company-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2B Company',
          },
        },
      },
    });
    await prisma.organisationMembership.create({
      data: {
        userId: companyUser.id,
        organisationId: companyOrganisation.id,
        role: PlatformRole.COMPANY_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    companyHeaders = {
      'x-user-id': companyUser.id,
      'x-user-role': PlatformRole.COMPANY_OWNER,
      'x-organisation-id': companyOrganisation.id,
    };

    const brand = await prisma.brand.create({
      data: {
        companyOrganisationId: companyOrganisation.id,
        name: 'Phase 2B Seed Brand',
        slug: `phase2b-seed-brand-${suffix}`,
        status: CatalogueStatus.APPROVED,
      },
    });
    const product = await prisma.masterProduct.create({
      data: {
        companyOrganisationId: companyOrganisation.id,
        brandId: brand.id,
        name: 'Phase 2B Hybrid Bajra Seed',
        slug: `phase2b-hybrid-bajra-seed-${suffix}`,
        category: 'Seeds',
        cropTargets: ['Bajra'],
        status: CatalogueStatus.APPROVED,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `P2B-1KG-${suffix.slice(0, 8)}`,
        variantName: '1 kg pack',
        packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      },
    });
    variantId = variant.id;

    const distributorOrganisation = await createDistributorWithUser(
      suffix,
      'primary',
      PlatformRole.DISTRIBUTOR_OWNER,
    );
    distributorHeaders = distributorOrganisation.headers;

    const secondDistributorOrganisation = await createDistributorWithUser(
      suffix,
      'second',
      PlatformRole.DISTRIBUTOR_OWNER,
    );
    secondDistributorHeaders = secondDistributorOrganisation.headers;

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

  it('creates distributor warehouse, batch stock and append-only movements with resource isolation', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    await request(server)
      .post('/api/v1/inventory/warehouses')
      .set(companyHeaders)
      .send({
        code: 'CMP-01',
        name: 'Company Cannot Manage Warehouse',
        addressLine1: 'Company office',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      })
      .expect(403);

    const warehouseResponse = await request(server)
      .post('/api/v1/inventory/warehouses')
      .set(distributorHeaders)
      .send({
        code: 'JPR-01',
        name: 'Jaipur Main Warehouse',
        addressLine1: 'Plot 12, Agri Market Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        reason: 'Initial warehouse setup',
      })
      .expect(201);
    const warehouseId = warehouseResponse.body.data.id as string;

    await request(server)
      .get(`/api/v1/inventory/warehouses/${warehouseId}`)
      .set(secondDistributorHeaders)
      .expect(403);

    const batchResponse = await request(server)
      .post('/api/v1/inventory/batches')
      .set(distributorHeaders)
      .send({
        warehouseId,
        variantId,
        batchNumber: 'BATCH-2026-08',
        expiryDate: '2027-08-02T00:00:00.000Z',
        germinationPercentage: 92.5,
        openingQuantity: 50,
        reason: 'Opening stock count verified',
      })
      .expect(201);
    const batchId = batchResponse.body.data.id as string;
    expect(batchResponse.body.data.onHandQuantity).toBe(50);
    expect(batchResponse.body.data.sellableQuantity).toBe(50);

    const movementResponse = await request(server)
      .post(`/api/v1/inventory/batches/${batchId}/adjustments`)
      .set(distributorHeaders)
      .send({
        movementType: InventoryMovementType.MANUAL_DECREASE,
        quantity: 10,
        reason: 'Physical stock correction',
      })
      .expect(201);
    expect(movementResponse.body.data.quantityDelta).toBe(-10);
    expect(movementResponse.body.data.balanceAfter).toBe(40);

    await request(server)
      .post(`/api/v1/inventory/batches/${batchId}/adjustments`)
      .set(distributorHeaders)
      .send({
        movementType: InventoryMovementType.MANUAL_DECREASE,
        quantity: 100,
        reason: 'Invalid over-adjustment',
      })
      .expect(400);

    const batchListResponse = await request(server)
      .get('/api/v1/inventory/batches')
      .set(distributorHeaders)
      .expect(200);
    expect(batchListResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: batchId,
          onHandQuantity: 40,
          sellableQuantity: 40,
        }),
      ]),
    );

    const movementListResponse = await request(server)
      .get('/api/v1/inventory/movements')
      .query({ batchId })
      .set(distributorHeaders)
      .expect(200);
    expect(movementListResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ movementType: InventoryMovementType.OPENING_STOCK }),
        expect.objectContaining({ movementType: InventoryMovementType.MANUAL_DECREASE }),
      ]),
    );

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({
        organisationId: warehouseResponse.body.data.distributorOrganisationId,
        limit: 20,
      })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'WAREHOUSE_CREATED' }),
        expect.objectContaining({ action: 'INVENTORY_BATCH_CREATED' }),
        expect.objectContaining({ action: 'INVENTORY_MOVEMENT_RECORDED' }),
      ]),
    );
  });
});

async function createDistributorWithUser(
  suffix: string,
  label: string,
  role: PlatformRole,
): Promise<{ headers: Record<string, string> }> {
  const organisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase2b-distributor-${label}-${suffix}`,
      legalName: `Phase 2B Distributor ${label}`,
      displayName: `Phase 2B Distributor ${label}`,
      status: OrganisationStatus.ACTIVE,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `phase2b-distributor-${label}-${suffix}@example.local`,
      profile: {
        create: {
          displayName: `Phase 2B Distributor ${label}`,
        },
      },
    },
  });
  await prisma.organisationMembership.create({
    data: {
      userId: user.id,
      organisationId: organisation.id,
      role,
      status: MembershipStatus.ACTIVE,
    },
  });

  return {
    headers: {
      'x-user-id': user.id,
      'x-user-role': role,
      'x-organisation-id': organisation.id,
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
