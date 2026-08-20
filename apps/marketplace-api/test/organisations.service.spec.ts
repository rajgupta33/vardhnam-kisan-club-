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
