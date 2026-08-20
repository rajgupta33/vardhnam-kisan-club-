import {
  DeliveryPartnerAvailabilityStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  ProductOrderStatus,
  ReturnPickupAssignmentStatus,
  ReturnReasonCode,
  ReturnRequestStatus,
  UserStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { ReturnPickupsService } from '../src/return-pickups/return-pickups.service';

const assignmentId = '00000000-0000-4000-8000-000000009001';
const returnRequestId = '00000000-0000-4000-8000-000000009002';
const orderId = '00000000-0000-4000-8000-000000009003';
const partnerId = '00000000-0000-4000-8000-000000009004';
const sellerId = '00000000-0000-4000-8000-000000009005';
const farmerId = '00000000-0000-4000-8000-000000009006';

const operationsActor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000009010',
  role: PlatformRole.OPERATIONS_MANAGER,
  membershipId: '00000000-0000-4000-8000-000000009011',
  organisationId: '00000000-0000-4000-8000-000000009012',
  permissions: [PermissionCode.RETURN_PICKUPS_READ_ANY, PermissionCode.RETURN_PICKUPS_MANAGE_ANY],
};
const partnerActor: CurrentUser = {
  userId: partnerId,
  role: PlatformRole.DELIVERY_PARTNER,
  membershipId: '00000000-0000-4000-8000-000000009013',
  organisationId: '00000000-0000-4000-8000-000000009014',
  permissions: [PermissionCode.RETURN_PICKUPS_READ_OWN, PermissionCode.RETURN_PICKUPS_MANAGE_OWN],
};
const accessService = {
  hasPermission: (actor: CurrentUser, permission: PermissionCode) =>
    actor.permissions.includes(permission),
};

describe('ReturnPickupsService', () => {
  it('assigns an approved return only to an active online delivery partner', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const created = pickupFixture();
    const tx = {
      returnRequest: { findUnique: jest.fn().mockResolvedValue(approvedReturnFixture()) },
      user: { findUnique: jest.fn().mockResolvedValue(onlinePartnerFixture()) },
      returnPickupAssignment: {
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ ...created, returnRequest: returnSummary() }),
      },
    };
    const service = new ReturnPickupsService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      } as never,
      auditService as never,
      accessService as never,
      { emitFarmerEvent: jest.fn() } as never,
    );

    const result = await service.assign(
      returnRequestId,
      { deliveryPartnerUserId: partnerId, reason: 'Local pickup route' },
      operationsActor,
      'request-return-pickup-assign',
    );

    expect(result.status).toBe(ReturnPickupAssignmentStatus.ASSIGNED);
    expect(tx.returnPickupAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnRequestId,
          productOrderId: orderId,
          deliveryPartnerUserId: partnerId,
          pickupAddressSnapshot: expect.objectContaining({ pincode: '207247' }),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_PICKUP_ASSIGNED', resourceId: assignmentId }),
      tx,
    );
  });

  it('lets only the assigned partner collect an accepted pickup and advances return and order', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const notifications = { emitFarmerEvent: jest.fn().mockResolvedValue({}) };
    const accepted = pickupFixture(ReturnPickupAssignmentStatus.ACCEPTED);
    const collected = {
      ...accepted,
      status: ReturnPickupAssignmentStatus.COLLECTED,
      collectedAt: new Date(),
      collectionNote: 'Collected sealed package',
    };
    const tx = {
      returnPickupAssignment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ ...accepted, returnRequest: returnSummary() })
          .mockResolvedValueOnce({
            ...collected,
            returnRequest: { ...returnSummary(), status: ReturnRequestStatus.IN_TRANSIT },
          }),
        update: jest.fn().mockResolvedValue(collected),
      },
      returnRequest: { update: jest.fn().mockResolvedValue({}) },
      productOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new ReturnPickupsService(
      {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      } as never,
      auditService as never,
      accessService as never,
      notifications as never,
    );

    const result = await service.collect(
      assignmentId,
      { reason: 'Collected sealed package' },
      partnerActor,
      'request-return-pickup-collect',
    );

    expect(result.status).toBe(ReturnPickupAssignmentStatus.COLLECTED);
    expect(tx.returnRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ReturnRequestStatus.IN_TRANSIT }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ProductOrderStatus.RETURN_IN_TRANSIT }),
      }),
    );
    expect(notifications.emitFarmerEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ event: 'RETURN_IN_TRANSIT', recipientUserId: farmerId }),
    );
  });
});

function pickupFixture(
  status: ReturnPickupAssignmentStatus = ReturnPickupAssignmentStatus.ASSIGNED,
) {
  const now = new Date('2026-08-14T10:00:00.000Z');
  return {
    id: assignmentId,
    returnRequestId,
    productOrderId: orderId,
    distributorOrganisationId: sellerId,
    farmerUserId: farmerId,
    deliveryPartnerUserId: partnerId,
    assignmentNumber: 'RPU-20260814-TEST0001',
    status,
    orderNumberSnapshot: 'PO-RETURN-1',
    sellerNameSnapshot: 'Etah Distributor',
    pickupAddressSnapshot: {
      recipientName: 'Asha Devi',
      phone: '9876543210',
      addressLine1: 'Farm road',
      district: 'Etah',
      state: 'UP',
      pincode: '207247',
    },
    itemsSnapshot: [{ productName: 'Wheat seed', variantName: '10 kg', quantity: 1 }],
    assignedByUserId: operationsActor.userId,
    assignedByRole: PlatformRole.OPERATIONS_MANAGER,
    assignedAt: now,
    respondedByUserId: status === ReturnPickupAssignmentStatus.ACCEPTED ? partnerId : null,
    respondedByRole:
      status === ReturnPickupAssignmentStatus.ACCEPTED ? PlatformRole.DELIVERY_PARTNER : null,
    respondedAt: status === ReturnPickupAssignmentStatus.ACCEPTED ? now : null,
    rejectionReason: null,
    collectedByUserId: null,
    collectedByRole: null,
    collectedAt: null,
    collectionNote: null,
    createdAt: now,
    updatedAt: now,
  };
}

function returnSummary() {
  return {
    status: ReturnRequestStatus.APPROVED,
    reasonCode: ReturnReasonCode.QUALITY_ISSUE,
    reasonNote: 'Seal damaged',
  };
}

function approvedReturnFixture() {
  return {
    id: returnRequestId,
    productOrderId: orderId,
    farmerUserId: farmerId,
    distributorOrganisationId: sellerId,
    status: ReturnRequestStatus.APPROVED,
    pickupAssignment: null,
    productOrder: {
      id: orderId,
      status: ProductOrderStatus.RETURN_APPROVED,
      orderNumber: 'PO-RETURN-1',
      sellerNameSnapshot: 'Etah Distributor',
      deliveryAddressSnapshot: pickupFixture().pickupAddressSnapshot,
    },
    items: [
      {
        quantity: 1,
        productOrderItem: { productNameSnapshot: 'Wheat seed', variantNameSnapshot: '10 kg' },
      },
    ],
  };
}

function onlinePartnerFixture() {
  return {
    id: partnerId,
    status: UserStatus.ACTIVE,
    memberships: [
      {
        organisationId: partnerActor.organisationId,
        role: PlatformRole.DELIVERY_PARTNER,
        status: 'ACTIVE',
        organisation: {
          type: OrganisationType.DELIVERY_PARTNER,
          status: OrganisationStatus.ACTIVE,
        },
      },
    ],
    deliveryPartnerProfiles: [
      {
        organisationId: partnerActor.organisationId,
        availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      },
    ],
  };
}
