import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  KycDocumentStatus,
  KycDocumentType,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { OnboardingService } from '../src/onboarding/onboarding.service';

describe('OnboardingService', () => {
  const companyOrganisationId = '00000000-0000-0000-0000-000000000010';
  const distributorOrganisationId = '00000000-0000-0000-0000-000000000020';

  const operationsActor: CurrentUser = {
    userId: '00000000-0000-0000-0000-000000000001',
    role: PlatformRole.OPERATIONS_MANAGER,
    membershipId: '00000000-0000-0000-0000-000000000002',
    organisationId: '00000000-0000-0000-0000-000000000003',
    permissions: [
      PermissionCode.ONBOARDING_READ_ANY,
      PermissionCode.ONBOARDING_WRITE_ANY,
      PermissionCode.KYC_DOCUMENTS_WRITE_ANY,
      PermissionCode.KYC_DOCUMENTS_REVIEW,
    ],
  };

  const distributorOwnerActor: CurrentUser = {
    userId: '00000000-0000-0000-0000-000000000004',
    role: PlatformRole.DISTRIBUTOR_OWNER,
    membershipId: '00000000-0000-0000-0000-000000000005',
    organisationId: distributorOrganisationId,
    permissions: [
      PermissionCode.ONBOARDING_READ_OWN,
      PermissionCode.ONBOARDING_WRITE_OWN,
      PermissionCode.KYC_DOCUMENTS_WRITE_OWN,
    ],
  };

  const companyOrganisation = {
    id: companyOrganisationId,
    type: OrganisationType.COMPANY,
    slug: 'demo-company',
    legalName: 'Demo Seeds Private Limited',
    displayName: 'Demo Seeds',
    gstin: null,
    status: OrganisationStatus.PENDING_VERIFICATION,
  };

  const distributorOrganisation = {
    id: distributorOrganisationId,
    type: OrganisationType.DISTRIBUTOR,
    slug: 'demo-distributor',
    legalName: 'Demo Distributor Private Limited',
    displayName: 'Demo Distributor',
    gstin: null,
    status: OrganisationStatus.PENDING_VERIFICATION,
  };

  const accessService = {
    hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
      actor.permissions.includes(permission),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a company profile and records an audit event', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      companyProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'company-profile-1',
          organisationId: companyOrganisationId,
          brandName: 'Demo Seeds',
          registrationNumber: 'U01100RJ2026PTC000001',
          pan: 'ABCDE1234F',
          primaryContactName: 'Ramesh Sharma',
          primaryContactPhone: '+919999999999',
          primaryContactEmail: 'company@example.local',
          website: null,
          registeredAddress: null,
          city: null,
          state: null,
          pincode: null,
        }),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(companyOrganisation),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OnboardingService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.upsertCompanyProfile(
      companyOrganisationId,
      {
        brandName: 'Demo Seeds',
        registrationNumber: 'U01100RJ2026PTC000001',
        pan: 'ABCDE1234F',
        primaryContactName: 'Ramesh Sharma',
        primaryContactPhone: '+919999999999',
        primaryContactEmail: 'company@example.local',
        reason: 'Initial onboarding profile',
      },
      operationsActor,
      'req-1',
    );

    expect(result.id).toBe('company-profile-1');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMPANY_PROFILE_CREATED',
        resourceType: 'CompanyProfile',
        resourceId: 'company-profile-1',
        organisationId: companyOrganisationId,
        requestId: 'req-1',
        reason: 'Initial onboarding profile',
      }),
      tx,
    );
  });

  it('rejects company profile writes for distributor organisations', async () => {
    const service = new OnboardingService(
      {
        organisation: {
          findUnique: jest.fn().mockResolvedValue(distributorOrganisation),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.upsertCompanyProfile(
        distributorOrganisationId,
        {
          primaryContactName: 'Suresh Jain',
          primaryContactPhone: '+919999999999',
        },
        operationsActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks own-scope onboarding writes against another organisation', async () => {
    const service = new OnboardingService(
      {
        organisation: {
          findUnique: jest.fn(),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.upsertDistributorProfile(
        companyOrganisationId,
        {
          primaryContactName: 'Suresh Jain',
          primaryContactPhone: '+919999999999',
        },
        distributorOwnerActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('summarises distributor onboarding queues with missing requirements', async () => {
    const pendingDistributor = {
      ...distributorOrganisation,
      companyProfile: null,
      distributorProfile: null,
      reviewedBy: null,
      kycDocuments: [
        {
          id: 'kyc-1',
          status: KycDocumentStatus.REJECTED,
        },
      ],
    };
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([[pendingDistributor], 1]),
      organisation: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    prisma.organisation.findMany.mockReturnValue('find-many-query');
    prisma.organisation.count.mockReturnValue('count-query');

    const service = new OnboardingService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    const result = await service.approvalQueue({
      type: OrganisationType.DISTRIBUTOR,
      status: OrganisationStatus.PENDING_VERIFICATION,
      page: 1,
      limit: 25,
    });

    expect(prisma.organisation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: OrganisationType.DISTRIBUTOR,
          status: OrganisationStatus.PENDING_VERIFICATION,
        },
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        hasProfile: false,
        submittedDocumentCount: 1,
        approvedDocumentCount: 0,
        rejectedDocumentCount: 1,
        missingRequirements: ['PROFILE', 'APPROVED_KYC_DOCUMENT'],
      }),
    );
  });

  it('submits KYC document metadata and audits the submission', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      kycDocument: {
        create: jest.fn().mockResolvedValue({
          id: 'kyc-1',
          organisationId: distributorOrganisationId,
          documentType: KycDocumentType.GST_CERTIFICATE,
          status: KycDocumentStatus.SUBMITTED,
          documentNumber: '27ABCDE1234F1Z5',
          fileName: 'gst-certificate.pdf',
          storageKey: 'mock/kyc/gst-certificate.pdf',
          issuedAt: null,
          expiresAt: null,
          rejectionReason: null,
        }),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(distributorOrganisation),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OnboardingService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createKycDocument(
      distributorOrganisationId,
      {
        documentType: KycDocumentType.GST_CERTIFICATE,
        documentNumber: '27ABCDE1234F1Z5',
        fileName: 'gst-certificate.pdf',
        storageKey: 'mock/kyc/gst-certificate.pdf',
      },
      distributorOwnerActor,
      'req-2',
    );

    expect(result.status).toBe(KycDocumentStatus.SUBMITTED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KYC_DOCUMENT_SUBMITTED',
        resourceType: 'KycDocument',
        resourceId: 'kyc-1',
        organisationId: distributorOrganisationId,
        requestId: 'req-2',
      }),
      tx,
    );
  });

  it('requires review permission before approving KYC document metadata', async () => {
    const existingDocument = {
      id: 'kyc-1',
      organisationId: distributorOrganisationId,
      documentType: KycDocumentType.GST_CERTIFICATE,
      status: KycDocumentStatus.SUBMITTED,
      documentNumber: '27ABCDE1234F1Z5',
      fileName: 'gst-certificate.pdf',
      storageKey: 'mock/kyc/gst-certificate.pdf',
      issuedAt: null,
      expiresAt: null,
      rejectionReason: null,
    };
    const service = new OnboardingService(
      {
        kycDocument: {
          findFirst: jest.fn().mockResolvedValue(existingDocument),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.updateKycDocument(
        distributorOrganisationId,
        'kyc-1',
        { status: KycDocumentStatus.APPROVED },
        distributorOwnerActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows owners to resubmit rejected KYC metadata and clears the rejection reason', async () => {
    const existingDocument = {
      id: 'kyc-1',
      organisationId: distributorOrganisationId,
      documentType: KycDocumentType.GST_CERTIFICATE,
      status: KycDocumentStatus.REJECTED,
      documentNumber: '27ABCDE1234F1Z5',
      fileName: 'gst-certificate.pdf',
      storageKey: 'mock/kyc/gst-certificate.pdf',
      issuedAt: null,
      expiresAt: null,
      rejectionReason: 'Document is unreadable',
    };
    const updatedDocument = {
      ...existingDocument,
      status: KycDocumentStatus.SUBMITTED,
      rejectionReason: null,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      kycDocument: {
        update: jest.fn().mockResolvedValue(updatedDocument),
      },
    };
    const prisma = {
      kycDocument: {
        findFirst: jest.fn().mockResolvedValue(existingDocument),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OnboardingService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.updateKycDocument(
      distributorOrganisationId,
      'kyc-1',
      {
        status: KycDocumentStatus.SUBMITTED,
        fileName: 'gst-certificate-resubmitted.pdf',
        reason: 'Uploaded clearer document',
      },
      distributorOwnerActor,
      'req-4',
    );

    expect(result.status).toBe(KycDocumentStatus.SUBMITTED);
    expect(tx.kycDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KycDocumentStatus.SUBMITTED,
          rejectionReason: null,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KYC_DOCUMENT_RESUBMITTED',
        requestId: 'req-4',
        reason: 'Uploaded clearer document',
      }),
      tx,
    );
  });

  it('records KYC review decisions with previous and new values', async () => {
    const existingDocument = {
      id: 'kyc-1',
      organisationId: distributorOrganisationId,
      documentType: KycDocumentType.GST_CERTIFICATE,
      status: KycDocumentStatus.SUBMITTED,
      documentNumber: '27ABCDE1234F1Z5',
      fileName: 'gst-certificate.pdf',
      storageKey: 'mock/kyc/gst-certificate.pdf',
      issuedAt: null,
      expiresAt: null,
      rejectionReason: null,
    };
    const updatedDocument = {
      ...existingDocument,
      status: KycDocumentStatus.APPROVED,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      kycDocument: {
        update: jest.fn().mockResolvedValue(updatedDocument),
      },
    };
    const prisma = {
      kycDocument: {
        findFirst: jest.fn().mockResolvedValue(existingDocument),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OnboardingService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.updateKycDocument(
      distributorOrganisationId,
      'kyc-1',
      {
        status: KycDocumentStatus.APPROVED,
        reason: 'GST details verified',
      },
      operationsActor,
      'req-3',
    );

    expect(result.status).toBe(KycDocumentStatus.APPROVED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KYC_DOCUMENT_REVIEWED',
        previousValue: expect.objectContaining({ status: KycDocumentStatus.SUBMITTED }),
        newValue: expect.objectContaining({ status: KycDocumentStatus.APPROVED }),
        requestId: 'req-3',
        reason: 'GST details verified',
      }),
      tx,
    );
  });
});
