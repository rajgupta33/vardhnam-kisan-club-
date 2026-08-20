import {
  PlatformRole,
  ProductOrderStatus,
  ReturnReasonCode,
  ReturnInspectionOutcome,
  ReturnRequestStatus,
  StoredFilePurpose,
  StoredFileScanResult,
  StoredFileStatus,
  type StoredFile,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { ReturnsService } from '../src/returns/returns.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000001001',
  membershipId: '00000000-0000-4000-8000-000000001002',
  organisationId: '00000000-0000-4000-8000-000000001003',
  role: PlatformRole.FARMER,
  permissions: [PermissionCode.RETURNS_READ_OWN],
};

describe('ReturnsService eligibility', () => {
  it('derives eligibility and the window from the delivered transition', async () => {
    const deliveredAt = new Date(Date.now() - 86_400_000);
    const service = serviceWithOrder(orderFixture(deliveredAt), 7);

    const result = await service.getMyReturnEligibility(orderId, actor);

    expect(result.eligible).toBe(true);
    expect(result.deliveredAt).toEqual(deliveredAt);
    expect(result.windowExpiresAt).toEqual(new Date(deliveredAt.getTime() + 7 * 86_400_000));
    expect(result.items).toEqual([
      expect.objectContaining({
        productOrderItemId: orderItemId,
        orderedQuantity: 2,
        unitPricePaise: 12500,
      }),
    ]);
  });

  it('rejects a delivered order after the configured return window', async () => {
    const service = serviceWithOrder(orderFixture(new Date(Date.now() - 2 * 86_400_000)), 1);

    const result = await service.getMyReturnEligibility(orderId, actor);

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('does not offer a second return request for the same child order', async () => {
    const order = orderFixture(new Date(Date.now() - 86_400_000));
    order.returnRequests = [{ id: returnRequestId }];
    const service = serviceWithOrder(order, 7);

    const result = await service.getMyReturnEligibility(orderId, actor);

    expect(result.eligible).toBe(false);
    expect(result.existingReturnRequestId).toBe(returnRequestId);
  });
});

describe('ReturnsService request creation', () => {
  it('calculates paise snapshots and writes histories and audit transactionally', async () => {
    const deliveredAt = new Date(Date.now() - 86_400_000);
    const order = orderFixture(deliveredAt);
    const createdAt = new Date();
    const createdRequest = {
      id: returnRequestId,
      productOrderId: orderId,
      status: 'REQUESTED',
      reasonCode: 'QUALITY_ISSUE',
      reasonNote: 'Seal was broken.',
      requestedAt: createdAt,
      windowExpiresAt: new Date(deliveredAt.getTime() + 7 * 86_400_000),
      refundableAmountPaise: 25000,
      createdAt,
      updatedAt: createdAt,
      productOrder: {
        orderNumber: order.orderNumber,
        sellerNameSnapshot: 'Seller',
      },
      items: [
        {
          id: '00000000-0000-4000-8000-000000001106',
          productOrderItemId: orderItemId,
          quantity: 2,
          unitPricePaise: 12500,
          lineRefundPaise: 25000,
          createdAt,
          productOrderItem: order.items[0],
        },
      ],
      statusHistory: [],
    };
    const tx = {
      farmerProfile: { findUnique: jest.fn().mockResolvedValue({ id: farmerProfileId }) },
      productOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue({}),
      },
      returnRequest: { create: jest.fn().mockResolvedValue(createdRequest) },
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const notifications = notificationEvents();
    const service = new ReturnsService(
      prisma as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      { getOrThrow: jest.fn().mockReturnValue(7) } as never,
      notifications as never,
    );

    const result = await service.createMyReturnRequest(
      {
        productOrderId: orderId,
        reasonCode: ReturnReasonCode.QUALITY_ISSUE,
        reasonNote: 'Seal was broken.',
        items: [{ productOrderItemId: orderItemId, quantity: 2 }],
      },
      { ...actor, permissions: [PermissionCode.RETURNS_CREATE_OWN] },
      'stable-return-key',
      'request-return-1',
    );

    expect(result.refundableAmountPaise).toBe(25000);
    expect(tx.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundableAmountPaise: 25000,
          items: {
            create: [
              expect.objectContaining({
                productOrderItemId: orderItemId,
                quantity: 2,
                unitPricePaise: 12500,
                lineRefundPaise: 25000,
              }),
            ],
          },
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: expect.objectContaining({ status: ProductOrderStatus.RETURN_REQUESTED }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_REQUEST_CREATED',
        resourceId: returnRequestId,
        requestId: 'request-return-1',
      }),
      tx,
    );
    expect(notifications.emitFarmerEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'RETURN_REQUESTED',
        recipientUserId: actor.userId,
        returnRequestId,
      }),
    );
  });
});

