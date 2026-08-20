import {
  DisputeCategory,
  DisputeResolutionOutcome,
  DisputeStatus,
  FinancialLedgerEntryType,
  PlatformRole,
  ProductOrderStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { DisputesService } from '../src/disputes/disputes.service';

const farmerUserId = '00000000-0000-4000-8000-000000003001';
const farmerOrganisationId = '00000000-0000-4000-8000-000000003002';
const sellerOrganisationId = '00000000-0000-4000-8000-000000003003';
const orderId = '00000000-0000-4000-8000-000000003004';
const disputeId = '00000000-0000-4000-8000-000000003005';

const farmerActor: CurrentUser = {
  userId: farmerUserId,
  membershipId: '00000000-0000-4000-8000-000000003006',
  organisationId: farmerOrganisationId,
  role: PlatformRole.FARMER,
  permissions: [PermissionCode.DISPUTES_CREATE_OWN, PermissionCode.DISPUTES_READ_OWN],
};

const financeActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000003007',
  membershipId: '00000000-0000-4000-8000-000000003008',
  organisationId: '00000000-0000-4000-8000-000000003009',
  role: PlatformRole.FINANCE_MANAGER,
  permissions: [PermissionCode.DISPUTES_READ_ANY, PermissionCode.DISPUTES_RESOLVE],
};

const distributorActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000003010',
  membershipId: '00000000-0000-4000-8000-000000003011',
  organisationId: sellerOrganisationId,
  role: PlatformRole.DISTRIBUTOR_OWNER,
  permissions: [PermissionCode.DISPUTES_READ_SELLER_OWN],
};

describe('DisputesService', () => {
  it('opens an idempotent farmer dispute and pauses the child order transactionally', async () => {
    const created = disputeFixture();
    const tx = {
      dispute: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
      productOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId,
          orderNumber: 'PO-DISPUTE-1',
          status: ProductOrderStatus.REFUNDED,
          sellerOrganisationId,
          farmerProfile: { userId: farmerUserId },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      returnRequest: { findFirst: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const notifications = { emitDisputeEvent: jest.fn().mockResolvedValue({}) };
    const service = createService(tx, audit, notifications);

    const result = await service.createDispute(
      {
        productOrderId: orderId,
        category: DisputeCategory.REFUND_AMOUNT,
        description: 'The final refund amount needs another review.',
      },
      farmerActor,
      'open-dispute-1',
      'request-dispute-1',
    );

    expect(result.id).toBe(disputeId);
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: expect.objectContaining({ status: ProductOrderStatus.DISPUTED }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISPUTE_CREATED', resourceId: disputeId }),
      tx,
    );
    expect(notifications.emitDisputeEvent).toHaveBeenCalled();
  });

  it('resolves for the farmer with a linked immutable adjustment and restores order status', async () => {
    const active = disputeFixture();
    const resolved = {
      ...active,
      status: DisputeStatus.RESOLVED_FOR_FARMER,
      resolutionOutcome: DisputeResolutionOutcome.FARMER,
      resolutionAmountPaise: 5_000,
      resolutionNote: 'Goodwill adjustment approved.',
      resolvedAt: new Date(),
    };
    const tx = {
      dispute: {
        findUnique: jest.fn().mockResolvedValueOnce(active).mockResolvedValueOnce(resolved),
        update: jest.fn().mockResolvedValue({}),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
      financialLedgerEntry: { create: jest.fn().mockResolvedValue({}) },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const notifications = { emitDisputeEvent: jest.fn().mockResolvedValue({}) };
    const service = createService(tx, audit, notifications);

    const result = await service.resolveDispute(
      disputeId,
      {
        outcome: DisputeResolutionOutcome.FARMER,
        resolutionAmountPaise: 5_000,
        resolutionNote: 'Goodwill adjustment approved.',
      },
      financeActor,
      'request-resolve-1',
    );

    expect(result.status).toBe(DisputeStatus.RESOLVED_FOR_FARMER);
    expect(tx.financialLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryType: FinancialLedgerEntryType.ADJUSTMENT,
        amountPaise: -5_000,
        productOrderId: orderId,
        disputeId,
      }),
    });
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.REFUNDED }),
      }),
    );
  });

  it('refuses a monetary award when the distributor wins', async () => {
    const tx = {
      dispute: { findUnique: jest.fn().mockResolvedValue(disputeFixture()) },
      productOrder: { update: jest.fn() },
      financialLedgerEntry: { create: jest.fn() },
    };
    const service = createService(
      tx,
      { record: jest.fn() },
      { emitDisputeEvent: jest.fn() },
    );

    await expect(
      service.resolveDispute(
        disputeId,
        {
          outcome: DisputeResolutionOutcome.DISTRIBUTOR,
          resolutionAmountPaise: 1,
          resolutionNote: 'Seller decision upheld.',
        },
        financeActor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.financialLedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.productOrder.update).not.toHaveBeenCalled();
  });

  it('refuses a seller-scoped list for another distributor organisation', async () => {
    const service = new DisputesService(
      {} as never,
      {
        hasPermission: jest.fn((_actor: CurrentUser, permission: PermissionCode) =>
          permission === PermissionCode.DISPUTES_READ_SELLER_OWN,
        ),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listDisputes(
        { distributorOrganisationId: '00000000-0000-4000-8000-000000003099' },
        distributorActor,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

function createService(tx: object, audit: object, notifications: object) {
  return new DisputesService(
    { $transaction: jest.fn((callback) => callback(tx)) } as never,
    { hasPermission: jest.fn().mockReturnValue(true) } as never,
    audit as never,
    notifications as never,
  );
}

function disputeFixture() {
  const createdAt = new Date('2026-08-18T12:00:00.000Z');
  return {
    id: disputeId,
    productOrderId: orderId,
    returnRequestId: null,
    farmerUserId,
    distributorOrganisationId: sellerOrganisationId,
    raisedByUserId: farmerUserId,
    raisedByRole: PlatformRole.FARMER,
    againstOrganisationId: sellerOrganisationId,
    status: DisputeStatus.OPEN,
    category: DisputeCategory.REFUND_AMOUNT,
    description: 'The final refund amount needs another review.',
    orderStatusBeforeDispute: ProductOrderStatus.REFUNDED,
    assignedToUserId: null,
    resolutionOutcome: null,
    resolutionNote: null,
    resolutionAmountPaise: null,
    resolvedAt: null,
    closedAt: null,
    idempotencyKey: 'open-dispute-1',
    requestHash: 'hash',
    createdAt,
    updatedAt: createdAt,
    returnRequest: null,
    events: [],
    productOrder: {
      orderNumber: 'PO-DISPUTE-1',
      sellerNameSnapshot: 'Seller',
      status: ProductOrderStatus.DISPUTED,
      farmerPayablePaise: 100_000,
    },
  };
}
