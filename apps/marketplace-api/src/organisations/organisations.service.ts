import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KycDocumentStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  Prisma,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { gstStateCode, normalizeGstin } from '../common/india-gst';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import type { ListOrganisationsQueryDto } from './dto/list-organisations-query.dto';
import {
  OrganisationReviewDecision,
  type ReviewOrganisationDto,
} from './dto/review-organisation.dto';
import type { UpdateMembershipDto } from './dto/update-membership.dto';
import type { UpdateOrganisationDto } from './dto/update-organisation.dto';

const safeUserIdentitySelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  profile: { select: { displayName: true } },
} satisfies Prisma.UserSelect;

const organisationResponseSelect = {
  id: true,
  type: true,
  slug: true,
  legalName: true,
  displayName: true,
  gstin: true,
  registeredStateCode: true,
  gstinVerifiedAt: true,
  status: true,
  reviewedAt: true,
  reviewedByUserId: true,
  reviewReason: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: { select: safeUserIdentitySelect },
} satisfies Prisma.OrganisationSelect;

const membershipResponseSelect = {
  id: true,
  userId: true,
  organisationId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: safeUserIdentitySelect },
} satisfies Prisma.OrganisationMembershipSelect;

@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ListOrganisationsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.OrganisationWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      where.OR = [
        { slug: { contains: query.q, mode: 'insensitive' } },
        { legalName: { contains: query.q, mode: 'insensitive' } },
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { gstin: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.organisation.findMany({
        where,
        select: organisationResponseSelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.organisation.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async getById(organisationId: string) {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        ...organisationResponseSelect,
        memberships: {
          select: membershipResponseSelect,
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

  async create(dto: CreateOrganisationDto, actor: CurrentUser, requestId?: string) {
    const gstin = dto.gstin ? normalizeGstin(dto.gstin) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organisation = await tx.organisation.create({
          data: {
            type: dto.type,
            slug: dto.slug ?? this.slugify(dto.displayName),
            legalName: dto.legalName,
            displayName: dto.displayName,
            gstin,
            registeredStateCode: gstin ? gstStateCode(gstin) : null,
            status: dto.status ?? OrganisationStatus.PENDING_VERIFICATION,
          },
        });

        const auditInput = this.withActor(actor, {
          action: 'ORGANISATION_CREATED',
          resourceType: 'Organisation',
          resourceId: organisation.id,
          organisationId: organisation.id,
          newValue: {
            type: organisation.type,
            slug: organisation.slug,
            status: organisation.status,
          } satisfies Prisma.InputJsonObject,
        });

        this.attachAuditContext(auditInput, requestId);
        await this.auditService.record(auditInput, tx);

        return organisation;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Organisation slug already exists');
      throw error;
    }
  }

  async update(
    organisationId: string,
    dto: UpdateOrganisationDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findOrganisationOrThrow(organisationId);

    const data: Prisma.OrganisationUpdateInput = {};
    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }
    if (dto.legalName !== undefined) {
      data.legalName = dto.legalName;
    }
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.gstin !== undefined) {
      const gstin = normalizeGstin(dto.gstin);
      data.gstin = gstin;
      data.registeredStateCode = gstStateCode(gstin);
      if (gstin !== existing.gstin) {
        data.gstinVerifiedAt = null;
        if (existing.status === OrganisationStatus.ACTIVE) {
          data.status = OrganisationStatus.PENDING_VERIFICATION;
          data.reviewedAt = null;
          data.reviewedBy = { disconnect: true };
          data.reviewReason = null;
        }
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organisation = await tx.organisation.update({
          where: { id: organisationId },
          data,
        });

        const auditInput = this.withActor(actor, {
          action: 'ORGANISATION_UPDATED',
          resourceType: 'Organisation',
          resourceId: organisation.id,
          organisationId: organisation.id,
          previousValue: {
            slug: existing.slug,
            legalName: existing.legalName,
            displayName: existing.displayName,
            gstin: existing.gstin,
            registeredStateCode: existing.registeredStateCode,
            gstinVerifiedAt: existing.gstinVerifiedAt?.toISOString() ?? null,
            status: existing.status,
          } satisfies Prisma.InputJsonObject,
          newValue: {
            slug: organisation.slug,
            legalName: organisation.legalName,
            displayName: organisation.displayName,
            gstin: organisation.gstin,
            registeredStateCode: organisation.registeredStateCode,
            gstinVerifiedAt: organisation.gstinVerifiedAt?.toISOString() ?? null,
            status: organisation.status,
          } satisfies Prisma.InputJsonObject,
        });

        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return organisation;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Organisation slug already exists');
      throw error;
    }
  }

  async review(
    organisationId: string,
    dto: ReviewOrganisationDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findOrganisationOrThrow(organisationId);
    const nextStatus =
      dto.decision === OrganisationReviewDecision.APPROVE
        ? OrganisationStatus.ACTIVE
        : OrganisationStatus.REJECTED;
    const action =
      dto.decision === OrganisationReviewDecision.APPROVE
        ? 'ORGANISATION_APPROVED'
        : 'ORGANISATION_REJECTED';
    const verifiedStateCode =
      dto.decision === OrganisationReviewDecision.APPROVE && existing.gstin
        ? gstStateCode(existing.gstin)
        : null;
    if (
      dto.decision === OrganisationReviewDecision.APPROVE &&
      existing.type === OrganisationType.DISTRIBUTOR &&
      !verifiedStateCode
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor approval requires a valid GSTIN with a registered state code',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.decision === OrganisationReviewDecision.APPROVE) {
        await this.ensureOnboardingReadyForApproval(tx, existing.id, existing.type);
      }

      const organisation = await tx.organisation.update({
        where: { id: organisationId },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedBy: {
            connect: {
              id: actor.userId,
            },
          },
          reviewReason: dto.reason ?? null,
          registeredStateCode: verifiedStateCode,
          gstinVerifiedAt:
            dto.decision === OrganisationReviewDecision.APPROVE && verifiedStateCode
              ? new Date()
              : null,
        },
      });

      const auditInput = this.withActor(actor, {
        action,
        resourceType: 'Organisation',
        resourceId: organisation.id,
        organisationId: organisation.id,
        previousValue: {
          status: existing.status,
          reviewedAt: existing.reviewedAt?.toISOString() ?? null,
          reviewedByUserId: existing.reviewedByUserId,
          reviewReason: existing.reviewReason,
          registeredStateCode: existing.registeredStateCode,
          gstinVerifiedAt: existing.gstinVerifiedAt?.toISOString() ?? null,
        } satisfies Prisma.InputJsonObject,
        newValue: {
          status: organisation.status,
          reviewedAt: organisation.reviewedAt?.toISOString() ?? null,
          reviewedByUserId: organisation.reviewedByUserId,
          reviewReason: organisation.reviewReason,
          registeredStateCode: organisation.registeredStateCode,
          gstinVerifiedAt: organisation.gstinVerifiedAt?.toISOString() ?? null,
        } satisfies Prisma.InputJsonObject,
      });

      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return organisation;
    });
  }

  private async ensureOnboardingReadyForApproval(
    client: Prisma.TransactionClient,
    organisationId: string,
    organisationType: OrganisationType,
  ): Promise<void> {
    if (
      organisationType !== OrganisationType.COMPANY &&
      organisationType !== OrganisationType.DISTRIBUTOR
    ) {
      return;
    }

    const [companyProfile, distributorProfile, approvedKycDocumentCount] = await Promise.all([
      organisationType === OrganisationType.COMPANY
        ? client.companyProfile.findUnique({ where: { organisationId } })
        : Promise.resolve(null),
      organisationType === OrganisationType.DISTRIBUTOR
        ? client.distributorProfile.findUnique({ where: { organisationId } })
        : Promise.resolve(null),
      client.kycDocument.count({
        where: {
          organisationId,
          status: KycDocumentStatus.APPROVED,
        },
      }),
    ]);

    const hasProfile =
      organisationType === OrganisationType.COMPANY
        ? companyProfile !== null
        : distributorProfile !== null;
    const missingRequirements: string[] = [];

    if (!hasProfile) {
      missingRequirements.push('PROFILE');
    }
    if (approvedKycDocumentCount === 0) {
      missingRequirements.push('APPROVED_KYC_DOCUMENT');
    }

    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Organisation onboarding is not ready for approval: ${missingRequirements.join(', ')}`,
      });
    }
  }

  async listMemberships(organisationId: string) {
    await this.findOrganisationOrThrow(organisationId);

    return this.prisma.organisationMembership.findMany({
      where: {
        organisationId,
      },
      select: {
        ...membershipResponseSelect,
        organisation: {
          select: organisationResponseSelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createMembership(
    organisationId: string,
    dto: CreateMembershipDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.organisationMembership.findFirst({
        where: {
          userId: dto.userId,
          organisationId,
          role: dto.role,
        },
      });

      if (existing) {
        throw new ConflictException({
          code: ApiErrorCode.DUPLICATE_MEMBERSHIP,
          message: 'User already has this role in the organisation',
        });
      }

      const membership = await tx.organisationMembership.create({
        data: {
          userId: dto.userId,
          organisationId,
          role: dto.role,
          status: dto.status ?? MembershipStatus.ACTIVE,
        },
      });

      const auditInput = this.withActor(actor, {
        action: 'ORGANISATION_MEMBERSHIP_CREATED',
        resourceType: 'OrganisationMembership',
        resourceId: membership.id,
        organisationId,
        newValue: {
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
        } satisfies Prisma.InputJsonObject,
      });

      this.attachAuditContext(auditInput, requestId);

      await this.auditService.record(auditInput, tx);

      return membership;
    });
  }

  async updateMembership(
    organisationId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.prisma.organisationMembership.findFirst({
      where: {
        id: membershipId,
        organisationId,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Organisation membership was not found',
      });
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organisationMembership.update({
        where: { id: membershipId },
        data: {
          status: dto.status ?? existing.status,
        },
      });

      const auditInput = this.withActor(actor, {
        action: 'ORGANISATION_MEMBERSHIP_STATUS_CHANGED',
        resourceType: 'OrganisationMembership',
        resourceId: updated.id,
        organisationId,
        previousValue: {
          userId: existing.userId,
          role: existing.role,
          status: existing.status,
        } satisfies Prisma.InputJsonObject,
        newValue: {
          userId: updated.userId,
          role: updated.role,
          status: updated.status,
        } satisfies Prisma.InputJsonObject,
      });

      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return membership;
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

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
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

  private throwConflictForKnownUniqueError(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message,
      });
    }
  }
}