describe('ReturnsService operational transitions', () => {
  it('approves a seller return with matching order history and audit', async () => {
    const initial = operationalReturn(
      ReturnRequestStatus.REQUESTED,
      ProductOrderStatus.RETURN_REQUESTED,
    );
    const updated = operationalReturn(
      ReturnRequestStatus.APPROVED,
      ProductOrderStatus.RETURN_APPROVED,
    );
    const tx = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated),
        update: jest.fn().mockResolvedValue({}),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new ReturnsService(
      prisma as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      { getOrThrow: jest.fn() } as never,
      notificationEvents() as never,
    );

    const result = await service.approveReturnRequest(
      returnRequestId,
      { reason: 'Items verified against the order' },
      operationsActor,
      'request-approve-1',
    );

    expect(result.status).toBe(ReturnRequestStatus.APPROVED);
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReturnRequestStatus.APPROVED,
          statusHistory: {
            create: expect.objectContaining({
              fromStatus: ReturnRequestStatus.REQUESTED,
              toStatus: ReturnRequestStatus.APPROVED,
              requestId: 'request-approve-1',
            }),
          },
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.RETURN_APPROVED }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_REQUEST_APPROVED',
        resourceId: returnRequestId,
      }),
      tx,
    );
  });

  it('requires an explicit reason before rejecting a return', async () => {
    const service = new ReturnsService(
      {} as never,
      notificationEvents() as never,
      {} as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      {} as never,
    );

    await expect(
      service.rejectReturnRequest(returnRequestId, {}, operationsActor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('scopes a distributor return queue to the active seller organisation', async () => {
    const prisma = {
      returnRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((queries) => Promise.all(queries)),
    };
    const access = {
      hasPermission: jest.fn(
        (_actor, permission) => permission === PermissionCode.RETURNS_READ_SELLER_OWN,
      ),
    };
    const service = new ReturnsService(
      prisma as never,
      {} as never,
      access as never,
      {} as never,
      notificationEvents() as never,
    );

    await service.listReturnRequests({}, distributorActor);

    expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { distributorOrganisationId: sellerId } }),
    );
  });
});

