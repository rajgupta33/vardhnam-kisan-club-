import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
  ProductDocumentType,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

describe('Phase 2A catalogue approval workflow', () => {
  let app: INestApplication | undefined;
  let adminHeaders: Record<string, string>;
  let distributorHeaders: Record<string, string>;

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
        slug: `phase2a-admin-${suffix}`,
        legalName: 'Phase 2A Admin Organisation',
        displayName: 'Phase 2A Admin',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: `phase2a-admin-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2A Admin',
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

    const distributorOrganisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.DISTRIBUTOR,
        slug: `phase2a-distributor-${suffix}`,
        legalName: 'Phase 2A Distributor',
        displayName: 'Phase 2A Distributor',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const distributorUser = await prisma.user.create({
      data: {
        email: `phase2a-distributor-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2A Distributor',
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

    distributorHeaders = {
      'x-user-id': distributorUser.id,
      'x-user-role': PlatformRole.DISTRIBUTOR_OWNER,
      'x-organisation-id': distributorOrganisation.id,
    };

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

  it('submits and approves brand and master product records with audit history', async () => {
    const suffix = randomUUID();
    const company = await prisma.organisation.create({
      data: {
        type: OrganisationType.COMPANY,
        slug: `phase2a-company-${suffix}`,
        legalName: 'Phase 2A Seeds Private Limited',
        displayName: 'Phase 2A Seeds',
        status: OrganisationStatus.ACTIVE,
      },
    });

    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    await request(server)
      .post('/api/v1/catalogue/brands')
      .set(distributorHeaders)
      .send({
        companyOrganisationId: company.id,
        name: 'Blocked Distributor Brand',
      })
      .expect(403);

    const brandResponse = await request(server)
      .post('/api/v1/catalogue/brands')
      .set(adminHeaders)
      .send({
        companyOrganisationId: company.id,
        name: 'Phase 2A Seed Brand',
        description: 'Catalogue brand metadata for Phase 2A.',
      })
      .expect(201);
    const brandId = brandResponse.body.data.id as string;

    await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/review`)
      .set(adminHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Cannot approve draft catalogue data',
      })
      .expect(400);

    await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/submit`)
      .set(adminHeaders)
      .send({
        reason: 'Brand metadata is ready for review',
      })
      .expect(201);

    const brandQueueResponse = await request(server)
      .get('/api/v1/catalogue/brands/review-queue')
      .set(adminHeaders)
      .expect(200);
    expect(brandQueueResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: brandId,
          status: CatalogueStatus.SUBMITTED,
        }),
      ]),
    );

    const brandApprovalResponse = await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/review`)
      .set(adminHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Brand metadata verified',
      })
      .expect(201);
    expect(brandApprovalResponse.body.data.status).toBe(CatalogueStatus.APPROVED);

    const productResponse = await request(server)
      .post('/api/v1/catalogue/products')
      .set(adminHeaders)
      .send({
        brandId,
        name: 'Phase 2A Hybrid Bajra Seed',
        category: 'Seeds',
        cropTargets: ['Bajra'],
        reason: 'Initial master product',
      })
      .expect(201);
    const productId = productResponse.body.data.id as string;

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/submit`)
      .set(adminHeaders)
      .send({
        reason: 'Submitting too early',
      })
      .expect(400);

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/variants`)
      .set(adminHeaders)
      .send({
        variantName: '1 kg pack',
        packSize: 1,
        packUnit: 'kg',
        mrpPaise: 125000,
        hsnCode: '1008',
        gstRateBps: 500,
        reason: 'Add first pack size',
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/documents`)
      .set(adminHeaders)
      .send({
        documentType: ProductDocumentType.LABEL,
        title: 'Product label metadata',
        fileName: 'phase2a-label.pdf',
        storageKey: 'mock/catalogue/phase2a-label.pdf',
        reason: 'Add label metadata',
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/submit`)
      .set(adminHeaders)
      .send({
        reason: 'Ready for catalogue review',
      })
      .expect(201);

    const productQueueResponse = await request(server)
      .get('/api/v1/catalogue/products/review-queue')
      .set(adminHeaders)
      .expect(200);
    expect(productQueueResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          product: expect.objectContaining({
            id: productId,
            status: CatalogueStatus.SUBMITTED,
          }),
          activeVariantCount: 1,
          documentCount: 1,
          missingRequirements: [],
        }),
      ]),
    );

    const productDetailResponse = await request(server)
      .get(`/api/v1/catalogue/products/${productId}`)
      .set(adminHeaders)
      .expect(200);
    expect(productDetailResponse.body.data).toEqual(
      expect.objectContaining({
        id: productId,
        missingRequirements: [],
      }),
    );

    const productApprovalResponse = await request(server)
      .post(`/api/v1/catalogue/products/${productId}/review`)
      .set(adminHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Variant and document metadata verified',
      })
      .expect(201);
    expect(productApprovalResponse.body.data.status).toBe(CatalogueStatus.APPROVED);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ organisationId: company.id, limit: 20 })
      .set(adminHeaders)
      .expect(200);

    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'BRAND_APPROVED' }),
        expect.objectContaining({ action: 'MASTER_PRODUCT_SUBMITTED' }),
        expect.objectContaining({ action: 'MASTER_PRODUCT_APPROVED' }),
      ]),
    );
  });
});

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
