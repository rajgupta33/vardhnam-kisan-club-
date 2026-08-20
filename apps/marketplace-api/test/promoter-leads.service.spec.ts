import { FarmerLeadSource, FarmerLeadStatus, PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { PromotersService } from '../src/promoters/promoters.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000001001',
  membershipId: '00000000-0000-4000-8000-000000001002',
  organisationId: '00000000-0000-4000-8000-000000001003',
  role: PlatformRole.PROMOTER,
  permissions: [],
};

const lead = {
  id: '00000000-0000-4000-8000-000000001004',
  promoterUserId: actor.userId,
  promoterOrganisationId: actor.organisationId,
  fullName: 'Ram Singh',
  phone: '+919876543210',
  source: FarmerLeadSource.FIELD_VISIT,
  status: FarmerLeadStatus.NEW,
  village: 'Nagla',
  district: 'Etah',
  state: 'Uttar Pradesh',
  pincode: '207001',
  cropInterests: ['Wheat'],
  notes: null,
  statusReason: null,
  contactedAt: null,
  convertedAt: null,
  lostAt: null,
  convertedFarmerProfileId: null,
  createdAt: new Date('2026-08-15T08:00:00.000Z'),
  updatedAt: new Date('2026-08-15T08:00:00.000Z'),
};