describe('ReturnsService evidence attachments', () => {
  const storedFileId = '00000000-0000-4000-8000-000000001401';
  const evidenceId = '00000000-0000-4000-8000-000000001402';
  const createdAt = new Date('2026-08-18T10:00:00.000Z');

  function availableFile(ownerUserId = actor.userId): StoredFile {
    return {
      id: storedFileId,
      ownerUserId,
      organisationId: actor.organisationId,
      purpose: StoredFilePurpose.RETURN_EVIDENCE,
      status: StoredFileStatus.AVAILABLE,
      objectKey: `return-evidence/${storedFileId}.jpg`,
      originalFilename: 'damaged-pack.jpg',
      contentType: 'image/jpeg',
      declaredSizeBytes: 128,
      sizeBytes: 128,
      checksumSha256: 'a'.repeat(64),
      scanResult: StoredFileScanResult.CLEAN,
      scanCompletedAt: createdAt,
      rejectionReason: null,
      uploadedAt: createdAt,
      uploadUrlExpiresAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function evidence(file = availableFile()) {
    return {
      id: evidenceId,
      returnRequestId,
      storedFileId,
      uploadedByUserId: actor.userId,
      uploadedByRole: actor.role,
      caption: 'Broken seal',
      createdAt,
      storedFile: file,
    };
  }

  function evidenceService(input?: {
    file?: ReturnType<typeof availableFile>;
    existing?: ReturnType<typeof evidence> | null;
  }) {
    const file = input?.file ?? availableFile();
    const created = evidence(file);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: storedFileId }]),
      returnRequest: { findUnique: jest.fn().mockResolvedValue(operationalReturn(ReturnRequestStatus.REQUESTED, ProductOrderStatus.RETURN_REQUESTED)) },
      storedFile: {
        findUnique: jest.fn().mockResolvedValue(file),
        update: jest.fn().mockResolvedValue({ ...file, organisationId: sellerId }),
      },
      returnRequestEvidence: {
        findUnique: jest.fn().mockResolvedValue(input?.existing ?? null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new ReturnsService(
      { $transaction: jest.fn((callback) => callback(tx)) } as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      notificationEvents() as never,
    );
    return { service, tx, audit, created };
  }

  it('attaches a clean uploader-owned file and scopes it to the seller organisation', async () => {
    const { service, tx, audit } = evidenceService();

    const result = await service.attachEvidence(
      returnRequestId,
      { storedFileId, caption: 'Broken seal' },
      { ...actor, permissions: [PermissionCode.RETURNS_CREATE_OWN] },
      'request-evidence-1',
    );

    expect(result).toEqual(expect.objectContaining({ id: evidenceId, storedFileId }));
    expect(tx.storedFile.update).toHaveBeenCalledWith({
      where: { id: storedFileId },
      data: { organisationId: sellerId },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_EVIDENCE_ATTACHED',
        resourceId: returnRequestId,
        organisationId: sellerId,
        requestId: 'request-evidence-1',
      }),
      tx,
    );
  });

  it('returns the existing attachment on an identical retry without another write or audit', async () => {
    const existing = evidence();
    const { service, tx, audit } = evidenceService({ existing });

    const result = await service.attachEvidence(
      returnRequestId,
      { storedFileId, caption: 'Ignored on retry' },
      { ...actor, permissions: [PermissionCode.RETURNS_CREATE_OWN] },
    );

    expect(result.id).toBe(evidenceId);
    expect(tx.returnRequestEvidence.create).not.toHaveBeenCalled();
    expect(tx.storedFile.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a file that has not cleared scanning', async () => {
    const file = { ...availableFile(), status: StoredFileStatus.PENDING_SCAN };
    const { service } = evidenceService({ file });

    await expect(
      service.attachEvidence(
        returnRequestId,
        { storedFileId },
        { ...actor, permissions: [PermissionCode.RETURNS_CREATE_OWN] },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a file uploaded by another user', async () => {
    const file = availableFile(operationsActor.userId);
    const { service } = evidenceService({ file });

    await expect(
      service.attachEvidence(
        returnRequestId,
        { storedFileId },
        { ...actor, permissions: [PermissionCode.RETURNS_CREATE_OWN] },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows the return seller to attach its own scan-cleared inspection evidence', async () => {
    const file = availableFile(distributorActor.userId);
    const { service, tx } = evidenceService({ file });

    await service.attachEvidence(
      returnRequestId,
      { storedFileId, caption: 'Inspection photo' },
      distributorActor,
    );

    expect(tx.returnRequestEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnRequestId,
          storedFileId,
          uploadedByUserId: distributorActor.userId,
          uploadedByRole: distributorActor.role,
        }),
      }),
    );
  });
});

describe('ReturnsService farmer cancellation', () => {
  it('cancels before pickup and restores the child order to delivered', async () => {
    const initial = operationalReturn(
      ReturnRequestStatus.APPROVED,
      ProductOrderStatus.RETURN_APPROVED,
    );
    const updated = operationalReturn(ReturnRequestStatus.CANCELLED, ProductOrderStatus.DELIVERED);
    const tx = {
      farmerProfile: { findUnique: jest.fn().mockResolvedValue({ id: farmerProfileId }) },
      returnRequest: {
        findFirst: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated),
        update: jest.fn().mockResolvedValue({}),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new ReturnsService(
      prisma as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      notificationEvents() as never,
    );

    const result = await service.cancelMyReturnRequest(
      returnRequestId,
      {},
      { ...actor, permissions: [PermissionCode.RETURNS_CANCEL_OWN] },
      'stable-cancel-key',
      'request-cancel-1',
    );

    expect(result.status).toBe(ReturnRequestStatus.CANCELLED);
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.DELIVERED }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_REQUEST_CANCELLED_BY_FARMER' }),
      tx,
    );
  });
});

