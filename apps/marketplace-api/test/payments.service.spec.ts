import { BadRequestException } from '@nestjs/common';
import {
  IdempotencyStatus,
  OrderType,
  PaymentEventType,
  PaymentIntentStatus,
  PaymentProviderMode,
  PlatformRole,
  ProductCheckoutStatus,
  ProductOrderStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { MockPaymentOutcome } from '../src/payments/dto/confirm-mock-payment-intent.dto';
import { PaymentSettlementService } from '../src/payments/payment-settlement.service';
import { PaymentsService } from '../src/payments/payments.service';

const farmerUserId = '00000000-0000-4000-8000-000000005101';
const farmerOrganisationId = '00000000-0000-4000-8000-000000005102';
const farmerProfileId = '00000000-0000-4000-8000-000000005103';
const checkoutId = '00000000-0000-4000-8000-000000005201';
const orderId = '00000000-0000-4000-8000-000000005301';
const paymentIntentId = '00000000-0000-4000-8000-000000005401';
const paymentEventId = '00000000-0000-4000-8000-000000005402';
const sellerOrganisationId = '00000000-0000-4000-8000-000000005501';

const accessService = {
  hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
    actor.permissions.includes(permission),
  ),
};

const financeService = {
  recordFarmerPayment: jest.fn().mockResolvedValue(undefined),
};

const notificationEventsService = {
  emitPaymentEvent: jest.fn().mockResolvedValue(undefined),
};

/**
 * A gateway that mints the reference it was handed. The mock provider does the
 * same thing; stubbing it here keeps these unit tests free of config and Prisma.
 */
const providerRegistry = {
  current: () => ({
    name: 'mock',
    mode: PaymentProviderMode.MOCK,
    createIntent: jest.fn(async (input: { reference: string }) => ({
      providerReference: input.reference,
    })),
  }),
};

/**
 * Builds the service the way Nest does, with a real settlement service over the
 * mocked collaborators -- the settlement path is what these tests assert on, so
 * stubbing it would leave them asserting nothing.
 */
function paymentsServiceWith(prisma: unknown, auditService: unknown, clubFulfilment?: unknown) {
  return new PaymentsService(
    prisma as never,
    auditService as never,
    accessService as never,
    new PaymentSettlementService(
      auditService as never,
      financeService as never,
      notificationEventsService as never,
      clubFulfilment as never,
    ),
    providerRegistry as never,
  );
}

