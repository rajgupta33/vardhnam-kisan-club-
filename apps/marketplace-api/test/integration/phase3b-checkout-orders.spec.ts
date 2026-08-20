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
  ProductCheckoutStatus,
  ProductOrderStatus,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';

const prisma = new PrismaClient();

describe('Phase 3B checkout and product order foundation', () => {
  let app: INestApplication | undefined;
  let farmerHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let farmerUserId: string;
  let offerIds: string[];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    const seeded = await seedCheckoutData();
    farmerHeaders = seeded.farmerHeaders;
    adminHeaders = seeded.adminHeaders;
    farmerUserId = seeded.farmerUserId;
    offerIds = seeded.offerIds;

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

  it('creates an idempotent checkout with child orders and inventory reservations', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    await request(server)
      .put('/api/v1/farmers/me/profile')
      .set(farmerHeaders)
      .send({
        fullName: 'Phase 3B Farmer',
        preferredLocale: 'hi-IN',
        primaryPincode: '302001',
        cropInterests: ['Bajra'],
      })
      .expect(200);

    const addressResponse = await request(server)
      .post('/api/v1/farmers/me/addresses')
      .set(farmerHeaders)
      .send({
        label: 'Home',
        recipientName: 'Phase 3B Farmer',
        phone: '+919999999999',
        addressLine1: 'Khasra 42, Rampura Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      })
      .expect(201);
    const addressId = addressResponse.body.data.id as string;

    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId: offerIds[0],
        farmerAddressId: addressId,
        quantity: 2,
        reason: 'Selected seed pack',
      })
      .expect(201);
    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId: offerIds[1],
        farmerAddressId: addressId,
        quantity: 1,
        reason: 'Selected nutrition pack',
      })
      .expect(201);

    const idempotencyKey = `phase3b-${randomUUID()}`;
    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        farmerAddressId: addressId,
        reason: 'Farmer confirmed cart',
      })
      .expect(201);
    expect(checkoutResponse.body.data).toEqual(
      expect.objectContaining({
        status: ProductCheckoutStatus.PENDING_PAYMENT,
        subtotalPaise: 322000,
        itemCount: 2,
        childOrderCount: 2,
      }),
    );
    expect(checkoutResponse.body.data.orders).toHaveLength(2);
    expect(checkoutResponse.body.data.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductOrderStatus.INVENTORY_RESERVED,
          itemCount: 1,
        }),
      ]),
    );
    for (const order of checkoutResponse.body.data.orders) {
      expect(order.items[0].reservations[0]).toEqual(
        expect.objectContaining({
          quantity: expect.any(Number),
          movementBalanceAfter: expect.any(Number),
        }),
      );
    }

    const replayResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        farmerAddressId: addressId,
        reason: 'Farmer confirmed cart',
      })
      .expect(201);
    expect(replayResponse.body.data.id).toBe(checkoutResponse.body.data.id);

    const orderListResponse = await request(server)
      .get('/api/v1/orders')
      .set(farmerHeaders)
      .expect(200);
    expect(orderListResponse.body.data.total).toBeGreaterThanOrEqual(2);

    const cartResponse = await request(server).get('/api/v1/cart').set(farmerHeaders).expect(200);
    expect(cartResponse.body.data.itemCount).toBe(0);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ actorUserId: farmerUserId, limit: 100 })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'PRODUCT_CHECKOUT_CREATED' }),
        expect.objectContaining({ action: 'PRODUCT_ORDER_CREATED' }),
        expect.objectContaining({ action: 'PRODUCT_ORDER_INVENTORY_RESERVED' }),
        expect.objectContaining({ action: 'INVENTORY_RESERVED_FOR_ORDER' }),
        expect.objectContaining({ action: 'CART_CHECKED_OUT' }),
      ]),
    );
  });
});

async function seedCheckoutData(): Promise<{
  farmerHeaders: Record<string, string>;
  adminHeaders: Record<string, string>;
  farmerUserId: string;
  offerIds: string[];
}> {
  const suffix = randomUUID();
  const adminOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `phase3b-admin-${suffix}`,
      legalName: 'Phase 3B Admin Organisation',
      displayName: 'Phase 3B Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `phase3b-admin-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 3B Admin',
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

  const farmerOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `phase3b-farmer-context-${suffix}`,
      legalName: 'Phase 3B Farmer Context',
      displayName: 'Phase 3B Farmer Context',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91001${suffix.slice(0, 8)}`,
      profile: {
        create: {
          displayName: 'Phase 3B Farmer',
        },
      },
    },
  });
  await prisma.organisationMembership.create({
    data: {
      userId: farmerUser.id,
      organisationId: farmerOrganisation.id,
      role: PlatformRole.FARMER,
      status: MembershipStatus.ACTIVE,
    },
  });

  const companyOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.COMPANY,
      slug: `phase3b-company-${suffix}`,
      legalName: 'Phase 3B Seeds Private Limited',
      displayName: 'Phase 3B Seeds',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 3B Seed Brand',
      slug: `phase3b-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 3B Hybrid Bajra Seed ${suffix}`,
      slug: `phase3b-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P3B-1KG-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125000,
    },
  });

  const firstOfferId = await seedDistributorOffer({
    suffix,
    productId: product.id,
    variantId: variant.id,
    distributorName: 'Phase 3B Jaipur Distributor',
    offerCodePrefix: 'P3B-JPR',
    quantity: 6,
    sellingPricePaise: 118000,
  });
  const secondOfferId = await seedDistributorOffer({
    suffix,
    productId: product.id,
    variantId: variant.id,
    distributorName: 'Phase 3B Rural Supply',
    offerCodePrefix: 'P3B-RUR',
    quantity: 4,
    sellingPricePaise: 86000,
  });

  return {
    farmerUserId: farmerUser.id,
    offerIds: [firstOfferId, secondOfferId],
    adminHeaders: {
      'x-user-id': adminUser.id,
      'x-user-role': PlatformRole.SUPER_ADMIN,
      'x-organisation-id': adminOrganisation.id,
    },
    farmerHeaders: {
      'x-user-id': farmerUser.id,
      'x-user-role': PlatformRole.FARMER,
      'x-organisation-id': farmerOrganisation.id,
    },
  };
}

async function seedDistributorOffer(input: {
  suffix: string;
  productId: string;
  variantId: string;
  distributorName: string;
  offerCodePrefix: string;
  quantity: number;
  sellingPricePaise: number;
}): Promise<string> {
  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `${input.offerCodePrefix.toLowerCase()}-distributor-${input.suffix}`,
      legalName: `${input.distributorName} Private Limited`,
      displayName: input.distributorName,
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `${input.offerCodePrefix}-${input.suffix.slice(0, 8)}`,
      name: `${input.distributorName} Warehouse`,
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
      productId: input.productId,
      variantId: input.variantId,
      batchNumber: `${input.offerCodePrefix}-BATCH-${input.suffix.slice(0, 8)}`,
      expiryDate: futureDate(90),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      productId: input.productId,
      variantId: input.variantId,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: input.quantity,
      balanceAfter: input.quantity,
      reason: 'Opening stock for Phase 3B checkout validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: input.productId,
      variantId: input.variantId,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `${input.offerCodePrefix}-OFFER-${input.suffix.slice(0, 8)}`,
      sellingPricePaise: input.sellingPricePaise,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: input.quantity,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return offer.id;
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
