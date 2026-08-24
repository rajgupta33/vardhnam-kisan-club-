import { BadRequestException, ConflictException } from '@nestjs/common';
import { MembershipStatus, OrganisationType, PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { OrganisationReviewDecision } from '../src/organisations/dto/review-organisation.dto';
import { OrganisationsService } from '../src/organisations/organisations.service';

describe('OrganisationsService', () => {
  const actor: CurrentUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    role: PlatformRole.SUPER_ADMIN,
    membershipId: '00000000-0000-0000-0000-000000000002',
    organisationId: '00000000-0000-0000-0000-000000000003',
    permissions: [],
  };

  it('projects only safe user identity fields from organisation reads', async () => {
    const organisation = {
      id: 'org-1',
      type: OrganisationType.DISTRIBUTOR,
      slug: 'demo-distributor',
      legalName: 'Demo Distributor Private Limited',
      displayName: 'Demo Distributor',
      gstin: null,
      registeredStateCode: null,
      gstinVerifiedAt: null,
      status: 'ACTIVE',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewedBy: null,
      reviewReason: null,
      createdAt: new Date('2026-08-24T00:00:00.000Z'),
      updatedAt: new Date('2026-08-24T00:00:00.000Z'),
      memberships: [],
    };
    const prisma = {
      organisation: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(organisation),
      },
      organisationMembership: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const service = new OrganisationsService(prisma as never, { record: jest.fn() } as never);

    await service.list({ page: 1, limit: 25 });
    await service.getById(organisation.id);
    await service.listMemberships(organisation.id);

    const listSelection = prisma.organisation.findMany.mock.calls[0]?.[0]?.select;
    const detailSelection = prisma.organisation.findUnique.mock.calls[0]?.[0]?.select;
    const membershipSelection = prisma.organisationMembership.findMany.mock.calls[0]?.[0]?.select;
    const expectedUserSelection = {
      id: true,
      email: true,
      phone: true,
      status: true,
      profile: { select: { displayName: true } },
    };

    expect(listSelection.reviewedBy.select).toEqual(expectedUserSelection);
    expect(detailSelection.reviewedBy.select).toEqual(expectedUserSelection);
    expect(detailSelection.memberships.select.user.select).toEqual(expectedUserSelection);
    expect(membershipSelection.user.select).toEqual(expectedUserSelection);
    expect(membershipSelection.organisation.select.reviewedBy.select).toEqual(
      expectedUserSelection,
    );
    expect(JSON.stringify({ listSelection, detailSelection, membershipSelection })).not.toContain(
      'passwordHash',
    );
  });

  it('creates an organisation with an audit log', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      organisation: {
        create: jest.fn().mockResolvedValue({
          id: 'org-1',
          type: OrganisationType.DISTRIBUTOR,
          slug: 'demo-distributor',
          status: 'PENDING_VERIFICATION',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OrganisationsService(prisma as never, auditService as never);

    const result = await service.create(
      {
        type: OrganisationType.DISTRIBUTOR,
        legalName: 'Demo Distributor Private Limited',
        displayName: 'Demo Distributor',
        gstin: '08abcde1234f1z5',
      },
      actor,
    );

    expect(result.id).toBe('org-1');
    expect(tx.organisation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gstin: '08ABCDE1234F1Z5',
        registeredStateCode: '08',
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORGANISATION_CREATED',
        resourceType: 'Organisation',
        resourceId: 'org-1',
      }),
      tx,
    );
  });

  it('prevents duplicate memberships', async () => {
    const auditService = { record: jest.fn() };
    const tx = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OrganisationsService(prisma as never, auditService as never);

    await expect(
      service.createMembership(
        'org-1',
        {
          userId: 'user-1',
          role: PlatformRole.DISTRIBUTOR_OWNER,
          status: MembershipStatus.ACTIVE,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves an organisation with review metadata and audit log', async () => {
    const reviewedAt = new Date('2026-08-01T00:00:00.000Z');

    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const existing = {
      id: 'org-1',
      type: OrganisationType.VARDHNAM,
      status: 'PENDING_VERIFICATION',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
    };
    const tx = {
      organisation: {
        update: jest.fn().mockResolvedValue({
          ...existing,
          status: 'ACTIVE',
          reviewedAt,
          reviewedByUserId: actor.userId,
          reviewReason: 'Verified',
        }),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OrganisationsService(prisma as never, auditService as never);

    const result = await service.review(
      'org-1',
      {
        decision: OrganisationReviewDecision.APPROVE,
        reason: 'Verified',
      },
      actor,
      'req-1',
    );

    expect(result.status).toBe('ACTIVE');
    expect(tx.organisation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          reviewedBy: {
            connect: {
              id: actor.userId,
            },
          },
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ORGANISATION_APPROVED',
        requestId: 'req-1',
        reason: 'Verified',
      }),
      tx,
    );
  });

  it('blocks company approval until onboarding profile and approved KYC exist', async () => {
    const auditService = { record: jest.fn() };
    const existing = {
      id: 'org-1',
      type: OrganisationType.COMPANY,
      status: 'PENDING_VERIFICATION',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
    };
    const tx = {
      companyProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      distributorProfile: {
        findUnique: jest.fn(),
      },
      kycDocument: {
        count: jest.fn().mockResolvedValue(0),
      },
      organisation: {
        update: jest.fn(),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OrganisationsService(prisma as never, auditService as never);

    await expect(
      service.review(
        'org-1',
        {
          decision: OrganisationReviewDecision.APPROVE,
          reason: 'Verified',
        },
        actor,
        'req-2',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.organisation.update).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('blocks distributor approval without a structurally valid GSTIN', async () => {
    const existing = {
      id: 'org-1',
      type: OrganisationType.DISTRIBUTOR,
      gstin: null,
      status: 'PENDING_VERIFICATION',
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      registeredStateCode: null,
      gstinVerifiedAt: null,
    };
    const prisma = { organisation: { findUnique: jest.fn().mockResolvedValue(existing) } };
    const service = new OrganisationsService(prisma as never, { record: jest.fn() } as never);

    await expect(
      service.review(
        existing.id,
        { decision: OrganisationReviewDecision.APPROVE, reason: 'Verified' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