describe('PaymentsService', () => {
  const farmerActor: CurrentUser = {
    userId: farmerUserId,
    role: PlatformRole.FARMER,
    membershipId: '00000000-0000-4000-8000-000000005104',
    organisationId: farmerOrganisationId,
    permissions: [
      PermissionCode.PAYMENTS_CREATE_OWN,
      PermissionCode.PAYMENTS_CONFIRM_OWN,
      PermissionCode.PAYMENTS_READ_OWN,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires an idempotency key before mock payment creation', async () => {
    const service = paymentsServiceWith({}, { record: jest.fn() });

    await expect(
      service.createMockPaymentIntent({ checkoutId }, farmerActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a mock payment intent and moves child orders to payment processing', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      productCheckout: {
        findFirst: jest
          .fn()
          .mockResolvedValue(checkoutFixture(ProductCheckoutStatus.PENDING_PAYMENT)),
        update: jest
          .fn()
          .mockResolvedValue(checkoutScalarFixture(ProductCheckoutStatus.PAYMENT_PROCESSING)),
      },
      paymentIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(
            paymentIntentDetailFixture(
              PaymentIntentStatus.PROCESSING,
              ProductCheckoutStatus.PAYMENT_PROCESSING,
              ProductOrderStatus.PAYMENT_PROCESSING,
            ),
          ),
        create: jest.fn().mockResolvedValue(paymentIntentFixture(PaymentIntentStatus.PROCESSING)),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue(paymentEventFixture(PaymentEventType.INTENT_CREATED)),
      },
      productOrder: {
        update: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.PAYMENT_PROCESSING)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = prismaWithIdempotency(tx);
    const service = paymentsServiceWith(prisma, auditService);

    const result = await service.createMockPaymentIntent(
      {
        checkoutId,
        reason: 'Farmer started mock payment',
      },
      farmerActor,
      'payment-key-1',
      'req-payment-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: paymentIntentId,
        status: PaymentIntentStatus.PROCESSING,
        amountPaise: 236000,
      }),
    );
    expect(tx.paymentIntent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkoutId,
          farmerProfileId,
          providerMode: PaymentProviderMode.MOCK,
          status: PaymentIntentStatus.PROCESSING,
          amountPaise: 236000,
          currency: 'INR',
        }),
      }),
    );
    expect(tx.productCheckout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductCheckoutStatus.PAYMENT_PROCESSING,
        },
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductOrderStatus.PAYMENT_PROCESSING,
        },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MOCK_PAYMENT_INTENT_CREATED',
        resourceType: 'PaymentIntent',
        resourceId: paymentIntentId,
      }),
      tx,
    );
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
    expect(notificationEventsService.emitPaymentEvent).not.toHaveBeenCalled();
  });

  it('confirms a successful mock payment and confirms child orders', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const clubFulfilmentService = {
      createForConfirmedOrders: jest.fn().mockResolvedValue(undefined),
    };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      paymentIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            paymentIntentDetailFixture(
              PaymentIntentStatus.PROCESSING,
              ProductCheckoutStatus.PAYMENT_PROCESSING,
              ProductOrderStatus.PAYMENT_PROCESSING,
            ),
          )
          .mockResolvedValueOnce(
            paymentIntentDetailFixture(
              PaymentIntentStatus.SUCCEEDED,
              ProductCheckoutStatus.PAID,
              ProductOrderStatus.CONFIRMED,
            ),
          ),
        update: jest.fn().mockResolvedValue(paymentIntentFixture(PaymentIntentStatus.SUCCEEDED)),
      },
      paymentEvent: {
        create: jest
          .fn()
          .mockResolvedValue(paymentEventFixture(PaymentEventType.PAYMENT_SUCCEEDED)),
      },
      productCheckout: {
        update: jest.fn().mockResolvedValue(checkoutScalarFixture(ProductCheckoutStatus.PAID)),
      },
      productOrder: {
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.CONFIRMED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = prismaWithIdempotency(tx);
    const service = paymentsServiceWith(prisma, auditService, clubFulfilmentService);

    const result = await service.confirmMockPaymentIntent(
      paymentIntentId,
      {
        outcome: MockPaymentOutcome.SUCCESS,
        reason: 'Mock payment completed',
      },
      farmerActor,
      'payment-confirm-key-1',
      'req-payment-confirm-1',
    );

    expect(result.status).toBe(PaymentIntentStatus.SUCCEEDED);
    expect(result.checkout.status).toBe(ProductCheckoutStatus.PAID);
    expect(result.checkout.orders[0]?.status).toBe(ProductOrderStatus.CONFIRMED);
    expect(tx.paymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentIntentStatus.SUCCEEDED,
          failureCode: null,
          failureMessage: null,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MOCK_PAYMENT_CONFIRMED',
        resourceType: 'PaymentIntent',
        resourceId: paymentIntentId,
      }),
      tx,
    );
    expect(notificationEventsService.emitPaymentEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'PAYMENT_SUCCEEDED',
        farmerProfileId,
        productCheckoutId: checkoutId,
        paymentIntentId,
        amountPaise: 236000,
      }),
    );
    expect(clubFulfilmentService.createForConfirmedOrders).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining([expect.objectContaining({ id: orderId })]),
      farmerActor,
      'req-payment-confirm-1',
    );
  });

  it('records failed mock payment confirmation without releasing reservations', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      paymentIntent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            paymentIntentDetailFixture(
              PaymentIntentStatus.PROCESSING,
              ProductCheckoutStatus.PAYMENT_PROCESSING,
              ProductOrderStatus.PAYMENT_PROCESSING,
            ),
          )
          .mockResolvedValueOnce(
            paymentIntentDetailFixture(
              PaymentIntentStatus.FAILED,
              ProductCheckoutStatus.PAYMENT_FAILED,
              ProductOrderStatus.PAYMENT_FAILED,
            ),
          ),
        update: jest.fn().mockResolvedValue(
          paymentIntentFixture(PaymentIntentStatus.FAILED, {
            failureCode: 'MOCK_DECLINED',
            failureMessage: 'Mock decline',
          }),
        ),
      },
      paymentEvent: {
        create: jest.fn().mockResolvedValue(paymentEventFixture(PaymentEventType.PAYMENT_FAILED)),
      },
      productCheckout: {
        update: jest
          .fn()
          .mockResolvedValue(checkoutScalarFixture(ProductCheckoutStatus.PAYMENT_FAILED)),
      },
      productOrder: {
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.PAYMENT_FAILED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = prismaWithIdempotency(tx);
    const service = paymentsServiceWith(prisma, auditService);

    const result = await service.confirmMockPaymentIntent(
      paymentIntentId,
      {
        outcome: MockPaymentOutcome.FAILURE,
        failureCode: 'MOCK_DECLINED',
        failureMessage: 'Mock decline',
        reason: 'Mock payment declined',
      },
      farmerActor,
      'payment-confirm-key-2',
      'req-payment-confirm-2',
    );

    expect(result.status).toBe(PaymentIntentStatus.FAILED);
    expect(result.checkout.status).toBe(ProductCheckoutStatus.PAYMENT_FAILED);
    expect(result.checkout.orders[0]?.status).toBe(ProductOrderStatus.PAYMENT_FAILED);
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductOrderStatus.PAYMENT_FAILED,
        },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MOCK_PAYMENT_FAILED',
        resourceType: 'PaymentIntent',
        resourceId: paymentIntentId,
      }),
      tx,
    );
    expect(notificationEventsService.emitPaymentEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'PAYMENT_FAILED',
        farmerProfileId,
        productCheckoutId: checkoutId,
        paymentIntentId,
        amountPaise: 236000,
      }),
    );
  });
});