describe('ReturnsService inspection', () => {
  it('allocates returned quantities to original batches without making quarantine sellable', async () => {
    const initial = receivedInspectionReturn();
    const updated = {
      ...initial,
      status: ReturnRequestStatus.INSPECTED,
      approvedRefundAmountPaise: 37500,
      inspectedAt: new Date(),
    };
    let dispositionSequence = 0;
    let movementSequence = 0;
    const tx = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated),
        update: jest.fn().mockResolvedValue({}),
      },
      returnInspectionDisposition: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: `disposition-${++dispositionSequence}`,
          ...data,
        })),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue({ balanceAfter: 5 }),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: `movement-${++movementSequence}`,
          ...data,
        })),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new ReturnsService(
      prisma as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      notificationEvents() as never,
    );

    const result = await service.inspectReturnRequest(
      returnRequestId,
      {
        inspectionNote: 'Batch labels and seals checked',
        dispositions: [
          {
            returnRequestItemId: returnRequestItemId,
            reservationId,
            outcome: ReturnInspectionOutcome.RESTOCKABLE,
            quantity: 1,
          },
          {
            returnRequestItemId: returnRequestItemId,
            reservationId,
            outcome: ReturnInspectionOutcome.QUARANTINED,
            quantity: 1,
          },
          {
            returnRequestItemId: returnRequestItemId,
            reservationId,
            outcome: ReturnInspectionOutcome.DAMAGED_WRITE_OFF,
            quantity: 1,
          },
        ],
      },
      operationsActor,
      'request-inspect-1',
    );

    expect(result.status).toBe(ReturnRequestStatus.INSPECTED);
    expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'RETURN_RESTOCKED',
          quantityDelta: 1,
          balanceAfter: 6,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'RETURN_QUARANTINED',
          quantityDelta: 0,
          balanceAfter: 6,
        }),
      }),
    );
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReturnRequestStatus.INSPECTED,
          approvedRefundAmountPaise: 37500,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'DAMAGE_WRITE_OFF',
          quantityDelta: 0,
          balanceAfter: 6,
        }),
      }),
    );
    expect(tx.productOrder.update).not.toHaveBeenCalled();
  });

  it('completes a fully rejected return without changing inventory or approving a refund', async () => {
    const initial = receivedInspectionReturn();
    const updated = {
      ...initial,
      status: ReturnRequestStatus.COMPLETED,
      approvedRefundAmountPaise: 0,
      inspectedAt: new Date(),
    };
    const tx = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(updated),
        update: jest.fn().mockResolvedValue({}),
      },
      returnInspectionDisposition: {
        create: jest.fn().mockResolvedValue({ id: 'disposition-rejected' }),
        update: jest.fn(),
      },
      inventoryMovement: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new ReturnsService(
      prisma as never,
      audit as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      notificationEvents() as never,
    );

    const result = await service.inspectReturnRequest(
      returnRequestId,
      {
        inspectionNote: 'The submitted goods do not match the approved return',
        dispositions: [
          {
            returnRequestItemId,
            reservationId,
            outcome: ReturnInspectionOutcome.REJECTED_RETURN,
            quantity: 3,
          },
        ],
      },
      operationsActor,
      'request-inspect-rejected',
    );

    expect(result.status).toBe(ReturnRequestStatus.COMPLETED);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReturnRequestStatus.COMPLETED,
          approvedRefundAmountPaise: 0,
          statusHistory: {
            create: expect.arrayContaining([
              expect.objectContaining({ toStatus: ReturnRequestStatus.INSPECTED }),
              expect.objectContaining({ toStatus: ReturnRequestStatus.COMPLETED }),
            ]),
          },
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.DELIVERED }),
      }),
    );
  });
});

function serviceWithOrder(order: ReturnType<typeof orderFixture>, returnWindowDays: number) {
  const prisma = {
    farmerProfile: { findUnique: jest.fn().mockResolvedValue({ id: farmerProfileId }) },
    productOrder: { findFirst: jest.fn().mockResolvedValue(order) },
  };
  return new ReturnsService(
    prisma as never,
    { record: jest.fn() } as never,
    { hasPermission: jest.fn().mockReturnValue(true) } as never,
    { getOrThrow: jest.fn().mockReturnValue(returnWindowDays) } as never,
    notificationEvents() as never,
  );
}

function notificationEvents() {
  return { emitFarmerEvent: jest.fn().mockResolvedValue({}) };
}

