import { ConflictException, ForbiddenException } from '@nestjs/common';
import { KisanClubFulfilmentMode, KisanClubFulfilmentStatus, PlatformRole } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { KisanClubFulfilmentService } from '../src/kisan-club/fulfilment/kisan-club-fulfilment.service';

const promoterUserId = '00000000-0000-4000-8000-000000006001';
const otherPromoterUserId = '00000000-0000-4000-8000-000000006002';
const assignmentId = '00000000-0000-4000-8000-000000006003';
const orderId = '00000000-0000-4000-8000-000000006004';
const membershipId = '00000000-0000-4000-8000-000000006005';

const promoterActor: CurrentUser = {
  userId: promoterUserId,
  role: PlatformRole.PROMOTER,
  membershipId: '00000000-0000-4000-8000-000000006006',
  organisationId: '00000000-0000-4000-8000-000000006007',
  permissions: [
    PermissionCode.KISAN_CLUB_FULFILMENT_READ_OWN,
    PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_OWN,
  ],
};

const operationsActor: CurrentUser = {
  ...promoterActor,
  userId: '00000000-0000-4000-8000-000000006008',
  role: PlatformRole.OPERATIONS_MANAGER,
  permissions: [
    PermissionCode.KISAN_CLUB_FULFILMENT_READ_ANY,
    PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_ANY,
  ],
};

describe('KisanClubFulfilmentService', () => {
  it('creates one coordination assignment for a confirmed Club order', async () => {
    const tx = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(assignmentFixture()),
      },
      kisanClubPromoterAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          membershipId,
          promoterUserId,
          promoterUser: {
            kisanClubPromoterProfile: { promoterOrganisationId: 'promoter-org-1' },
          },
        }),
      },
      organisationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'org-member-1' }) },
      kisanClubBenefitToken: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = serviceWith({}, audit, true);

    await service.createForConfirmedOrders(
      tx as never,
      [
        {
          id: orderId,
          farmerProfileId: 'farmer-profile-1',
          sellerOrganisationId: 'seller-1',
          isKisanClubOrder: true,
        } as never,
      ],
      operationsActor,
      'request-assignment-create',
    );

    expect(tx.kisanClubFulfilmentAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productOrderId: orderId,
        membershipId,
        promoterUserId,
        mode: KisanClubFulfilmentMode.CLUB_HOME_DELIVERY,
        statusHistory: {
          create: expect.objectContaining({ toStatus: KisanClubFulfilmentStatus.ASSIGNED }),
        },
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'KISAN_CLUB_FULFILMENT_ASSIGNED' }),
      tx,
    );
  });

  it('does nothing when the feature flag is disabled', async () => {
    const tx = {
      kisanClubFulfilmentAssignment: { findUnique: jest.fn(), create: jest.fn() },
      kisanClubPromoterAssignment: { findFirst: jest.fn() },
    };
    const service = serviceWith({}, {}, false);

    await service.createForConfirmedOrders(tx as never, [{} as never], operationsActor);

    expect(tx.kisanClubFulfilmentAssignment.findUnique).not.toHaveBeenCalled();
  });

  it('marks token-created orders as assisted purchase coordination', async () => {
    const tx = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue(
            assignmentFixture({ mode: KisanClubFulfilmentMode.ASSISTED_PURCHASE }),
          ),
      },
      kisanClubPromoterAssignment: {
        findFirst: jest.fn().mockResolvedValue({
          membershipId,
          promoterUserId,
          promoterUser: {
            kisanClubPromoterProfile: { promoterOrganisationId: 'promoter-org-1' },
          },
        }),
      },
      organisationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'org-member-1' }) },
      kisanClubBenefitToken: { findUnique: jest.fn().mockResolvedValue({ id: 'token-1' }) },
    };
    const service = serviceWith(
      {},
      { record: jest.fn().mockResolvedValue({}) },
      true,
    );

    await service.createForConfirmedOrders(
      tx as never,
      [
        {
          id: orderId,
          farmerProfileId: 'farmer-profile-1',
          sellerOrganisationId: 'seller-1',
          isKisanClubOrder: true,
        } as never,
      ],
      operationsActor,
    );

    expect(tx.kisanClubFulfilmentAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mode: KisanClubFulfilmentMode.ASSISTED_PURCHASE }),
    });
  });

  it('allows the assigned promoter to accept without changing the product order', async () => {
    const current = assignmentFixture();
    const updated = assignmentFixture({
      status: KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
      acceptedAt: new Date('2026-08-11T12:00:00.000Z'),
    });
    const tx = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue(updated),
      },
      productOrder: { update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = serviceWith(prisma, audit, true);

    const result = await service.transition(
      assignmentId,
      KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
      {},
      promoterActor,
      'request-accept',
    );

    expect(result.status).toBe(KisanClubFulfilmentStatus.PROMOTER_ACCEPTED);
    expect(tx.productOrder.update).not.toHaveBeenCalled();
    expect(tx.kisanClubFulfilmentAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
          statusHistory: {
            create: expect.objectContaining({
              fromStatus: KisanClubFulfilmentStatus.ASSIGNED,
              toStatus: KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
            }),
          },
        }),
      }),
    );
  });

  it('rejects illegal lifecycle jumps', async () => {
    const tx = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest.fn().mockResolvedValue(assignmentFixture()),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = serviceWith(prisma, {}, true);

    await expect(
      service.transition(assignmentId, KisanClubFulfilmentStatus.COMPLETED, {}, promoterActor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not expose another promoter assignment through own permission', async () => {
    const prisma = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest
          .fn()
          .mockResolvedValue(assignmentFixture({ promoterUserId: otherPromoterUserId })),
      },
    };
    const service = serviceWith(prisma, {}, true);

    await expect(service.getAssignment(assignmentId, promoterActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reassigns explicitly while retaining both lifecycle events', async () => {
    const current = assignmentFixture({ status: KisanClubFulfilmentStatus.PROMOTER_DECLINED });
    const updated = assignmentFixture({ promoterUserId: otherPromoterUserId });
    const tx = {
      kisanClubFulfilmentAssignment: {
        findUnique: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue(updated),
      },
      kisanClubPromoterProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'profile-2',
          promoterOrganisationId: 'promoter-org-2',
        }),
      },
      organisationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'member-2' }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = serviceWith(prisma, audit, true);

    const result = await service.reassign(
      assignmentId,
      { promoterUserId: otherPromoterUserId, reason: 'Promoter declined this assignment' },
      operationsActor,
      'request-reassign',
    );

    expect(result.promoterUserId).toBe(otherPromoterUserId);
    expect(tx.kisanClubFulfilmentAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promoterUserId: otherPromoterUserId,
          status: KisanClubFulfilmentStatus.ASSIGNED,
          statusHistory: {
            create: [
              expect.objectContaining({
                fromStatus: KisanClubFulfilmentStatus.PROMOTER_DECLINED,
                toStatus: KisanClubFulfilmentStatus.REASSIGNED,
              }),
              expect.objectContaining({
                fromStatus: KisanClubFulfilmentStatus.REASSIGNED,
                toStatus: KisanClubFulfilmentStatus.ASSIGNED,
              }),
            ],
          },
        }),
      }),
    );
  });
});