function prismaWithIdempotency(tx: object) {
  return {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
}

function farmerProfileFixture() {
  return {
    id: farmerProfileId,
    userId: farmerUserId,
    fullName: 'Phase 3C Farmer',
    alternatePhone: null,
    preferredLocale: 'hi-IN',
    village: 'Rampura',
    district: 'Jaipur',
    state: 'Rajasthan',
    primaryPincode: '302001',
    cropInterests: ['Bajra'],
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function checkoutFixture(
  status: ProductCheckoutStatus,
  orderStatus: ProductOrderStatus = ProductOrderStatus.INVENTORY_RESERVED,
) {
  return {
    ...checkoutScalarFixture(status),
    orders: [productOrderFixture(orderStatus)],
  };
}

function checkoutScalarFixture(status: ProductCheckoutStatus) {
  return {
    id: checkoutId,
    farmerProfileId,
    sourceCartId: '00000000-0000-4000-8000-000000005202',
    deliveryAddressId: '00000000-0000-4000-8000-000000005203',
    serviceablePincode: '302001',
    status,
    subtotalPaise: 236000,
    itemCount: 1,
    childOrderCount: 1,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productOrderFixture(status: ProductOrderStatus) {
  return {
    id: orderId,
    checkoutId,
    orderType: OrderType.PRODUCT_ORDER,
    farmerProfileId,
    deliveryAddressId: '00000000-0000-4000-8000-000000005203',
    sellerOrganisationId,
    orderNumber: 'PO-20260803-PAY0001',
    status,
    serviceablePincode: '302001',
    sellerNameSnapshot: 'Phase 3C Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    deliveryAddressSnapshot: {
      pincode: '302001',
    },
    subtotalPaise: 236000,
    itemCount: 1,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function paymentIntentFixture(
  status: PaymentIntentStatus,
  failure: { failureCode?: string; failureMessage?: string } = {},
) {
  return {
    id: paymentIntentId,
    checkoutId,
    farmerProfileId,
    providerMode: PaymentProviderMode.MOCK,
    providerReference: 'mock_phase3c_001',
    status,
    amountPaise: 236000,
    currency: 'INR',
    failureCode: failure.failureCode ?? null,
    failureMessage: failure.failureMessage ?? null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function paymentIntentDetailFixture(
  status: PaymentIntentStatus,
  checkoutStatus: ProductCheckoutStatus,
  orderStatus: ProductOrderStatus,
) {
  return {
    ...paymentIntentFixture(status),
    checkout: checkoutFixture(checkoutStatus, orderStatus),
    events: [paymentEventFixture(PaymentEventType.INTENT_CREATED)],
  };
}

function paymentEventFixture(eventType: PaymentEventType) {
  return {
    id: paymentEventId,
    paymentIntentId,
    eventType,
    status:
      eventType === PaymentEventType.PAYMENT_FAILED
        ? PaymentIntentStatus.FAILED
        : PaymentIntentStatus.PROCESSING,
    providerReference: 'mock_phase3c_001',
    payload: null,
    actorUserId: farmerUserId,
    actorRole: PlatformRole.FARMER,
    requestId: 'req-payment-1',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}
