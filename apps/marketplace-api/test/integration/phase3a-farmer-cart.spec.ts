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

describe('Phase 3A farmer profile, address and cart foundation', () => {
  let app: INestApplication | undefined;
  let farmerHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let farmerUserId: string;
  let offerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    const seeded = await seedFarmerCartData();
    farmerHeaders = seeded.farmerHeaders;
    adminHeaders = seeded.adminHeaders;
    farmerUserId = seeded.farmerUserId;
    offerId = seeded.offerId;

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

  it('creates farmer profile, address and validated cart item snapshots', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    const profileResponse = await request(server)
      .put('/api/v1/farmers/me/profile')
      .set(farmerHeaders)
      .send({
        fullName: 'Phase 3A Farmer',
        preferredLocale: 'hi-IN',
        primaryPincode: '302001',
        cropInterests: ['Bajra', 'Wheat'],
      })
      .expect(200);
    expect(profileResponse.body.data.fullName).toBe('Phase 3A Farmer');

    const addressResponse = await request(server)
      .post('/api/v1/farmers/me/addresses')
      .set(farmerHeaders)
      .send({
        label: 'Home',
        recipientName: 'Phase 3A Farmer',
        phone: '+919999999999',
        addressLine1: 'Khasra 42, Rampura Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      })
      .expect(201);
    const addressId = addressResponse.body.data.id as string;
    expect(addressResponse.body.data.isDefault).toBe(true);

    const cartResponse = await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId,
        farmerAddressId: addressId,
        quantity: 2,
        reason: 'Selected from marketplace detail',
      })
      .expect(201);
    expect(cartResponse.body.data).toEqual(
      expect.objectContaining({
        itemCount: 1,
        serviceablePincode: '302001',
        subtotalPaise: 236000,
      }),
    );
    expect(cartResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        offerId,
        quantity: 2,
        priceSnapshotPaise: 118000,
        availableQuantitySnapshot: 6,
        serviceablePincodeSnapshot: '302001',
      }),
    );

    const cartItemId = cartResponse.body.data.items[0].id as string;
    const quantityFailure = await request(server)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set(farmerHeaders)
      .send({
        quantity: 9,
        reason: 'Requested extra quantity',
      })
      .expect(400);
    expect(quantityFailure.body.error.code).toBe('VALIDATION_FAILED');

    const updatedCartResponse = await request(server)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set(farmerHeaders)
      .send({
        quantity: 3,
        reason: 'Adjusted quantity',
      })
      .expect(200);
    expect(updatedCartResponse.body.data.subtotalPaise).toBe(354000);

    const removedCartResponse = await request(server)
      .delete(`/api/v1/cart/items/${cartItemId}`)
      .set(farmerHeaders)
      .expect(200);
    expect(removedCartResponse.body.data.itemCount).toBe(0);

    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId,
        serviceablePincode: '305001',
        quantity: 1,
      })
      .expect(400);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ actorUserId: farmerUserId, limit: 50 })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'FARMER_PROFILE_CREATED' }),
        expect.objectContaining({ action: 'FARMER_ADDRESS_CREATED' }),
        expect.objectContaining({ action: 'CART_ITEM_ADDED' }),
        expect.objectContaining({ action: 'CART_ITEM_UPDATED' }),
        expect.objectContaining({ action: 'CART_ITEM_REMOVED' }),
      ]),
    );
  });
});

async function seedFarmerCartData(): Promise<{
  farmerHeaders: Record<string, string>;
  adminHeaders: Record<string, string>;
  farmerUserId: string;
  offerId: string;
}> {
  const suffix = randomUUID();
  const adminOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `phase3a-admin-${suffix}`,
      legalName: 'Phase 3A Admin Organisation',
      displayName: 'Phase 3A Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `phase3a-admin-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 3A Admin',
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
      slug: `phase3a-farmer-context-${suffix}`,
      legalName: 'Phase 3A Farmer Context',
      displayName: 'Phase 3A Farmer Context',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91000${suffix.slice(0, 8)}`,
      profile: {
        create: {
          displayName: 'Phase 3A Farmer',
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
      slug: `phase3a-company-${suffix}`,
      legalName: 'Phase 3A Seeds Private Limited',
      displayName: 'Phase 3A Seeds',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase3a-distributor-${suffix}`,
      legalName: 'Phase 3A Distributor Private Limited',
      displayName: 'Phase 3A Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 3A Seed Brand',
      slug: `phase3a-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 3A Hybrid Bajra Seed ${suffix}`,
      slug: `phase3a-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P3A-1KG-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      mrpPaise: 125000,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P3A-JPR-${suffix.slice(0, 8)}`,
      name: 'Phase 3A Jaipur Warehouse',
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
      batchNumber: `P3A-BATCH-${suffix.slice(0, 8)}`,
      expiryDate: futureDate(90),
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
      quantityDelta: 6,
      balanceAfter: 6,
      reason: 'Opening stock for Phase 3A cart validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P3A-OFFER-${suffix.slice(0, 8)}`,
      sellingPricePaise: 118000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 6,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return {
    farmerUserId: farmerUser.id,
    offerId: offer.id,
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
