import {
  PaymentIntentStatus,
  PaymentProviderMode,
  PlatformRole,
  ProductOrderStatus,
  RefundEventType,
  RefundMethod,
  RefundStatus,
  ReturnReasonCode,
  ReturnRequestStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { MockRefundOutcome } from '../src/refunds/dto/confirm-mock-refund.dto';
import { RefundsService } from '../src/refunds/refunds.service';

describe('RefundsService', () => {
  it('idempotently creates a backend-priced refund after inspection', async () => {
    const tx = {
      returnRequest: { findUnique: jest.fn().mockResolvedValue(refundableReturn()) },
      refund: {
        create: jest.fn().mockResolvedValue(refundFixture(RefundStatus.PENDING)),
        findUniqueOrThrow: jest.fn().mockResolvedValue(refundFixture(RefundStatus.PENDING)),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      refund: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const notifications = notificationEvents();
    const service = serviceWith(prisma, audit, undefined, notifications);

    const result = await service.create(
      { returnRequestId },
      operationsActor,
      'refund-create-key',
      'request-refund-create',
    );

    expect(result.amountPaise).toBe(25000);
    expect(tx.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnRequestId,
          amountPaise: 25000,
          method: RefundMethod.ORIGINAL_PAYMENT_METHOD,
          idempotencyKey: 'refund-create-key',
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.REFUND_PENDING }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_INITIATED' }),
      tx,
    );
    expect(notifications.emitFarmerEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: 'REFUND_INITIATED', refundId }),
    );
  });

  it('durably marks a mock refund processing and enqueues the provider execution', async () => {
    const pending = refundFixture(RefundStatus.PENDING);
    const tx = {
      refund: {
        findUnique: jest.fn().mockResolvedValue(pending),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue(refundFixture(RefundStatus.PROCESSING)),
      },
      refundEvent: { create: jest.fn().mockResolvedValue({ id: refundEventId }) },
    };
    const prisma = {
      refundEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      refund: { findUnique: jest.fn().mockResolvedValue(refundFixture(RefundStatus.PROCESSING)) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const queue = { enqueue: jest.fn().mockResolvedValue('job-1') };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = serviceWith(prisma, audit, undefined, undefined, queue);

    const result = await service.confirmMock(
      refundId,
      { outcome: MockRefundOutcome.SUCCEEDED },
      operationsActor,
      'refund-confirm-key',
      'request-refund-confirm',
    );

    expect(result.status).toBe(RefundStatus.PROCESSING);
    expect(tx.refundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: RefundEventType.PROCESSING_STARTED,
          idempotencyKey: 'refund-confirm-key',
        }),
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(
      'payment-webhooks',
      'execute-refund',
      { refundEventId },
      expect.objectContaining({ jobId: `execute-refund-${refundEventId}` }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFUND_EXECUTION_QUEUED' }),
      tx,
    );

    const createdEvent = tx.refundEvent.create.mock.calls[0][0].data;
    prisma.refundEvent.findUnique.mockResolvedValue({
      id: refundEventId,
      refundId,
      requestHash: createdEvent.requestHash,
      requestId: 'request-refund-confirm',
    });
    const replay = await service.confirmMock(
      refundId,
      { outcome: MockRefundOutcome.SUCCEEDED },
      operationsActor,
      'refund-confirm-key',
      'request-refund-confirm-replay',
    );
    expect(replay.status).toBe(RefundStatus.PROCESSING);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
  });

  it('completes a queued mock refund with immutable ledger and status histories', async () => {
    const processing = refundFixture(RefundStatus.PROCESSING);
    const event = {
      id: refundEventId,
      refundId,
      eventType: RefundEventType.PROCESSING_STARTED,
      status: RefundStatus.PROCESSING,
      providerReference: null,
      payload: {
        outcome: MockRefundOutcome.SUCCEEDED,
        actorMembershipId: operationsActor.membershipId,
        actorOrganisationId: operationsActor.organisationId,
      },
      actorUserId: operationsActor.userId,
      actorRole: operationsActor.role,
      requestId: 'request-refund-confirm',
      idempotencyKey: 'refund-confirm-key',
      requestHash: 'request-hash',
      createdAt: new Date(),
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: refundId }]),
      refund: { findUnique: jest.fn().mockResolvedValue(processing), update: jest.fn() },
      refundEvent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: refundEventId })
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({}),
      },
      financialLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
      returnRequest: {
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          items: [{ id: 'return-item-1', unitPricePaise: 12500 }],
          inspectionDispositions: [
            {
              returnRequestItemId: 'return-item-1',
              outcome: 'RESTOCKABLE',
              quantity: 2,
            },
          ],
        }),
      },
    };
    const prisma = {
      refundEvent: {
        findUnique: jest.fn().mockResolvedValue(event),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: refundEventId })
          .mockResolvedValueOnce(null),
      },
      refund: {
        findUnique: jest.fn().mockResolvedValue({ ...processing, paymentIntent: null }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const finance = { reverseCommissionEntriesForOrder: jest.fn().mockResolvedValue({}) };
    const notifications = notificationEvents();
    const service = serviceWith(prisma, audit, finance, notifications);

    const result = await service.executeQueuedMock(refundEventId);

    expect(result).toEqual(expect.objectContaining({ status: RefundStatus.SUCCEEDED }));
    expect(tx.financialLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: -25000,
          refundId,
          productOrderId,
        }),
      }),
    );
    expect(finance.reverseCommissionEntriesForOrder).toHaveBeenCalledWith(
      tx,
      productOrderId,
      expect.objectContaining({
        userId: operationsActor.userId,
        role: operationsActor.role,
        membershipId: operationsActor.membershipId,
        organisationId: operationsActor.organisationId,
      }),
      expect.any(String),
      'request-refund-confirm',
      refundId,
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.REFUNDED }),
      }),
    );
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReturnRequestStatus.COMPLETED }),
      }),
    );
    expect(tx.refundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: RefundEventType.REFUND_SUCCEEDED,
          requestHash: 'request-hash',
        }),
      }),
    );
    expect(notifications.emitFarmerEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: 'REFUND_SUCCEEDED', refundId }),
    );
  });

  it('leaves a queued refund processing when the provider throws so the job can retry', async () => {
    const processing = refundFixture(RefundStatus.PROCESSING);
    const event = {
      id: refundEventId,
      refundId,
      eventType: RefundEventType.PROCESSING_STARTED,
      payload: {
        outcome: MockRefundOutcome.SUCCEEDED,
        actorMembershipId: operationsActor.membershipId,
        actorOrganisationId: operationsActor.organisationId,
      },
      actorUserId: operationsActor.userId,
      actorRole: operationsActor.role,
      requestId: 'request-refund-confirm',
      idempotencyKey: 'refund-confirm-key',
      requestHash: 'request-hash',
    };
    const prisma = {
      refundEvent: {
        findUnique: jest.fn().mockResolvedValue(event),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: refundEventId })
          .mockResolvedValueOnce(null),
      },
      refund: { findUnique: jest.fn().mockResolvedValue({ ...processing, paymentIntent: null }) },
      $transaction: jest.fn(),
    };
    const provider = {
      current: () => ({
        name: 'mock',
        mode: PaymentProviderMode.MOCK,
        createRefund: jest.fn().mockRejectedValue(new Error('gateway unavailable')),
      }),
    };
    const service = serviceWith(prisma, {}, undefined, undefined, undefined, provider);

    await expect(service.executeQueuedMock(refundEventId)).rejects.toThrow('gateway unavailable');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records an explicit queued mock failure without posting a refund ledger entry', async () => {
    const processing = refundFixture(RefundStatus.PROCESSING);
    const event = {
      id: refundEventId,
      refundId,
      eventType: RefundEventType.PROCESSING_STARTED,
      payload: {
        outcome: MockRefundOutcome.FAILED,
        failureReason: 'Provider rejected the mock refund',
        actorMembershipId: operationsActor.membershipId,
        actorOrganisationId: operationsActor.organisationId,
      },
      actorUserId: operationsActor.userId,
      actorRole: operationsActor.role,
      requestId: 'request-refund-failed',
      idempotencyKey: 'refund-failed-key',
      requestHash: 'failed-request-hash',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: refundId }]),
      refund: { findUnique: jest.fn().mockResolvedValue(processing), update: jest.fn() },
      refundEvent: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: refundEventId })
          .mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({}),
      },
      financialLedgerEntry: { create: jest.fn() },
    };
    const prisma = {
      refundEvent: {
        findUnique: jest.fn().mockResolvedValue(event),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: refundEventId })
          .mockResolvedValueOnce(null),
      },
      refund: { findUnique: jest.fn().mockResolvedValue(processing) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const notifications = notificationEvents();
    const service = serviceWith(prisma, audit, undefined, notifications);

    const result = await service.executeQueuedMock(refundEventId);

    expect(result).toEqual(expect.objectContaining({ status: RefundStatus.FAILED }));
    expect(tx.refund.update).toHaveBeenCalledWith({
      where: { id: refundId },
      data: {
        status: RefundStatus.FAILED,
        failureReason: 'Provider rejected the mock refund',
      },
    });
    expect(tx.financialLedgerEntry.create).not.toHaveBeenCalled();
    expect(notifications.emitFarmerEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: 'REFUND_FAILED', refundId }),
    );
  });
});