describe('PromotersService farmer leads', () => {
  it('returns no territory when the profile is outside the active organisation context', async () => {
    const prisma = {
      kisanClubPromoterProfile: {
        findUnique: jest.fn().mockResolvedValue({
          promoterUserId: actor.userId,
          promoterOrganisationId: 'another-organisation',
          territoryId: 'territory-1',
          territory: { id: 'territory-1' },
        }),
      },
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(service.getMyTerritory(actor)).resolves.toEqual({
      assigned: false,
      promoterUserId: actor.userId,
      promoterOrganisationId: actor.organisationId,
      territory: null,
    });
  });

  it('assigns an active territory without enabling Club operations and audits the change', async () => {
    const territory = {
      id: '00000000-0000-4000-8000-000000001010',
      name: 'Etah North',
      state: 'Uttar Pradesh',
      district: 'Etah',
      blocks: ['Sakit'],
      pincodes: ['207001'],
      villages: ['Nagla'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const profile = {
      id: '00000000-0000-4000-8000-000000001011',
      promoterUserId: actor.userId,
      promoterOrganisationId: actor.organisationId,
      territoryId: territory.id,
      territory,
      clubEnabled: false,
      acceptingNewFarmers: true,
      maxActiveFarmers: 150,
      activeFarmerCount: 0,
      homeVillage: null,
      homePincode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      kisanClubPromoterProfile: { upsert: jest.fn().mockResolvedValue(profile) },
    };
    const prisma = {
      organisationMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'membership' }) },
      promoterTerritory: { findUnique: jest.fn().mockResolvedValue(territory) },
      kisanClubPromoterProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new PromotersService(prisma as never, auditService as never, {} as never);

    const result = await service.assignTerritory(
      actor.userId,
      {
        promoterOrganisationId: actor.organisationId,
        territoryId: territory.id,
      },
      actor,
      'request-territory',
    );

    expect(result).toMatchObject({ assigned: true, territory: { id: territory.id } });
    expect(tx.kisanClubPromoterProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ clubEnabled: false, territoryId: territory.id }),
        update: { territoryId: territory.id },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTER_TERRITORY_ASSIGNED' }),
      tx,
    );
  });

  it('normalises and audits a promoter-owned lead without exposing its full phone in audit', async () => {
    const tx = { farmerLead: { create: jest.fn().mockResolvedValue(lead) } };
    const prisma = {
      farmerLead: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new PromotersService(prisma as never, auditService as never, {} as never);

    await service.createLead(
      {
        fullName: ' Ram Singh ',
        phone: '9876543210',
        source: FarmerLeadSource.FIELD_VISIT,
        cropInterests: [' Wheat ', 'Wheat'],
      },
      actor,
      'request-lead',
    );

    expect(tx.farmerLead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        promoterUserId: actor.userId,
        promoterOrganisationId: actor.organisationId,
        fullName: 'Ram Singh',
        phone: '+919876543210',
        cropInterests: ['Wheat'],
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FARMER_LEAD_CREATED',
        newValue: expect.objectContaining({ phone: '******3210' }),
      }),
      tx,
    );
  });

  it('does not allow one promoter to read another promoter lead', async () => {
    const prisma = {
      farmerLead: {
        findUnique: jest.fn().mockResolvedValue({ ...lead, promoterUserId: 'other-user' }),
      },
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(service.getLead(lead.id, actor)).rejects.toMatchObject({ status: 403 });
  });

  it('reserves CONVERTED for the verified conversion endpoint', async () => {
    const prisma = {
      farmerLead: { findUnique: jest.fn().mockResolvedValue(lead) },
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.updateLead(lead.id, { status: FarmerLeadStatus.CONVERTED }, actor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires a reason when a contacted lead is marked lost', async () => {
    const prisma = {
      farmerLead: {
        findUnique: jest.fn().mockResolvedValue({ ...lead, status: FarmerLeadStatus.CONTACTED }),
      },
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(
      service.updateLead(lead.id, { status: FarmerLeadStatus.LOST }, actor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires OTP registration before converting a contacted lead', async () => {
    const prisma = {
      farmerLead: {
        findUnique: jest.fn().mockResolvedValue({
          ...lead,
          status: FarmerLeadStatus.CONTACTED,
          contactedAt: new Date(),
        }),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      {} as never,
    );

    await expect(service.convertLead(lead.id, actor)).rejects.toMatchObject({ status: 409 });
  });

  it('derives assisted OTP registration identity from the owned contacted lead', async () => {
    const contacted = {
      ...lead,
      status: FarmerLeadStatus.CONTACTED,
      contactedAt: new Date(),
    };
    const prisma = {
      farmerLead: { findUnique: jest.fn().mockResolvedValue(contacted) },
    };
    const authService = {
      requestFarmerOtp: jest.fn().mockResolvedValue({ expiresAt: new Date().toISOString() }),
      verifyFarmerOtpForAssistance: jest.fn().mockResolvedValue({ userId: 'farmer-user' }),
    };
    const service = new PromotersService(
      prisma as never,
      { record: jest.fn() } as never,
      authService as never,
    );
    jest.spyOn(service, 'convertLead').mockResolvedValue({ lead: contacted } as never);

    await service.requestAssistedFarmerOtp(lead.id, actor, 'request-otp', '127.0.0.1');
    await service.verifyAssistedFarmerOtp(
      lead.id,
      { code: '123456', preferredLocale: 'hi-IN' },
      actor,
      'verify-otp',
    );

    expect(authService.requestFarmerOtp).toHaveBeenCalledWith(
      { phone: lead.phone },
      'request-otp',
      '127.0.0.1',
    );
    expect(authService.verifyFarmerOtpForAssistance).toHaveBeenCalledWith(
      {
        phone: lead.phone,
        code: '123456',
        fullName: lead.fullName,
        preferredLocale: 'hi-IN',
      },
      'verify-otp',
      actor,
    );
    expect(service.convertLead).toHaveBeenCalledWith(lead.id, actor, 'verify-otp');
  });

  it('atomically links a verified farmer, creates attribution and audits conversion', async () => {
    const farmerProfileId = '00000000-0000-4000-8000-000000001005';
    const farmerUserId = '00000000-0000-4000-8000-000000001006';
    const contacted = {
      ...lead,
      status: FarmerLeadStatus.CONTACTED,
      contactedAt: new Date('2026-08-15T09:00:00.000Z'),
    };
    const converted = {
      ...contacted,
      status: FarmerLeadStatus.CONVERTED,
      convertedAt: new Date('2026-08-16T09:00:00.000Z'),
      convertedFarmerProfileId: farmerProfileId,
      statusReason: 'Converted after farmer OTP registration',
    };
    const attribution = {
      id: '00000000-0000-4000-8000-000000001007',
      promoterUserId: actor.userId,
      promoterOrganisationId: actor.organisationId,
      farmerProfileId,
      status: 'ACTIVE',
    };
    const tx = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue({ organisationId: actor.organisationId }),
      },
      farmerProfile: { findUnique: jest.fn().mockResolvedValue({ id: farmerProfileId }) },
      promoterAttribution: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(attribution),
      },
      farmerLead: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(converted),
      },
    };
    const prisma = {
      farmerLead: { findUnique: jest.fn().mockResolvedValue(contacted) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: farmerUserId,
          farmerProfile: { id: farmerProfileId },
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new PromotersService(prisma as never, auditService as never, {} as never);

    const result = await service.convertLead(lead.id, actor, 'request-convert');

    expect(result).toMatchObject({
      lead: { status: FarmerLeadStatus.CONVERTED, convertedFarmerProfileId: farmerProfileId },
      farmerProfileId,
    });
    expect(tx.farmerLead.updateMany).toHaveBeenCalledWith({
      where: { id: lead.id, status: FarmerLeadStatus.CONTACTED },
      data: expect.objectContaining({
        status: FarmerLeadStatus.CONVERTED,
        convertedFarmerProfileId: farmerProfileId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FARMER_LEAD_CONVERTED' }),
      tx,
    );
  });
});
