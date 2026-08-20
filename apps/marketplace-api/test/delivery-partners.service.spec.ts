import { DeliveryPartnerAvailabilityStatus, PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { DeliveryPartnersService } from '../src/delivery-partners/delivery-partners.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000009001',
  membershipId: '00000000-0000-4000-8000-000000009002',
  organisationId: '00000000-0000-4000-8000-000000009003',
  role: PlatformRole.DELIVERY_PARTNER,
  permissions: [],
};

describe('DeliveryPartnersService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns offline before the partner has created a profile', async () => {
    const prisma = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: actor.membershipId }),
      },
      deliveryPartnerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new DeliveryPartnersService(prisma as never, { record: jest.fn() } as never);

    await expect(service.getMyProfile(actor)).resolves.toMatchObject({
      userId: actor.userId,
      organisationId: actor.organisationId,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.OFFLINE,
    });
  });

  it('updates availability and audits it in the same transaction', async () => {
    const profile = {
      id: '00000000-0000-4000-8000-000000009004',
      userId: actor.userId,
      organisationId: actor.organisationId,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      availabilityChangedAt: new Date('2026-08-14T10:00:00.000Z'),
      createdAt: new Date('2026-08-14T10:00:00.000Z'),
      updatedAt: new Date('2026-08-14T10:00:00.000Z'),
    };
    const tx = {
      deliveryPartnerProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(profile),
      },
    };
    const prisma = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: actor.membershipId }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new DeliveryPartnersService(prisma as never, auditService as never);

    const result = await service.updateMyAvailability(
      { availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE },
      actor,
      'request-availability',
    );

    expect(result.availabilityStatus).toBe(DeliveryPartnerAvailabilityStatus.ONLINE);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELIVERY_PARTNER_AVAILABILITY_UPDATED',
        resourceId: profile.id,
        requestId: 'request-availability',
      }),
      tx,
    );
  });
});
