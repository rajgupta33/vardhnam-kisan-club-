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
import { FarmerPaymentNotificationEvent } from '../../src/notifications/notification-events.service';
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';

const prisma = new PrismaClient();

describe('Phase 3C mock payment foundation', () => {
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

  it('creates and confirms an idempotent mock payment for a reserved checkout', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();

    await request(server)
      .put('/api/v1/farmers/me/profile')
      .set(farmerHeaders)
      .send({
        fullName: 'Phase 3C Farmer',
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
        recipientName: 'Phase 3C Farmer',
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

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3c-checkout-${randomUUID()}`)
      .send({
        farmerAddressId: addressId,
        reason: 'Farmer confirmed cart',
      })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentKey = `phase3c-payment-${randomUUID()}`;
    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', paymentIntentKey)
      .send({
        checkoutId,
        reason: 'Farmer started mock payment',
      })
      .expect(201);
    expect(paymentIntentResponse.body.data).toEqual(
      expect.objectContaining({
        checkoutId,
        status: PaymentIntentStatus.PROCESSING,
        amountPaise: 322000,
        currency: 'INR',
      }),
    );
    expect(paymentIntentResponse.body.data.checkout).toEqual(
      expect.objectContaining({
        status: ProductCheckoutStatus.PAYMENT_PROCESSING,
      }),
    );
    expect(paymentIntentResponse.body.data.checkout.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductOrderStatus.PAYMENT_PROCESSING,
        }),
      ]),
    );

    const replayPaymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', paymentIntentKey)
      .send({
        checkoutId,
        reason: 'Farmer started mock payment',
      })
      .expect(201);
    expect(replayPaymentIntentResponse.body.data.id).toBe(paymentIntentResponse.body.data.id);

    const failedPaymentIntentId = paymentIntentResponse.body.data.id as string;
    const failedConfirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${failedPaymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3c-confirm-failed-${randomUUID()}`)
      .send({
        outcome: MockPaymentOutcome.FAILURE,
        failureCode: 'TEST_DECLINED',
        failureMessage: 'Mock payment declined for integration testing',
        reason: 'Mock payment failure verified by backend',
      })
      .expect(201);
    expect(failedConfirmResponse.body.data).toEqual(
      expect.objectContaining({
        id: failedPaymentIntentId,
        status: PaymentIntentStatus.FAILED,
        failureCode: 'TEST_DECLINED',
      }),
    );
    expect(failedConfirmResponse.body.data.checkout.status).toBe(
      ProductCheckoutStatus.PAYMENT_FAILED,
    );

    const retryPaymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(farmerHeaders)
      .set('Idempotency-Key', `phase3c-intent-retry-${randomUUID()}`)
      .send({
        checkoutId,
        reason: 'Farmer retried mock payment',
      })
      .expect(201);
    const paymentIntentId = retryPaymentIntentResponse.body.data.id as string;
    const successfulConfirmationKey = `phase3c-confirm-${randomUUID()}`;
    const successfulConfirmationBody = {
      outcome: MockPaymentOutcome.SUCCESS,
      reason: 'Mock payment confirmed by backend',
    };
    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', successfulConfirmationKey)
      .send(successfulConfirmationBody)
      .expect(201);
    expect(confirmResponse.body.data).toEqual(
      expect.objectContaining({
        id: paymentIntentId,
        status: PaymentIntentStatus.SUCCEEDED,
        failureCode: null,
        failureMessage: null,
      }),
    );
    expect(confirmResponse.body.data.checkout).toEqual(
      expect.objectContaining({
        status: ProductCheckoutStatus.PAID,
      }),
    );
    expect(confirmResponse.body.data.checkout.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductOrderStatus.CONFIRMED,
        }),
      ]),
    );

    const replayConfirmationResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(farmerHeaders)
      .set('Idempotency-Key', successfulConfirmationKey)
      .send(successfulConfirmationBody)
      .expect(201);
    expect(replayConfirmationResponse.body.data.id).toBe(paymentIntentId);

    const checkoutAfterPaymentResponse = await request(server)
      .get(`/api/v1/checkout/${checkoutId}`)
      .set(farmerHeaders)
      .expect(200);
    expect(checkoutAfterPaymentResponse.body.data.status).toBe(ProductCheckoutStatus.PAID);
    expect(checkoutAfterPaymentResponse.body.data.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: ProductOrderStatus.CONFIRMED,
        }),
      ]),
    );

    const paymentListResponse = await request(server)
      .get('/api/v1/payments/mock-intents')
      .query({ checkoutId })
      .set(farmerHeaders)
      .expect(200);
    expect(paymentListResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: paymentIntentId,
          status: PaymentIntentStatus.SUCCEEDED,
        }),
      ]),
    );

    const notificationResponse = await request(server)
      .get('/api/v1/notifications/me')
      .query({ channel: 'IN_APP', limit: 100 })
      .set(farmerHeaders)
      .expect(200);
    const paymentNotifications = (
      notificationResponse.body.data.items as Array<{
        category: string;
        relatedResourceType: string | null;
        relatedResourceId: string | null;
        status: string;
        payloadSnapshot: Record<string, unknown>;
      }>
    ).filter((notification) => notification.relatedResourceId === checkoutId);
    expect(paymentNotifications).toHaveLength(2);
    expect(paymentNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: FarmerPaymentNotificationEvent.PAYMENT_FAILED,
          relatedResourceType: 'ProductCheckout',
          relatedResourceId: checkoutId,
          status: 'SENT',
          payloadSnapshot: expect.objectContaining({
            amountPaise: paymentIntentResponse.body.data.amountPaise,
            paymentIntentId: failedPaymentIntentId,
            productCheckoutId: checkoutId,
          }),
        }),
        expect.objectContaining({
          category: FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED,
          relatedResourceType: 'ProductCheckout',
          relatedResourceId: checkoutId,
          status: 'SENT',
          payloadSnapshot: expect.objectContaining({
            amountPaise: paymentIntentResponse.body.data.amountPaise,
            paymentIntentId,
            productCheckoutId: checkoutId,
          }),
        }),
      ]),
    );

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ actorUserId: farmerUserId, limit: 100 })
      .set(adminHeaders)
      .expect(200);
    expect(auditResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'MOCK_PAYMENT_INTENT_CREATED' }),
        expect.objectContaining({ action: 'MOCK_PAYMENT_FAILED' }),
        expect.objectContaining({ action: 'MOCK_PAYMENT_CONFIRMED' }),
        expect.objectContaining({ action: 'PRODUCT_CHECKOUT_PAYMENT_PAID' }),
        expect.objectContaining({ action: 'PRODUCT_ORDER_PAYMENT_CONFIRMED' }),
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
      slug: `phase3c-admin-${suffix}`,
      legalName: 'Phase 3C Admin Organisation',
      displayName: 'Phase 3C Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `phase3c-admin-${suffix}@example.local`,
      profile: {
        create: {
          displayName: 'Phase 3C Admin',
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
      slug: `phase3c-farmer-context-${suffix}`,
      legalName: 'Phase 3C Farmer Context',
      displayName: 'Phase 3C Farmer Context',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91002${suffix.slice(0, 8)}`,
      profile: {
        create: {
          displayName: 'Phase 3C Farmer',
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
      slug: `phase3c-company-${suffix}`,
      legalName: 'Phase 3C Seeds Private Limited',
      displayName: 'Phase 3C Seeds',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 3C Seed Brand',
      slug: `phase3c-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 3C Hybrid Bajra Seed ${suffix}`,
      slug: `phase3c-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P3C-1KG-${suffix.slice(0, 8)}`,
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
    distributorName: 'Phase 3C Jaipur Distributor',
    offerCodePrefix: 'P3C-JPR',
    quantity: 6,
    sellingPricePaise: 118000,
  });
  const secondOfferId = await seedDistributorOffer({
    suffix,
    productId: product.id,
    variantId: variant.id,
    distributorName: 'Phase 3C Rural Supply',
    offerCodePrefix: 'P3C-RUR',
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
      reason: 'Opening stock for Phase 3C payment validation',
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
