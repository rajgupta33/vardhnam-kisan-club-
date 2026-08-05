import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KycDocumentStatus,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  type CompanyProfile,
  type DistributorProfile,
  type KycDocument,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { ApprovalQueueQueryDto } from './dto/approval-queue-query.dto';
import type { CreateKycDocumentDto } from './dto/create-kyc-document.dto';
import type { UpdateKycDocumentDto } from './dto/update-kyc-document.dto';
import type { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';
import type { UpsertDistributorProfileDto } from './dto/upsert-distributor-profile.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async summary(organisationId: string, actor: CurrentUser) {
    await this.ensureOnboardingRead(actor, organisationId);
    return this.findOrganisationSummaryOrThrow(organisationId);
  }

  async approvalQueue(query: ApprovalQueueQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildApprovalQueueWhere(query);

    const [organisations, total] = await this.prisma.$transaction([
      this.prisma.organisation.findMany({
        where,
        include: {
          companyProfile: true,
          distributorProfile: true,
          kycDocuments: true,
          reviewedBy: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.organisation.count({ where }),
    ]);

    return {
      items: organisations.map((organisation) => this.toQueueItem(organisation)),
      page,
      limit,
      total,
    };
  }

  async upsertCompanyProfile(
    organisationId: string,
    dto: UpsertCompanyProfileDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    await this.ensureOnboardingWrite(actor, organisationId);
    const organisation = await this.findOrganisationOrThrow(organisationId);
    this.ensureOrganisationType(organisation.type, OrganisationType.COMPANY);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.companyProfile.findUnique({
          where: { organisationId },
        });
        const profile = await tx.companyProfile.upsert({
          where: { organisationId },
          create: {
            organisationId,
            brandName: dto.brandName ?? null,
            registrationNumber: dto.registrationNumber ?? null,
            pan: dto.pan ?? null,
            primaryContactName: dto.primaryContactName,
            primaryContactPhone: dto.primaryContactPhone,
            primaryContactEmail: dto.primaryContactEmail ?? null,
            website: dto.website ?? null,
            registeredAddress: dto.registeredAddress ?? null,
            city: dto.city ?? null,
            state: dto.state ?? null,
            pincode: dto.pincode ?? null,
          },
          update: {
            brandName: dto.brandName ?? null,
            registrationNumber: dto.registrationNumber ?? null,
            pan: dto.pan ?? null,
            primaryContactName: dto.primaryContactName,
            primaryContactPhone: dto.primaryContactPhone,
            primaryContactEmail: dto.primaryContactEmail ?? null,
            website: dto.website ?? null,
            registeredAddress: dto.registeredAddress ?? null,
            city: dto.city ?? null,
            state: dto.state ?? null,
            pincode: dto.pincode ?? null,
          },
        });

        const auditInput = this.withActor(actor, {
          action: previous ? 'COMPANY_PROFILE_UPDATED' : 'COMPANY_PROFILE_CREATED',
          resourceType: 'CompanyProfile',
          resourceId: profile.id,
          organisationId,
          newValue: this.companyProfileAuditValue(profile),
        });
        if (previous) {
          auditInput.previousValue = this.companyProfileAuditValue(previous);
        }
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return profile;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Company profile conflicts with existing data');
      throw error;
    }
  }

  async upsertDistributorProfile(
    organisationId: string,
    dto: UpsertDistributorProfileDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    await this.ensureOnboardingWrite(actor, organisationId);
    const organisation = await this.findOrganisationOrThrow(organisationId);
    this.ensureOrganisationType(organisation.type, OrganisationType.DISTRIBUTOR);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.distributorProfile.findUnique({
          where: { organisationId },
        });
        const profile = await tx.distributorProfile.upsert({
          where: { organisationId },
          create: {
            organisationId,
            distributorCode: dto.distributorCode ?? null,
            pan: dto.pan ?? null,
            primaryContactName: dto.primaryContactName,
            primaryContactPhone: dto.primaryContactPhone,
            primaryContactEmail: dto.primaryContactEmail ?? null,
            operatingAddress: dto.operatingAddress ?? null,
            city: dto.city ?? null,
            state: dto.state ?? null,
            pincode: dto.pincode ?? null,
            serviceablePincodes: dto.serviceablePincodes ?? [],
            fulfilmentCapability: dto.fulfilmentCapability ?? null,
          },
          update: {
            distributorCode: dto.distributorCode ?? null,
            pan: dto.pan ?? null,
            primaryContactName: dto.primaryContactName,
            primaryContactPhone: dto.primaryContactPhone,
            primaryContactEmail: dto.primaryContactEmail ?? null,
            operatingAddress: dto.operatingAddress ?? null,
            city: dto.city ?? null,
            state: dto.state ?? null,
            pincode: dto.pincode ?? null,
            serviceablePincodes: dto.serviceablePincodes ?? [],
            fulfilmentCapability: dto.fulfilmentCapability ?? null,
          },
        });

        const auditInput = this.withActor(actor, {
          action: previous ? 'DISTRIBUTOR_PROFILE_UPDATED' : 'DISTRIBUTOR_PROFILE_CREATED',
          resourceType: 'DistributorProfile',
          resourceId: profile.id,
          organisationId,
          newValue: this.distributorProfileAuditValue(profile),
        });
        if (previous) {
          auditInput.previousValue = this.distributorProfileAuditValue(previous);
        }
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return profile;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(
        error,
        'Distributor profile conflicts with existing data',
      );
      throw error;
    }
  }

  async createKycDocument(
    organisationId: string,
    dto: CreateKycDocumentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    await this.ensureKycWrite(actor, organisationId);
    await this.ensureCompanyOrDistributorOrganisation(organisationId);

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.KycDocumentUncheckedCreateInput = {
        organisationId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber ?? null,
        fileName: dto.fileName ?? null,
        storageKey: dto.storageKey ?? null,
      };
      if (dto.issuedAt) {
        data.issuedAt = new Date(dto.issuedAt);
      }
      if (dto.expiresAt) {
        data.expiresAt = new Date(dto.expiresAt);
      }

      const document = await tx.kycDocument.create({
        data,
      });

      const auditInput = this.withActor(actor, {
        action: 'KYC_DOCUMENT_SUBMITTED',
        resourceType: 'KycDocument',
        resourceId: document.id,
        organisationId,
        newValue: this.kycDocumentAuditValue(document),
      });
      this.attachAuditContext(auditInput, requestId);
      await this.auditService.record(auditInput, tx);

      return document;
    });
  }

  async updateKycDocument(
    organisationId: string,
    documentId: string,
    dto: UpdateKycDocumentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.prisma.kycDocument.findFirst({
      where: {
        id: documentId,
        organisationId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'KYC document was not found',
      });
    }

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const isResubmission =
      statusChanged &&
      existing.status === KycDocumentStatus.REJECTED &&
      dto.status === KycDocumentStatus.SUBMITTED;
    const requiresReviewPermission =
      existing.status === KycDocumentStatus.APPROVED ||
      existing.status === KycDocumentStatus.EXPIRED ||
      (statusChanged && !isResubmission);

    if (requiresReviewPermission) {
      this.ensureKycReview(actor);
    } else {
      await this.ensureKycWrite(actor, organisationId);
    }

    if (dto.status === KycDocumentStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A rejection reason is required when rejecting a KYC document',
      });
    }
    if (dto.rejectionReason !== undefined && dto.status !== KycDocumentStatus.REJECTED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Rejection reason may only be provided when rejecting a KYC document',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.KycDocumentUpdateInput = {
        status: dto.status ?? existing.status,
        documentNumber: dto.documentNumber ?? existing.documentNumber,
        fileName: dto.fileName ?? existing.fileName,
        storageKey: dto.storageKey ?? existing.storageKey,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : existing.issuedAt,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt,
      };
      if (dto.status === KycDocumentStatus.REJECTED) {
        data.rejectionReason = dto.rejectionReason ?? null;
      } else if (isResubmission) {
        data.rejectionReason = null;
      }

      const updated = await tx.kycDocument.update({
        where: { id: documentId },
        data,
      });

      const action = requiresReviewPermission
        ? 'KYC_DOCUMENT_REVIEWED'
        : isResubmission
          ? 'KYC_DOCUMENT_RESUBMITTED'
          : 'KYC_DOCUMENT_UPDATED';
      const auditInput = this.withActor(actor, {
        action,
        resourceType: 'KycDocument',
        resourceId: updated.id,
        organisationId,
        previousValue: this.kycDocumentAuditValue(existing),
        newValue: this.kycDocumentAuditValue(updated),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason ?? dto.rejectionReason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });
  }

  private buildApprovalQueueWhere(query: ApprovalQueueQueryDto): Prisma.OrganisationWhereInput {
    const typeWhere = query.type
      ? query.type
      : {
          in: [OrganisationType.COMPANY, OrganisationType.DISTRIBUTOR],
        };
    const where: Prisma.OrganisationWhereInput = {
      type: typeWhere,
      status: query.status ?? OrganisationStatus.PENDING_VERIFICATION,
    };

    if (query.missingProfile) {
      if (query.type === OrganisationType.COMPANY) {
        where.companyProfile = { is: null };
      } else if (query.type === OrganisationType.DISTRIBUTOR) {
        where.distributorProfile = { is: null };
      } else {
        where.OR = [
          {
            type: OrganisationType.COMPANY,
            companyProfile: { is: null },
          },
          {
            type: OrganisationType.DISTRIBUTOR,
            distributorProfile: { is: null },
          },
        ];
      }
    }

    return where;
  }

  private toQueueItem(
    organisation: Prisma.OrganisationGetPayload<{
      include: {
        companyProfile: true;
        distributorProfile: true;
        kycDocuments: true;
        reviewedBy: { include: { profile: true } };
      };
    }>,
  ) {
    const hasProfile =
      organisation.type === OrganisationType.COMPANY
        ? organisation.companyProfile !== null
        : organisation.distributorProfile !== null;
    const approvedDocumentCount = organisation.kycDocuments.filter(
      (document) => document.status === KycDocumentStatus.APPROVED,
    ).length;
    const rejectedDocumentCount = organisation.kycDocuments.filter(
      (document) => document.status === KycDocumentStatus.REJECTED,
    ).length;
    const missingRequirements: string[] = [];

    if (!hasProfile) {
      missingRequirements.push('PROFILE');
    }
    if (organisation.kycDocuments.length === 0) {
      missingRequirements.push('KYC_DOCUMENT');
    }
    if (organisation.kycDocuments.length > 0 && approvedDocumentCount === 0) {
      missingRequirements.push('APPROVED_KYC_DOCUMENT');
    }

    return {
      organisation,
      hasProfile,
      submittedDocumentCount: organisation.kycDocuments.length,
      approvedDocumentCount,
      rejectedDocumentCount,
      missingRequirements,
    };
  }

  private async ensureOnboardingRead(actor: CurrentUser, organisationId: string): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.ONBOARDING_READ_ANY)) {
      return;
    }

    if (
      this.accessService.hasPermission(actor, PermissionCode.ONBOARDING_READ_OWN) &&
      actor.organisationId === organisationId
    ) {
      return;
    }

    throw this.forbidden('Onboarding read permission is required');
  }

  private async ensureOnboardingWrite(actor: CurrentUser, organisationId: string): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.ONBOARDING_WRITE_ANY)) {
      return;
    }

    if (
      this.accessService.hasPermission(actor, PermissionCode.ONBOARDING_WRITE_OWN) &&
      actor.organisationId === organisationId
    ) {
      return;
    }

    throw this.forbidden('Onboarding write permission is required');
  }

  private async ensureKycWrite(actor: CurrentUser, organisationId: string): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.KYC_DOCUMENTS_WRITE_ANY)) {
      return;
    }

    if (
      this.accessService.hasPermission(actor, PermissionCode.KYC_DOCUMENTS_WRITE_OWN) &&
      actor.organisationId === organisationId
    ) {
      return;
    }

    throw this.forbidden('KYC document write permission is required');
  }

  private ensureKycReview(actor: CurrentUser): void {
    if (!this.accessService.hasPermission(actor, PermissionCode.KYC_DOCUMENTS_REVIEW)) {
      throw this.forbidden('KYC review permission is required');
    }
  }

  private async findOrganisationSummaryOrThrow(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        companyProfile: true,
        distributorProfile: true,
        kycDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        reviewedBy: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Organisation was not found',
      });
    }

    return organisation;
  }

  private async findOrganisationOrThrow(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Organisation was not found',
      });
    }

    return organisation;
  }

  private async ensureCompanyOrDistributorOrganisation(organisationId: string): Promise<void> {
    const organisation = await this.findOrganisationOrThrow(organisationId);

    if (
      organisation.type !== OrganisationType.COMPANY &&
      organisation.type !== OrganisationType.DISTRIBUTOR
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message:
          'KYC onboarding documents are only supported for company and distributor organisations',
      });
    }
  }

  private ensureOrganisationType(actual: OrganisationType, expected: OrganisationType): void {
    if (actual !== expected) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Organisation must be ${expected} for this onboarding profile`,
      });
    }
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }

  private attachAuditContext(
    auditInput: AuditRecordInput,
    requestId?: string,
    reason?: string,
  ): void {
    if (requestId) {
      auditInput.requestId = requestId;
    }
    if (reason) {
      auditInput.reason = reason;
    }
  }

  private companyProfileAuditValue(profile: CompanyProfile): Prisma.InputJsonObject {
    return {
      brandName: profile.brandName,
      registrationNumber: profile.registrationNumber,
      pan: profile.pan,
      primaryContactName: profile.primaryContactName,
      primaryContactPhone: profile.primaryContactPhone,
      primaryContactEmail: profile.primaryContactEmail,
      website: profile.website,
      registeredAddress: profile.registeredAddress,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
    };
  }

  private distributorProfileAuditValue(profile: DistributorProfile): Prisma.InputJsonObject {
    return {
      distributorCode: profile.distributorCode,
      pan: profile.pan,
      primaryContactName: profile.primaryContactName,
      primaryContactPhone: profile.primaryContactPhone,
      primaryContactEmail: profile.primaryContactEmail,
      operatingAddress: profile.operatingAddress,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
      serviceablePincodes: profile.serviceablePincodes,
      fulfilmentCapability: profile.fulfilmentCapability,
    };
  }

  private kycDocumentAuditValue(document: KycDocument): Prisma.InputJsonObject {
    return {
      documentType: document.documentType,
      status: document.status,
      documentNumber: document.documentNumber,
      fileName: document.fileName,
      storageKey: document.storageKey,
      issuedAt: document.issuedAt?.toISOString() ?? null,
      expiresAt: document.expiresAt?.toISOString() ?? null,
      rejectionReason: document.rejectionReason,
    };
  }

  private throwConflictForKnownUniqueError(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message,
      });
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }
}
