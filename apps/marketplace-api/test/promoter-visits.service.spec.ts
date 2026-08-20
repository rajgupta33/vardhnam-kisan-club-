import {
  PlatformRole,
  PromoterVisitLocationStatus,
  PromoterVisitPurpose,
} from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { PromoterVisitsService } from '../src/promoters/promoter-visits.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000001001',
  membershipId: '00000000-0000-4000-8000-000000001002',
  organisationId: '00000000-0000-4000-8000-000000001003',
  role: PlatformRole.PROMOTER,
  permissions: [],
};

const leadId = '00000000-0000-4000-8000-000000001004';

describe('PromoterVisitsService', () => {
  it('records and audits an owned lead visit without copying coordinates into audit JSON', async () => {
    const occurredAt = new Date();
    const visit = {
      id: '00000000-0000-4000-8000-000000001005',
      promoterUserId: actor.userId,
      promoterOrganisationId: actor.organisationId,
      farmerLeadId: leadId,
      farmerProfileId: null,
      purpose: PromoterVisitPurpose.LEAD_FOLLOW_UP,
      notes: 'Discussed crop needs',
      occurredAt,
      locationStatus: PromoterVisitLocationStatus.GRANTED,
      latitude: 27.5,
      longitude: 78.6,
      accuracyMetres: 12,
      locationCapturedAt: occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      farmerLead: { id: leadId, fullName: 'Ram', phone: '+919876543210', status: 'CONTACTED' },
      farmerProfile: null,
    };
    const tx = { promoterVisit: { create: jest.fn().mockResolvedValue(visit) } };
    const prisma = {
      farmerLead: { findFirst: jest.fn().mockResolvedValue({ id: leadId }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new PromoterVisitsService(prisma as never, audit as never);

    await service.create(
      {
        farmerLeadId: leadId,
        purpose: PromoterVisitPurpose.LEAD_FOLLOW_UP,
        notes: ' Discussed crop needs ',
        occurredAt: occurredAt.toISOString(),
        locationStatus: PromoterVisitLocationStatus.GRANTED,
        latitude: 27.5,
        longitude: 78.6,
        accuracyMetres: 12,
        locationCapturedAt: occurredAt.toISOString(),
      },
      actor,
      'request-visit',
    );

    expect(prisma.farmerLead.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: leadId,
        promoterUserId: actor.userId,
        promoterOrganisationId: actor.organisationId,
      }),
      select: { id: true },
    });
    expect(tx.promoterVisit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notes: 'Discussed crop needs' }) }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTER_VISIT_RECORDED',
        newValue: expect.objectContaining({ hasPreciseLocation: true }),
      }),
      tx,
    );
    expect(audit.record.mock.calls[0][0].newValue).not.toHaveProperty('latitude');
  });

  it('requires exactly one visit target', async () => {
    const service = new PromoterVisitsService({} as never, {} as never);
    await expect(
      service.create(
        {
          purpose: PromoterVisitPurpose.OTHER,
          occurredAt: new Date().toISOString(),
          locationStatus: PromoterVisitLocationStatus.NOT_REQUESTED,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('does not accept location coordinates for a denied capture', async () => {
    const service = new PromoterVisitsService({} as never, {} as never);
    await expect(
      service.create(
        {
          farmerLeadId: leadId,
          purpose: PromoterVisitPurpose.LEAD_FOLLOW_UP,
          occurredAt: new Date().toISOString(),
          locationStatus: PromoterVisitLocationStatus.DENIED,
          latitude: 27.5,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('requires an active attribution for a farmer-profile visit', async () => {
    const prisma = {
      promoterAttribution: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new PromoterVisitsService(prisma as never, {} as never);
    await expect(
      service.create(
        {
          farmerProfileId: '00000000-0000-4000-8000-000000001006',
          purpose: PromoterVisitPurpose.FARMER_SUPPORT,
          occurredAt: new Date().toISOString(),
          locationStatus: PromoterVisitLocationStatus.NOT_REQUESTED,
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