function serviceWith(prisma: object, audit: object, enabled: boolean) {
  return new KisanClubFulfilmentService(
    prisma as never,
    audit as never,
    { get: jest.fn().mockReturnValue(enabled) } as never,
  );
}

function assignmentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: assignmentId,
    productOrderId: orderId,
    membershipId,
    promoterUserId,
    mode: KisanClubFulfilmentMode.CLUB_HOME_DELIVERY,
    status: KisanClubFulfilmentStatus.ASSIGNED,
    assignedAt: new Date('2026-08-11T10:00:00.000Z'),
    acceptedAt: null,
    completedAt: null,
    failureReason: null,
    productOrder: {
      orderNumber: 'VAG-ORDER-1',
      status: 'CONFIRMED',
      sellerOrganisationId: 'seller-1',
      sellerNameSnapshot: 'Distributor One',
      serviceablePincode: '302001',
      subtotalPaise: 10000,
      clubBenefitPaise: 1000,
      farmerPayablePaise: 9000,
      isKisanClubOrder: true,
      createdAt: new Date('2026-08-11T09:00:00.000Z'),
    },
    membership: {
      memberNumber: 'VKC-0001',
      status: 'ACTIVE',
      homeVillage: 'Village',
      homeDistrict: 'Jaipur',
      homeState: 'Rajasthan',
      homePincode: '302001',
      farmerProfile: { fullName: 'Farmer One' },
    },
    promoterUser: { profile: { displayName: 'Promoter One' } },
    statusHistory: [],
    createdAt: new Date('2026-08-11T10:00:00.000Z'),
    updatedAt: new Date('2026-08-11T10:00:00.000Z'),
    ...overrides,
  };
}
