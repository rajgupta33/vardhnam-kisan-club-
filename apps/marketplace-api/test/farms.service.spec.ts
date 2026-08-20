import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  FarmOwnershipType,
  CropCycleStatus,
  KisanClubMembershipStatus,
  PlatformRole,
  Prisma,
} from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { FarmsService } from '../src/farms/farms.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000008001',
  role: PlatformRole.FARMER,
  membershipId: '00000000-0000-4000-8000-000000008002',
  organisationId: '00000000-0000-4000-8000-000000008003',
  permissions: [],
};

describe('FarmsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires precise-location consent before storing a coordinate pair', async () => {
    const prisma = {
      kisanClubMembership: { findFirst: jest.fn().mockResolvedValue(membershipFixture()) },
    };
    const service = new FarmsService(prisma as never, { record: jest.fn() } as never);

    await expect(
      service.createMyFarm(
        {
          name: 'North field',
          pincode: '207001',
          areaAcres: 3,
          ownershipType: FarmOwnershipType.OWNED,
          latitude: 27.55,
          longitude: 78.66,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates an owned farm and records audit in the same transaction', async () => {
    const farm = farmFixture();
    const tx = { farm: { create: jest.fn().mockResolvedValue({ ...farm, cropCycles: [] }) } };
    const prisma = {
      kisanClubMembership: {
        findFirst: jest.fn().mockResolvedValue(
          membershipFixture({ preciseLocationConsent: true }),
        ),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new FarmsService(prisma as never, auditService as never);

    const result = await service.createMyFarm(
      {
        name: ' North field ',
        pincode: '207001',
        areaAcres: 3,
        ownershipType: FarmOwnershipType.OWNED,
        latitude: 27.55,
        longitude: 78.66,
      },
      actor,
      'req-farm-create',
    );

    expect(result.id).toBe(farm.id);
    expect(tx.farm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          membershipId: farm.membershipId,
          farmerProfileId: farm.farmerProfileId,
          name: 'North field',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FARM_CREATED',
        resourceId: farm.id,
        requestId: 'req-farm-create',
      }),
      tx,
    );
  });

  it('does not reveal a farm owned by another membership', async () => {
    const prisma = {
      kisanClubMembership: { findFirst: jest.fn().mockResolvedValue(membershipFixture()) },
      farm: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new FarmsService(prisma as never, { record: jest.fn() } as never);

    await expect(
      service.listMyCropCycles('00000000-0000-4000-8000-000000008099', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires the dedicated harvest endpoint for harvested state', async () => {
    const farm = farmFixture();
    const prisma = {
      kisanClubMembership: { findFirst: jest.fn().mockResolvedValue(membershipFixture()) },
      farm: { findFirst: jest.fn().mockResolvedValue(farm) },
    };
    const service = new FarmsService(prisma as never, { record: jest.fn() } as never);

    await expect(
      service.createMyCropCycle(
        farm.id,
        {
          cropId: '00000000-0000-4000-8000-000000008020',
          areaAcres: 1,
          season: 'KHARIF_2026',
          status: CropCycleStatus.HARVESTED,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow a promoter to survey an unassigned farmer', async () => {
    const service = new FarmsService(
      {
        kisanClubPromoterAssignment: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      { record: jest.fn() } as never,
    );
    await expect(
      service.createAssignedFarmSurvey(
        {
          membershipId: '00000000-0000-4000-8000-000000008090',
          farm: {
            name: 'Surveyed farm',
            pincode: '207001',
            areaAcres: 2,
            ownershipType: FarmOwnershipType.OWNED,
          },
        },
        { ...actor, role: PlatformRole.PROMOTER },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires an active organisation-scoped attribution for a general survey', async () => {
    const service = new FarmsService(
      {
        promoterAttribution: { findFirst: jest.fn().mockResolvedValue(null) },
      } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createAttributedFarmSurvey(
        {
          farmerProfileId: '00000000-0000-4000-8000-000000008011',
          farm: {
            name: 'Surveyed farm',
            pincode: '207001',
            areaAcres: 2,
            ownershipType: FarmOwnershipType.OWNED,
          },
        },
        { ...actor, role: PlatformRole.PROMOTER },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a non-Club farm for an actively attributed farmer', async () => {
    const promoter = { ...actor, role: PlatformRole.PROMOTER };
    const attribution = {
      id: '00000000-0000-4000-8000-000000008030',
      farmerProfileId: '00000000-0000-4000-8000-000000008011',
    };
    const farm = { ...farmFixture(), membershipId: null, latitude: null, longitude: null };
    const tx = { farm: { create: jest.fn().mockResolvedValue(farm) } };
    const prisma = {
      promoterAttribution: { findFirst: jest.fn().mockResolvedValue(attribution) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new FarmsService(prisma as never, auditService as never);

    const result = await service.createAttributedFarmSurvey(
      {
        farmerProfileId: attribution.farmerProfileId,
        farm: {
          name: ' General survey ',
          pincode: '207001',
          areaAcres: 2,
          ownershipType: FarmOwnershipType.OWNED,
        },
      },
      promoter,
      'req-general-survey',
    );

    expect(result.farm.membershipId).toBeNull();
    expect(tx.farm.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        membershipId: null,
        farmerProfileId: attribution.farmerProfileId,
        name: 'General survey',
        latitude: null,
        longitude: null,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTER_FARM_SURVEY_CREATED',
        newValue: expect.objectContaining({ promoterAttributionId: attribution.id }),
      }),
      tx,
    );
  });

  it('rejects precise coordinates from a general attributed survey', async () => {
    const service = new FarmsService(
      {
        promoterAttribution: {
          findFirst: jest.fn().mockResolvedValue({
            id: '00000000-0000-4000-8000-000000008030',
            farmerProfileId: '00000000-0000-4000-8000-000000008011',
          }),
        },
      } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createAttributedFarmSurvey(
        {
          farmerProfileId: '00000000-0000-4000-8000-000000008011',
          farm: {
            name: 'Surveyed farm',
            pincode: '207001',
            areaAcres: 2,
            ownershipType: FarmOwnershipType.OWNED,
            latitude: 27.55,
            longitude: 78.66,
          },
        },
        { ...actor, role: PlatformRole.PROMOTER },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function membershipFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000008010',
    farmerProfileId: '00000000-0000-4000-8000-000000008011',
    memberNumber: 'VKC-20260811-TEST0001',
    status: KisanClubMembershipStatus.PENDING_PROFILE,
    homePincode: '207001',
    homeVillage: null,
    homeDistrict: null,
    homeState: null,
    joinedAt: new Date('2026-08-11T00:00:00.000Z'),
    termsVersion: 'v1',
    termsAcceptedAt: new Date('2026-08-11T00:00:00.000Z'),
    advisoryConsent: false,
    advisoryConsentAt: null,
    marketingConsent: false,
    marketingConsentAt: null,
    preciseLocationConsent: false,
    preciseLocationConsentAt: null,
    referredByMembershipId: null,
    suspendedReason: null,
    closedAt: null,
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    ...overrides,
  };
}

function farmFixture() {
  return {
    id: '00000000-0000-4000-8000-000000008012',
    membershipId: '00000000-0000-4000-8000-000000008010',
    farmerProfileId: '00000000-0000-4000-8000-000000008011',
    name: 'North field',
    village: null,
    district: null,
    state: null,
    pincode: '207001',
    areaAcres: new Prisma.Decimal(3),
    ownershipType: FarmOwnershipType.OWNED,
    irrigationSource: null,
    soilType: null,
    latitude: new Prisma.Decimal(27.55),
    longitude: new Prisma.Decimal(78.66),
    locationCapturedAt: new Date('2026-08-11T00:00:00.000Z'),
    isActive: true,
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
  };
}
