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
  PaymentIntentStatus,
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
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';

const prisma = new PrismaClient();

describe('Phase 3D order cancellation and reservation release foundation', () => {
  let app: INestApplication | undefined;
  let farmerHeaders: Record<string, string>;
  let adminHeaders: Record<string, string>;
  let farmerUserId: string;
  let offerId: string;
  let batchId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    const seeded = await seedPhase3DData();
    farmerHeaders = seeded.farmerHeaders;
    adminHeaders = seeded.adminHeaders;
    farmerUserId = seeded.farmerUserId;
    offerId = seeded.offerId;
    batchId = seeded.batchId;

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

  it('cancels eligible farmer checkouts and orders with idempotent reservation release', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    await request(server)
      .put('/api/v1/farmers/me/profile')
      .set(farmerHeaders)
      .send({
        fullName: 'Phase 3D Farmer',
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
        recipientName: 'Phase 3D Farmer',
        phone: '+919999999999',
        addressLine1: 'Khasra 42, Rampura Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      })
      .expect(201);
    const addressId = addressResponse.body.data.id as string;

    const failedCheckoutId = await createCheckout(server, addressId, 2, 'failed-payment');
    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3d-payment-${randomUUID()}`)
      .send({
        checkoutId: failedCheckoutId,
        reason: 'Farmer started mock payment before cancelling',
      })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const failedPaymentResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3d-payment-fail-${randomUUID()}`)
      .send({
        outcome: MockPaymentOutcome.FAILURE,
        failureCode: 'FARMER_ABORTED',
        failureMessage: 'Farmer cancelled test payment',
        reason: 'Mock payment failed before farmer cancellation',
      })
      .expect(201);
    expect(failedPaymentResponse.body.data.status).toBe(PaymentIntentStatus.FAILED);
    expect(failedPaymentResponse.body.data.checkout.status).toBe(
      ProductCheckoutStatus.PAYMENT_FAILED,
    );

    const cancelCheckoutKey = `phase3d-cancel-checkout-${randomUUID()}`;
    const cancelCheckoutResponse = await request(server)
      .post(`/api/v1/checkout/${failedCheckoutId}/cancel`)
      .set(farmerHeaders)
      .set('Idempotency-Key', cancelCheckoutKey)
      .send({
        reason: 'Farmer cancelled after failed mock payment',
      })
      .expect(201);
    expect(cancelCheckoutResponse.body.data.status).toBe(ProductCheckoutStatus.CANCELLED);
    expect(cancelCheckoutResponse.body.data.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductOrderStatus.CANCELLED,
        }),
      ]),
    );
    const failedOrderId = cancelCheckoutResponse.body.data.orders[0].id as string;

    const replayCancelCheckoutResponse = await request(server)
      .post(`/api/v1/checkout/${failedCheckoutId}/cancel`)
      .set(farmerHeaders)
      .set('Idempotency-Key', cancelCheckoutKey)
      .send({
        reason: 'Farmer cancelled after failed mock payment',
      })
      .expect(201);
    expect(replayCancelCheckoutResponse.body.data.id).toBe(failedCheckoutId);

    await expectReleaseMovement(server, failedOrderId, 2);

    const pendingCheckoutId = await createCheckout(server, addressId, 1, 'pending-order');
    const pendingCheckoutResponse = await request(server)
      .get(`/api/v1/checkout/${pendingCheckoutId}`)
      .set(farmerHeaders)
      .expect(200);
    const pendingOrderId = pendingCheckoutResponse.body.data.orders[0].id as string;

    const cancelOrderResponse = await request(server)
      .post(`/api/v1/orders/${pendingOrderId}/cancel`)
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3d-cancel-order-${randomUUID()}`)
      .send({
        reason: 'Farmer cancelled pending child order before payment',
      })
      .expect(201);
    expect(cancelOrderResponse.body.data.status).toBe(ProductOrderStatus.CANCELLED);

    const pendingCheckoutAfterCancelResponse = await request(server)
      .get(`/api/v1/checkout/${pendingCheckoutId}`)
      .set(farmerHeaders)
      .expect(200);
    expect(pendingCheckoutAfterCancelResponse.body.data.status).toBe(
      ProductCheckoutStatus.CANCELLED,
    );
    await expectReleaseMovement(server, pendingOrderId, 1);

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ actorUserId: farmerUserId, limit: 100 })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'PRODUCT_CHECKOUT_CANCELLED_BY_FARMER' }),
        expect.objectContaining({ action: 'PRODUCT_ORDER_CANCELLED_BY_FARMER' }),
        expect.objectContaining({ action: 'INVENTORY_RELEASED_FROM_ORDER' }),
      ]),
    );
  });

  async function createCheckout(
    server: Parameters<typeof request>[0],
    addressId: string,
    quantity: number,
    keySuffix: string,
  ): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(farmerHeaders)
      .send({
        offerId,
        farmerAddressId: addressId,
        quantity,
        reason: `Selected Phase 3D item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3d-checkout-${keySuffix}-${randomUUID()}`)
      .send({
        farmerAddressId: addressId,
        reason: `Farmer confirmed Phase 3D cart for ${keySuffix}`,
      })
      .expect(201);

    return checkoutResponse.body.data.id as string;
  }

  async function expectReleaseMovement(
    server: Parameters<typeof request>[0],
    orderId: string,
    quantity: number,
  ): Promise<void> {
    const movementResponse = await request(server)
      .get('/api/v1/inventory/movements')
      .query({
        batchId,
        movementType: InventoryMovementType.RELEASED_FROM_ORDER,
        limit: 50,
      })
      .set(adminHeaders)
      .expect(200);

    expect(movementResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          movementType: InventoryMovementType.RELEASED_FROM_ORDER,
          quantityDelta: quantity,
          referenceType: 'ProductOrderCancellation',
          referenceId: orderId,
        }),
      ]),
    );
  }
});

async function seedPhase3DData(): Promise<{
  farmerHeaders: Record<string, string>;
  adminHeaders: Record<string, string>;
  farmerUserId: string;
  offerId: string;
  batchId: string;
}> {
  const suffix = randomUUID();
  const adminOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `phase3d-admin-${suffix}`,
      legalName: 'Phase 3D Admin Organisation',
      displayName: 'Phase 3D Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `phase3d-admin-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 3D Admin',
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
      slug: `phase3d-farmer-context-${suffix}`,
      legalName: 'Phase 3D Farmer Context',
      displayName: 'Phase 3D Farmer Context',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91003${suffix.slice(0, 8)}`,
      profile: {
        create: {
          displayName: 'Phase 3D Farmer',
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
      slug: `phase3d-company-${suffix}`,
      legalName: 'Phase 3D Seeds Private Limited',
      displayName: 'Phase 3D Seeds',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 3D Seed Brand',
      slug: `phase3d-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 3D Hybrid Bajra Seed ${suffix}`,
      slug: `phase3d-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P3D-1KG-${suffix.slice(0, 8)}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125000,
    },
  });

  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `phase3d-distributor-${suffix}`,
      legalName: 'Phase 3D Jaipur Distributor Private Limited',
      displayName: 'Phase 3D Jaipur Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P3D-JPR-${suffix.slice(0, 8)}`,
      name: 'Phase 3D Jaipur Distributor Warehouse',
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
      batchNumber: `P3D-BATCH-${suffix.slice(0, 8)}`,
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
      quantityDelta: 5,
      balanceAfter: 5,
      reason: 'Opening stock for Phase 3D cancellation validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P3D-OFFER-${suffix.slice(0, 8)}`,
      sellingPricePaise: 118000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 5,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return {
    farmerUserId: farmerUser.id,
    offerId: offer.id,
    batchId: batch.id,
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
