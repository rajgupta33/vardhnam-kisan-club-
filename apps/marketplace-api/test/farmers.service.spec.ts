import { ForbiddenException } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { FarmersService } from '../src/farmers/farmers.service';

const farmerUserId = '00000000-0000-4000-8000-000000003001';
const farmerOrganisationId = '00000000-0000-4000-8000-000000003002';

describe('FarmersService', () => {
  const farmerActor: CurrentUser = {
    userId: farmerUserId,
    role: PlatformRole.FARMER,
    membershipId: '00000000-0000-4000-8000-000000003003',
    organisationId: farmerOrganisationId,
    permissions: [
      PermissionCode.FARMER_PROFILE_READ_OWN,
      PermissionCode.FARMER_PROFILE_WRITE_OWN,
      PermissionCode.FARMER_ADDRESS_READ_OWN,
      PermissionCode.FARMER_ADDRESS_WRITE_OWN,
    ],
  };

  const accessService = {
    hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
      actor.permissions.includes(permission),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a farmer profile and records audit history', async () => {
    const profile = farmerProfileFixture();
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerProfile: {
        upsert: jest.fn().mockResolvedValue({ ...profile, addresses: [] }),
      },
    };
    const prisma = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new FarmersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.upsertMyProfile(
      {
        fullName: 'Ramesh Sharma',
        preferredLocale: 'hi-IN',
        primaryPincode: '302001',
        cropInterests: ['Bajra', 'Wheat', 'Bajra'],
      },
      farmerActor,
      'req-profile-create',
    );

    expect(result.fullName).toBe('Ramesh Sharma');
    expect(tx.farmerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: farmerUserId,
          cropInterests: ['Bajra', 'Wheat'],
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FARMER_PROFILE_CREATED',
        resourceType: 'FarmerProfile',
        resourceId: profile.id,
        requestId: 'req-profile-create',
      }),
      tx,
    );
  });

  it('creates the first farmer address as default and audits it', async () => {
    const profile = farmerProfileFixture();
    const address = farmerAddressFixture({ isDefault: true });
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerAddress: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue(address),
      },
    };
    const prisma = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
      farmerAddress: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new FarmersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createMyAddress(
      {
        label: 'Home',
        recipientName: 'Ramesh Sharma',
        phone: '+919999999999',
        addressLine1: 'Khasra 42, Rampura Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
      },
      farmerActor,
      'req-address-create',
    );

    expect(result.isDefault).toBe(true);
    expect(tx.farmerAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          farmerProfileId: profile.id,
          pincode: '302001',
          isDefault: true,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FARMER_ADDRESS_CREATED',
        resourceType: 'FarmerAddress',
        resourceId: address.id,
      }),
      tx,
    );
  });

  it('blocks non-farmer roles from farmer profile APIs even if a permission is present', async () => {
    const service = new FarmersService(
      {
        farmerProfile: {
          findUnique: jest.fn(),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.getMyProfile({
        ...farmerActor,
        role: PlatformRole.SUPPORT_AGENT,
        permissions: [PermissionCode.FARMER_PROFILE_READ_OWN],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function farmerProfileFixture() {
  return {
    id: 'farmer-profile-1',
    userId: farmerUserId,
    fullName: 'Ramesh Sharma',
    alternatePhone: null,
    preferredLocale: 'hi-IN',
    village: 'Rampura',
    district: 'Jaipur',
    state: 'Rajasthan',
    primaryPincode: '302001',
    cropInterests: ['Bajra', 'Wheat'],
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function farmerAddressFixture({ isDefault }: { isDefault: boolean }) {
  return {
    id: 'farmer-address-1',
    farmerProfileId: 'farmer-profile-1',
    label: 'Home',
    recipientName: 'Ramesh Sharma',
    phone: '+919999999999',
    addressLine1: 'Khasra 42, Rampura Road',
    addressLine2: null,
    village: 'Rampura',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    landmark: null,
    isDefault,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}
