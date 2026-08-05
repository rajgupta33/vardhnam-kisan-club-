import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
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

describe('Phase 2C distributor offer workflow', () => {
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
        slug: `phase2c-admin-${suffix}`,
        legalName: 'Phase 2C Admin Organisation',
        displayName: 'Phase 2C Admin',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: `phase2c-admin-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2C Admin',
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
        slug: `phase2c-company-${suffix}`,
        legalName: 'Phase 2C Seeds Private Limited',
        displayName: 'Phase 2C Seeds',
        status: OrganisationStatus.ACTIVE,
      },
    });
    const companyUser = await prisma.user.create({
      data: {
        email: `phase2c-company-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 2C Company',
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
        name: 'Phase 2C Seed Brand',
        slug: `phase2c-seed-brand-${suffix}`,
        status: CatalogueStatus.APPROVED,
      },
    });
    const product = await prisma.masterProduct.create({
      data: {
        companyOrganisationId: companyOrganisation.id,
        brandId: brand.id,
        name: 'Phase 2C Hybrid Bajra Seed',
        slug: `phase2c-hybrid-bajra-seed-${suffix}`,
        category: 'Seeds',
        cropTargets: ['Bajra'],
        status: CatalogueStatus.APPROVED,
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `P2C-1KG-${suffix.slice(0, 8)}`,
        variantName: '1 kg pack',
        packSize: new Prisma.Decimal(1),
        packUnit: 'kg',
        mrpPaise: 125000,
      },
    });
    variantId = variant.id;

    distributorHeaders = (
      await createDistributorWithUser(suffix, 'primary', PlatformRole.DISTRIBUTOR_OWNER)
    ).headers;
    secondDistributorHeaders = (
      await createDistributorWithUser(suffix, 'second', PlatformRole.DISTRIBUTOR_OWNER)
    ).headers;

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

  it('creates, submits and approves a distributor offer with inventory-derived availability', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const warehouseResponse = await request(server)
      .post('/api/v1/inventory/warehouses')
      .set(distributorHeaders)
      .send({
        code: 'P2C-JPR-01',
        name: 'Phase 2C Jaipur Warehouse',
        addressLine1: 'Plot 12, Agri Market Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        reason: 'Offer warehouse setup',
      })
      .expect(201);
    const warehouseId = warehouseResponse.body.data.id as string;

    const batchResponse = await request(server)
      .post('/api/v1/inventory/batches')
      .set(distributorHeaders)
      .send({
        warehouseId,
        variantId,
        batchNumber: 'P2C-BATCH-2026-08',
        expiryDate: '2027-08-03T00:00:00.000Z',
        germinationPercentage: 92.5,
        openingQuantity: 50,
        reason: 'Opening stock for offer tests',
      })
      .expect(201);
    const batchId = batchResponse.body.data.id as string;

    await request(server)
      .post('/api/v1/offers')
      .set(companyHeaders)
      .send({
        warehouseId,
        variantId,
        sellingPricePaise: 120000,
        serviceablePincodes: ['302001'],
        fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
        deliverySlaDays: 3,
      })
      .expect(403);

    const offerResponse = await request(server)
      .post('/api/v1/offers')
      .set(distributorHeaders)
      .send({
        warehouseId,
        variantId,
        batchId,
        offerCode: 'P2C-OFFER-001',
        sellingPricePaise: 120000,
        minimumOrderQuantity: 1,
        maximumOrderQuantity: 20,
        serviceablePincodes: ['302001', '302002'],
        fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
        deliverySlaDays: 3,
        reason: 'Offer ready for review',
      })
      .expect(201);
    const offerId = offerResponse.body.data.id as string;
    expect(offerResponse.body.data.status).toBe(DistributorOfferStatus.DRAFT);
    expect(offerResponse.body.data.availableQuantity).toBe(50);
    expect(offerResponse.body.data.missingRequirements).toEqual([]);

    await request(server)
      .get(`/api/v1/offers/${offerId}`)
      .set(secondDistributorHeaders)
      .expect(403);

    const submittedResponse = await request(server)
      .post(`/api/v1/offers/${offerId}/submit`)
      .set(distributorHeaders)
      .send({
        reason: 'Ready for Vardhnam offer review',
      })
      .expect(201);
    expect(submittedResponse.body.data.status).toBe(DistributorOfferStatus.SUBMITTED);

    const queueResponse = await request(server)
      .get('/api/v1/offers/review-queue')
      .query({ status: DistributorOfferStatus.SUBMITTED })
      .set(adminHeaders)
      .expect(200);
    expect(queueResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          offer: expect.objectContaining({
            id: offerId,
            availableQuantity: 50,
          }),
          missingRequirements: [],
        }),
      ]),
    );

    const reviewResponse = await request(server)
      .post(`/api/v1/offers/${offerId}/review`)
      .set(adminHeaders)
      .send({
        decision: 'APPROVE',
        reason: 'Offer price, stock and serviceability verified',
      })
      .expect(201);
    expect(reviewResponse.body.data.status).toBe(DistributorOfferStatus.APPROVED);
    expect(reviewResponse.body.data.availableQuantity).toBe(50);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({
        organisationId: warehouseResponse.body.data.distributorOrganisationId,
        limit: 30,
      })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_CREATED' }),
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_SUBMITTED' }),
        expect.objectContaining({ action: 'DISTRIBUTOR_OFFER_APPROVED' }),
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
      slug: `phase2c-distributor-${label}-${suffix}`,
      legalName: `Phase 2C Distributor ${label}`,
      displayName: `Phase 2C Distributor ${label}`,
      status: OrganisationStatus.ACTIVE,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `phase2c-distributor-${label}-${suffix}@example.local`,
      profile: {
        create: {
          displayName: `Phase 2C Distributor ${label}`,
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