function orderFixture(deliveredAt: Date) {
  return {
    id: orderId,
    orderNumber: 'VA-RETURN-1',
    status: ProductOrderStatus.DELIVERED,
    sellerOrganisationId: sellerId,
    statusHistory: [
      {
        toStatus: ProductOrderStatus.DELIVERED,
        createdAt: deliveredAt,
      },
    ],
    returnRequests: [] as Array<{ id: string }>,
    items: [
      {
        id: orderItemId,
        productOrderId: orderId,
        productNameSnapshot: 'Bajra seed',
        variantNameSnapshot: '1 kg',
        quantity: 2,
        unitPricePaise: 12500,
        lineTotalPaise: 25000,
      },
    ],
  };
}

const orderId = '00000000-0000-4000-8000-000000001101';
const orderItemId = '00000000-0000-4000-8000-000000001102';
const farmerProfileId = '00000000-0000-4000-8000-000000001103';
const sellerId = '00000000-0000-4000-8000-000000001104';
const returnRequestId = '00000000-0000-4000-8000-000000001105';
const returnRequestItemId = '00000000-0000-4000-8000-000000001106';
const reservationId = '00000000-0000-4000-8000-000000001107';
const batchId = '00000000-0000-4000-8000-000000001108';

const operationsActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000001201',
  membershipId: '00000000-0000-4000-8000-000000001202',
  organisationId: '00000000-0000-4000-8000-000000001203',
  role: PlatformRole.OPERATIONS_MANAGER,
  permissions: [PermissionCode.RETURNS_READ_ANY, PermissionCode.RETURNS_MANAGE_ANY],
};

const distributorActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000001301',
  membershipId: '00000000-0000-4000-8000-000000001302',
  organisationId: sellerId,
  role: PlatformRole.DISTRIBUTOR_OWNER,
  permissions: [PermissionCode.RETURNS_READ_SELLER_OWN, PermissionCode.RETURNS_MANAGE_SELLER_OWN],
};

function operationalReturn(status: ReturnRequestStatus, orderStatus: ProductOrderStatus) {
  const createdAt = new Date('2026-08-11T08:00:00.000Z');
  return {
    id: returnRequestId,
    productOrderId: orderId,
    farmerProfileId,
    farmerUserId: actor.userId,
    distributorOrganisationId: sellerId,
    status,
    reasonCode: ReturnReasonCode.QUALITY_ISSUE,
    reasonNote: 'Packaging was open.',
    requestedAt: createdAt,
    windowExpiresAt: new Date('2026-08-18T08:00:00.000Z'),
    refundableAmountPaise: 37500,
    createdAt,
    updatedAt: createdAt,
    productOrder: {
      orderNumber: 'VA-RETURN-1',
      sellerNameSnapshot: 'Seller',
      status: orderStatus,
    },
    items: [],
    statusHistory: [],
  };
}

function receivedInspectionReturn() {
  const base = operationalReturn(ReturnRequestStatus.RECEIVED, ProductOrderStatus.RETURNED);
  return {
    ...base,
    approvedRefundAmountPaise: null,
    inspectedByUserId: null,
    inspectedAt: null,
    inspectionNote: null,
    inspectionDispositions: [],
    items: [
      {
        id: returnRequestItemId,
        returnRequestId,
        productOrderItemId: orderItemId,
        quantity: 3,
        unitPricePaise: 12500,
        lineRefundPaise: 37500,
        createdAt: base.createdAt,
        productOrderItem: {
          id: orderItemId,
          productNameSnapshot: 'Bajra seed',
          variantNameSnapshot: '1 kg',
          reservations: [
            {
              id: reservationId,
              productOrderItemId: orderItemId,
              batchId,
              inventoryMovementId: '00000000-0000-4000-8000-000000001109',
              quantity: 3,
              createdAt: base.createdAt,
              batch: {
                id: batchId,
                distributorOrganisationId: sellerId,
                warehouseId: '00000000-0000-4000-8000-000000001110',
                productId: '00000000-0000-4000-8000-000000001111',
                variantId: '00000000-0000-4000-8000-000000001112',
                batchNumber: 'BATCH-1',
                manufacturingDate: null,
                expiryDate: new Date('2027-08-11T00:00:00.000Z'),
                germinationPercentage: null,
                status: 'ACTIVE',
                blockedReason: null,
                createdAt: base.createdAt,
                updatedAt: base.createdAt,
              },
            },
          ],
        },
      },
    ],
  };
}
