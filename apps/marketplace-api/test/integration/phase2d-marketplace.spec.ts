import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  PrismaClient,
  ProductDocumentType,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

describe('Phase 2D marketplace product discovery', () => {
  let app: INestApplication | undefined;
  let productId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    productId = await seedMarketplaceDiscoveryData();

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

  it('lists only public, approved, serviceable and stocked marketplace products', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const response = await request(server)
      .get('/api/v1/marketplace/products')
      .query({
        pincode: '302001',
        category: 'Seeds',
        q: 'bajra',
      })
      .expect(200);

    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: productId,
          name: expect.stringContaining('Phase 2D Hybrid Bajra Seed'),
          serviceablePincode: '302001',
          lowestPricePaise: 118000,
          availableQuantity: 50,
          sellerCount: 1,
          offers: [
            expect.objectContaining({
              sellingPricePaise: 118000,
              availableQuantity: 50,
              seller: expect.objectContaining({
                legalName: expect.stringContaining('Phase 2D Distributor'),
                gstin: '08ABCDE1234F1Z5',
              }),
              warehouse: expect.objectContaining({
                city: 'Jaipur',
                pincode: '302001',
              }),
              fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
            }),
          ],
        }),
      ]),
    );
  });

  it('returns an empty public list when the requested pincode is not serviceable', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const response = await request(server)
      .get('/api/v1/marketplace/products')
      .query({
        pincode: '400001',
      })
      .expect(200);

    expect(response.body.data).toEqual({
      items: [],
      page: 1,
      limit: 25,
      total: 0,
    });
  });

  it('returns authoritative stocked filter options for a pincode', async () => {
    if (!app) throw new Error('Nest application did not boot');

    const response = await request(app.getHttpServer())
      .get('/api/v1/marketplace/products/filter-options')
      .query({ pincode: '302001' })
      .expect(200);

    expect(response.body.data.categories).toContain('Seeds');
    expect(response.body.data.cropTargets).toContain('Bajra');
    expect(response.body.data.brands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Phase 2D Seed Brand' }),
      ]),
    );
  });

  it('returns product detail without private catalogue document storage fields', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const response = await request(server)
      .get(`/api/v1/marketplace/products/${productId}`)
      .query({
        pincode: '302001',
      })
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: productId,
        description: 'Phase 2D public description for farmer discovery.',
        variants: [
          expect.objectContaining({
            variantName: '1 kg pack',
            packSize: '1',
          }),
        ],
        documents: [
          expect.objectContaining({
            documentType: ProductDocumentType.LABEL,
            title: 'Phase 2D approved product label',
          }),
        ],
      }),
    );
    expect(JSON.stringify(response.body.data)).not.toContain('storageKey');
    expect(JSON.stringify(response.body.data)).not.toContain('fileName');
    expect(JSON.stringify(response.body.data)).not.toContain('checkout');
    expect(JSON.stringify(response.body.data)).not.toContain('payment');
  });
});

async function seedMarketplaceDiscoveryData(): Promise<string> {
  const suffix = randomUUID();
  const companyOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.COMPANY,
      slug: `phase2d-company-${suffix}`,
      legalName: 'Phase 2D Seeds Private Limited',
      displayName: 'Phase 2D Seeds',
      gstin: '08ABCDE1234F1Z6',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase2d-distributor-${suffix}`,
      legalName: 'Phase 2D Distributor Private Limited',
      displayName: 'Phase 2D Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 2D Seed Brand',
      slug: `phase2d-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 2D Hybrid Bajra Seed ${suffix}`,
      slug: `phase2d-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      description: 'Phase 2D public description for farmer discovery.',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P2D-1KG-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125000,
    },
  });
  await prisma.productDocument.create({
    data: {
      productId: product.id,
      documentType: ProductDocumentType.LABEL,
      title: 'Phase 2D approved product label',
      documentNumber: 'P2D-LABEL-001',
      fileName: 'phase2d-label.pdf',
      storageKey: 'private/catalogue/phase2d-label.pdf',
      issuedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P2D-JPR-${suffix.slice(0, 8)}`,
      name: 'Phase 2D Jaipur Warehouse',
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
      batchNumber: `P2D-BATCH-${suffix.slice(0, 8)}`,
      expiryDate: new Date('2027-08-03T00:00:00.000Z'),
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
      quantityDelta: 50,
      balanceAfter: 50,
      reason: 'Opening stock for Phase 2D discovery',
    },
  });
  await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P2D-OFFER-${suffix.slice(0, 8)}`,
      sellingPricePaise: 118000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 20,
      serviceablePincodes: ['302001', '302002'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return product.id;
}