function serviceWith(
  prisma: object,
  audit: object,
  finance: object = { reverseCommissionEntriesForOrder: jest.fn() },
  notifications: object = notificationEvents(),
  queue: object = { enqueue: jest.fn().mockResolvedValue('job-1') },
  providers: object = providerRegistry(),
  creditNotes: object = {
    issueForSucceededRefund: jest.fn().mockResolvedValue('credit-note-document-id'),
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
) {
  return new RefundsService(
    prisma as never,
    audit as never,
    { hasPermission: jest.fn().mockReturnValue(true) } as never,
    finance as never,
    notifications as never,
    providers as never,
    queue as never,
    creditNotes as never,
  );
}

/**
 * A gateway that settles every refund it is asked for, the way the mock does.
 * The reference is fixed so the spec can assert on it.
 */
function providerRegistry() {
  return {
    current: () => ({
      name: 'mock',
      mode: PaymentProviderMode.MOCK,
      createRefund: jest.fn().mockResolvedValue({
        providerRefundReference: 'MOCK-REFUND-TEST',
        settled: true,
      }),
    }),
  };
}

function notificationEvents() {
  return { emitFarmerEvent: jest.fn().mockResolvedValue({}) };
}

function refundableReturn() {
  return {
    id: returnRequestId,
    productOrderId,
    farmerUserId,
    distributorOrganisationId,
    status: ReturnRequestStatus.INSPECTED,
    approvedRefundAmountPaise: 25000,
    refunds: [],
    productOrder: {
      status: ProductOrderStatus.RETURNED,
      checkout: {
        paymentIntents: [
          {
            id: paymentIntentId,
            status: PaymentIntentStatus.SUCCEEDED,
            providerMode: PaymentProviderMode.MOCK,
          },
        ],
      },
    },
  };
}

function refundFixture(status: RefundStatus) {
  const createdAt = new Date('2026-08-12T10:00:00.000Z');
  return {
    id: refundId,
    productOrderId,
    returnRequestId,
    paymentIntentId,
    farmerUserId,
    amountPaise: 25000,
    method: RefundMethod.ORIGINAL_PAYMENT_METHOD,
    status,
    providerMode: PaymentProviderMode.MOCK,
    providerRefundReference: null,
    failureReason: null,
    idempotencyKey: 'refund-create-key',
    initiatedByUserId: operationsActor.userId,
    initiatedAt: createdAt,
    completedAt: null,
    createdAt,
    updatedAt: createdAt,
    events: [],
    productOrder: {
      orderNumber: 'VA-REFUND-1',
      sellerNameSnapshot: 'Seller',
      sellerOrganisationId: distributorOrganisationId,
      status: ProductOrderStatus.REFUND_PENDING,
    },
    returnRequest: {
      status: ReturnRequestStatus.INSPECTED,
      reasonCode: ReturnReasonCode.QUALITY_ISSUE,
    },
    paymentIntent: {
      providerReference: 'mock-payment-1',
      status: PaymentIntentStatus.SUCCEEDED,
    },
  };
}

const refundId = '00000000-0000-4000-8000-000000002001';
const refundEventId = '00000000-0000-4000-8000-000000002000';
const returnRequestId = '00000000-0000-4000-8000-000000002002';
const productOrderId = '00000000-0000-4000-8000-000000002003';
const paymentIntentId = '00000000-0000-4000-8000-000000002004';
const farmerUserId = '00000000-0000-4000-8000-000000002005';
const distributorOrganisationId = '00000000-0000-4000-8000-000000002006';

const operationsActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000002101',
  membershipId: '00000000-0000-4000-8000-000000002102',
  organisationId: '00000000-0000-4000-8000-000000002103',
  role: PlatformRole.OPERATIONS_MANAGER,
  permissions: [
    PermissionCode.REFUNDS_CREATE_ANY,
    PermissionCode.REFUNDS_READ_ANY,
    PermissionCode.REFUNDS_CONFIRM_MOCK,
  ],
};
