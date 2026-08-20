import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FarmerLeadStatus,
  MembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  PromoterTerritoryStatus,
  PromoterAttributionStatus,
  UserStatus,
  type FarmerLead,
  type PromoterTerritory,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import {
  PermissionCode,
  type PermissionCode as PermissionCodeType,
} from '../access/permission-codes';
import type { CurrentUser } from '../auth/current-user.interface';
import { AuthService } from '../auth/auth.service';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePromoterAttributionDto } from './dto/create-promoter-attribution.dto';
import type { AssignPromoterTerritoryDto } from './dto/assign-promoter-territory.dto';
import type { CreateFarmerLeadDto } from './dto/create-farmer-lead.dto';
import type { ListFarmerLeadsQueryDto } from './dto/list-farmer-leads-query.dto';
import type { ListPromoterAttributionsQueryDto } from './dto/list-promoter-attributions-query.dto';
import type { RevokePromoterAttributionDto } from './dto/revoke-promoter-attribution.dto';
import type { UpdateFarmerLeadDto } from './dto/update-farmer-lead.dto';
import type { VerifyAssistedFarmerOtpDto } from './dto/verify-assisted-farmer-otp.dto';

const PROMOTER_ELIGIBLE_ROLES: PlatformRole[] = [PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER];

@Injectable()
export class PromotersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async getMyTerritory(actor: CurrentUser) {
    this.ensurePromoter(actor);
    const profile = await this.prisma.kisanClubPromoterProfile.findUnique({
      where: { promoterUserId: actor.userId },
      include: { territory: true },
    });
    if (!profile || profile.promoterOrganisationId !== actor.organisationId) {
      return {
        assigned: false,
        promoterUserId: actor.userId,
        promoterOrganisationId: actor.organisationId,
        territory: null,
      };
    }
    return this.territoryAssignmentResult(profile);
  }

  async assignTerritory(
    promoterUserId: string,
    dto: AssignPromoterTerritoryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const [membership, territory, existing] = await Promise.all([
      this.prisma.organisationMembership.findFirst({
        where: {
          userId: promoterUserId,
          organisationId: dto.promoterOrganisationId,
          role: { in: PROMOTER_ELIGIBLE_ROLES },
          status: MembershipStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE },
          organisation: { status: OrganisationStatus.ACTIVE },
        },
        select: { id: true },
      }),
      this.prisma.promoterTerritory.findUnique({ where: { id: dto.territoryId } }),
      this.prisma.kisanClubPromoterProfile.findUnique({
        where: { promoterUserId },
        include: { territory: true },
      }),
    ]);
    if (!membership) {
      throw this.validationError(
        'Promoter must have an active promoter or sales-partner membership in the selected active organisation',
      );
    }
    if (!territory) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Promoter territory was not found',
      });
    }
    if (territory.status !== PromoterTerritoryStatus.ACTIVE) {
      throw this.validationError('Only an active promoter territory can be assigned');
    }
    if (existing && existing.promoterOrganisationId !== dto.promoterOrganisationId) {
      throw this.validationError(
        'The promoter profile belongs to a different organisation and cannot be moved implicitly',
      );
    }
    if (existing?.territoryId === territory.id) {
      return this.territoryAssignmentResult(existing);
    }
    if (existing && existing.activeFarmerCount > 0) {
      throw this.validationError(
        'Reassign active Club farmers before changing this promoter territory',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.kisanClubPromoterProfile.upsert({
        where: { promoterUserId },
        create: {
          promoterUserId,
          promoterOrganisationId: dto.promoterOrganisationId,
          territoryId: territory.id,
          clubEnabled: false,
        },
        update: { territoryId: territory.id },
        include: { territory: true },
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: existing
            ? 'PROMOTER_TERRITORY_REASSIGNED'
            : 'PROMOTER_TERRITORY_ASSIGNED',
          resourceType: 'KisanClubPromoterProfile',
          resourceId: profile.id,
          organisationId: dto.promoterOrganisationId,
          previousValue: existing
            ? {
                promoterUserId,
                territoryId: existing.territoryId,
              }
            : undefined,
          newValue: {
            promoterUserId,
            territoryId: territory.id,
          },
          requestId,
          reason: 'General promoter field territory assignment',
        }),
        tx,
      );
      return this.territoryAssignmentResult(profile);
    });
  }

  async createLead(dto: CreateFarmerLeadDto, actor: CurrentUser, requestId?: string) {
    this.ensurePromoter(actor);
    const phone = this.normalizePhone(dto.phone);
    await this.ensureNoOpenDuplicate(phone, actor.userId);

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.farmerLead.create({
        data: {
          promoterUserId: actor.userId,
          promoterOrganisationId: actor.organisationId,
          fullName: dto.fullName.trim(),
          phone,
          source: dto.source,
          village: this.optionalText(dto.village),
          district: this.optionalText(dto.district),
          state: this.optionalText(dto.state),
          pincode: this.optionalText(dto.pincode),
          cropInterests: this.normalizedList(dto.cropInterests),
          notes: this.optionalText(dto.notes),
        },
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'FARMER_LEAD_CREATED',
          resourceType: 'FarmerLead',
          resourceId: lead.id,
          newValue: this.leadAuditValue(lead),
          requestId,
          reason: 'Farmer lead captured by promoter',
        }),
        tx,
      );
      return lead;
    });
  }

  async listMyLeads(query: ListFarmerLeadsQueryDto, actor: CurrentUser) {
    this.ensurePromoter(actor);
    return this.listLeads(query, actor.userId);
  }

  async listLeads(query: ListFarmerLeadsQueryDto, promoterUserId?: string) {
    const { page, limit, skip } = paginationOffset(query);
    const q = query.q?.trim();
    const where: Prisma.FarmerLeadWhereInput = {
      ...(promoterUserId ? { promoterUserId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { village: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.farmerLead.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.farmerLead.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async getLead(leadId: string, actor: CurrentUser) {
    const lead = await this.findLead(leadId);
    this.ensureCanAccessLead(lead, actor, PermissionCode.PROMOTER_LEADS_READ_ANY);
    return lead;
  }

  async updateLead(
    leadId: string,
    dto: UpdateFarmerLeadDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const current = await this.findLead(leadId);
    this.ensureCanAccessLead(current, actor, PermissionCode.PROMOTER_LEADS_MANAGE_ANY);
    if (Object.keys(dto).length === 0) {
      throw this.validationError('At least one farmer lead field is required');
    }
    if (
      dto.statusReason !== undefined &&
      (dto.status === undefined || dto.status === current.status)
    ) {
      throw this.validationError('statusReason is allowed only with a status transition');
    }
    if (current.status === FarmerLeadStatus.CONVERTED || current.status === FarmerLeadStatus.LOST) {
      throw this.validationError('Converted and lost leads are read-only');
    }

    const nextStatus = dto.status ?? current.status;
    this.validateLeadTransition(current.status, nextStatus, dto.statusReason);
    const phone = dto.phone ? this.normalizePhone(dto.phone) : undefined;
    if (phone && phone !== current.phone) {
      await this.ensureNoOpenDuplicate(phone, current.promoterUserId, leadId);
    }
    const now = new Date();
    const data: Prisma.FarmerLeadUncheckedUpdateInput = {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(phone ? { phone } : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.village !== undefined ? { village: this.optionalText(dto.village) } : {}),
      ...(dto.district !== undefined ? { district: this.optionalText(dto.district) } : {}),
      ...(dto.state !== undefined ? { state: this.optionalText(dto.state) } : {}),
      ...(dto.pincode !== undefined ? { pincode: this.optionalText(dto.pincode) } : {}),
      ...(dto.cropInterests !== undefined
        ? { cropInterests: this.normalizedList(dto.cropInterests) }
        : {}),
      ...(dto.notes !== undefined ? { notes: this.optionalText(dto.notes) } : {}),
      ...(dto.status !== undefined
        ? {
            status: nextStatus,
            statusReason: this.optionalText(dto.statusReason),
            contactedAt: nextStatus === FarmerLeadStatus.CONTACTED ? now : current.contactedAt,
            lostAt: nextStatus === FarmerLeadStatus.LOST ? now : current.lostAt,
          }
        : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.farmerLead.update({ where: { id: leadId }, data });
      await this.auditService.record(
        this.withActor(actor, {
          action:
            updated.status === current.status
              ? 'FARMER_LEAD_UPDATED'
              : 'FARMER_LEAD_STATUS_CHANGED',
          resourceType: 'FarmerLead',
          resourceId: updated.id,
          organisationId: updated.promoterOrganisationId,
          previousValue: this.leadAuditValue(current),
          newValue: this.leadAuditValue(updated),
          requestId,
          reason: this.optionalText(dto.statusReason) ?? 'Farmer lead details updated',
        }),
        tx,
      );
      return updated;
    });
  }

  async convertLead(leadId: string, actor: CurrentUser, requestId?: string) {
    const current = await this.findLead(leadId);
    this.ensureCanAccessLead(current, actor, PermissionCode.PROMOTER_LEADS_MANAGE_ANY);
    if (current.status === FarmerLeadStatus.CONVERTED && current.convertedFarmerProfileId) {
      return this.conversionResult(current, current.convertedFarmerProfileId);
    }
    if (current.status !== FarmerLeadStatus.CONTACTED) {
      throw this.validationError('Only a contacted farmer lead can be converted');
    }

    const farmer = await this.prisma.user.findFirst({
      where: {
        phone: { in: this.phoneCandidates(current.phone) },
        status: UserStatus.ACTIVE,
        farmerProfile: { isNot: null },
        memberships: {
          some: {
            role: PlatformRole.FARMER,
            status: MembershipStatus.ACTIVE,
            organisation: { status: OrganisationStatus.ACTIVE },
          },
        },
      },
      select: { id: true, farmerProfile: { select: { id: true } } },
    });
    if (!farmer?.farmerProfile) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'The farmer must complete OTP registration before this lead can be converted',
      });
    }
    const farmerProfileId = farmer.farmerProfile.id;

    return this.prisma.$transaction(async (tx) => {
      await this.createAttributionInTransaction(
        {
          promoterUserId: current.promoterUserId,
          farmerUserId: farmer.id,
          reason: `Farmer lead ${current.id} converted after verified registration`,
        },
        actor,
        tx,
        requestId,
        current.promoterOrganisationId,
      );
      const convertedAt = new Date();
      const changed = await tx.farmerLead.updateMany({
        where: { id: current.id, status: FarmerLeadStatus.CONTACTED },
        data: {
          status: FarmerLeadStatus.CONVERTED,
          convertedAt,
          convertedFarmerProfileId: farmerProfileId,
          statusReason: 'Converted after farmer OTP registration',
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'The farmer lead changed while conversion was in progress',
        });
      }
      const converted = await tx.farmerLead.findUniqueOrThrow({ where: { id: current.id } });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'FARMER_LEAD_CONVERTED',
          resourceType: 'FarmerLead',
          resourceId: converted.id,
          organisationId: converted.promoterOrganisationId,
          previousValue: this.leadAuditValue(current),
          newValue: this.leadAuditValue(converted),
          requestId,
          reason: 'Lead linked to an OTP-verified farmer profile',
        }),
        tx,
      );
      return this.conversionResult(converted, farmerProfileId);
    });
  }

  async requestAssistedFarmerOtp(
    leadId: string,
    actor: CurrentUser,
    requestId?: string,
    requestIp?: string,
  ) {
    const lead = await this.findLead(leadId);
    this.ensureCanAccessLead(lead, actor, PermissionCode.PROMOTER_LEADS_MANAGE_ANY);
    if (lead.status !== FarmerLeadStatus.CONTACTED) {
      throw this.validationError('Only a contacted farmer lead can start OTP registration');
    }
    return this.authService.requestFarmerOtp({ phone: lead.phone }, requestId, requestIp);
  }

  async verifyAssistedFarmerOtp(
    leadId: string,
    dto: VerifyAssistedFarmerOtpDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const lead = await this.findLead(leadId);
    this.ensureCanAccessLead(lead, actor, PermissionCode.PROMOTER_LEADS_MANAGE_ANY);
    if (lead.status !== FarmerLeadStatus.CONTACTED) {
      throw this.validationError('Only a contacted farmer lead can complete OTP registration');
    }
    await this.authService.verifyFarmerOtpForAssistance(
      {
        phone: lead.phone,
        code: dto.code,
        fullName: lead.fullName,
        preferredLocale: dto.preferredLocale,
      },
      requestId,
      actor,
    );
    return this.convertLead(leadId, actor, requestId);
  }

  async createAttribution(
    dto: CreatePromoterAttributionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.createAttributionInTransaction(dto, actor, tx, requestId),
    );
  }

  async createAttributionInTransaction(
    dto: CreatePromoterAttributionDto,
    actor: CurrentUser,
    tx: Prisma.TransactionClient,
    requestId?: string,
    promoterOrganisationId?: string,
  ) {
    const promoterMembership = await tx.organisationMembership.findFirst({
      where: {
        userId: dto.promoterUserId,
        role: { in: PROMOTER_ELIGIBLE_ROLES },
        status: MembershipStatus.ACTIVE,
        ...(promoterOrganisationId ? { organisationId: promoterOrganisationId } : {}),
      },
    });
    if (!promoterMembership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'promoterUserId does not have an active promoter or sales-partner membership',
      });
    }

    const farmerProfile = await tx.farmerProfile.findUnique({
      where: { userId: dto.farmerUserId },
    });
    if (!farmerProfile) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer profile was not found for farmerUserId',
      });
    }

    const priorActive = await tx.promoterAttribution.findFirst({
      where: { farmerProfileId: farmerProfile.id, status: PromoterAttributionStatus.ACTIVE },
    });

    if (priorActive) {
      await tx.promoterAttribution.update({
        where: { id: priorActive.id },
        data: { status: PromoterAttributionStatus.REVOKED, revokedAt: new Date() },
      });
    }

    const attribution = await tx.promoterAttribution.create({
      data: {
        promoterUserId: dto.promoterUserId,
        promoterOrganisationId: promoterMembership.organisationId,
        farmerProfileId: farmerProfile.id,
        status: PromoterAttributionStatus.ACTIVE,
        createdByUserId: actor.userId,
        createdByRole: actor.role,
        reason: dto.reason,
      },
    });

    await this.auditService.record(
      this.withActor(actor, {
        action: 'PROMOTER_ATTRIBUTION_CREATED',
        resourceType: 'PromoterAttribution',
        resourceId: attribution.id,
        organisationId: promoterMembership.organisationId,
        newValue: this.attributionAuditValue(attribution),
        requestId,
        reason: dto.reason,
      }),
      tx,
    );

    return attribution;
  }

  async revokeAttribution(
    attributionId: string,
    dto: RevokePromoterAttributionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const attribution = await this.prisma.promoterAttribution.findUnique({
      where: { id: attributionId },
    });
    if (!attribution) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Promoter attribution was not found',
      });
    }
    if (attribution.status === PromoterAttributionStatus.REVOKED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Promoter attribution has already been revoked',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.promoterAttribution.update({
        where: { id: attributionId },
        data: { status: PromoterAttributionStatus.REVOKED, revokedAt: new Date() },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'PROMOTER_ATTRIBUTION_REVOKED',
          resourceType: 'PromoterAttribution',
          resourceId: updated.id,
          organisationId: updated.promoterOrganisationId,
          previousValue: this.attributionAuditValue(attribution),
          newValue: this.attributionAuditValue(updated),
          requestId,
          reason: dto.reason,
        }),
        tx,
      );

      return updated;
    });
  }

  async listAttributions(query: ListPromoterAttributionsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.PromoterAttributionWhereInput = {
      ...(query.promoterUserId ? { promoterUserId: query.promoterUserId } : {}),
      ...(query.farmerUserId ? { farmerProfile: { userId: query.farmerUserId } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.promoterAttribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.promoterAttribution.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async listMyAttributions(actor: CurrentUser, query: ListPromoterAttributionsQueryDto) {
    return this.listAttributions({ ...query, promoterUserId: actor.userId });
  }

  private async findLead(leadId: string) {
    const lead = await this.prisma.farmerLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer lead was not found',
      });
    }
    return lead;
  }

  private territoryAssignmentResult(profile: {
    promoterUserId: string;
    promoterOrganisationId: string;
    territoryId: string | null;
    territory: PromoterTerritory | null;
  }) {
    return {
      assigned: profile.territory !== null,
      promoterUserId: profile.promoterUserId,
      promoterOrganisationId: profile.promoterOrganisationId,
      territory: profile.territory
        ? {
            id: profile.territory.id,
            name: profile.territory.name,
            state: profile.territory.state,
            district: profile.territory.district,
            blocks: profile.territory.blocks,
            pincodes: profile.territory.pincodes,
            villages: profile.territory.villages,
            status: profile.territory.status,
          }
        : null,
    };
  }

  private async ensureNoOpenDuplicate(phone: string, promoterUserId: string, excludeId?: string) {
    const duplicate = await this.prisma.farmerLead.findFirst({
      where: {
        promoterUserId,
        phone,
        status: { in: [FarmerLeadStatus.NEW, FarmerLeadStatus.CONTACTED] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'An open lead with this phone already exists for the promoter',
      });
    }
  }

  private ensureCanAccessLead(
    lead: FarmerLead,
    actor: CurrentUser,
    anyPermission: PermissionCodeType,
  ) {
    if (actor.permissions.includes(anyPermission)) return;
    this.ensurePromoter(actor);
    if (lead.promoterUserId !== actor.userId) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Promoters may access only their own farmer leads',
      });
    }
  }

  private ensurePromoter(actor: CurrentUser) {
    if (!PROMOTER_ELIGIBLE_ROLES.includes(actor.role)) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'An active promoter or sales-partner context is required',
      });
    }
  }

  private validateLeadTransition(
    current: FarmerLeadStatus,
    next: FarmerLeadStatus,
    reason?: string,
  ) {
    if (current === next) return;
    const allowed =
      (current === FarmerLeadStatus.NEW && next === FarmerLeadStatus.CONTACTED) ||
      (current === FarmerLeadStatus.CONTACTED && next === FarmerLeadStatus.LOST);
    if (!allowed) {
      throw this.validationError(
        next === FarmerLeadStatus.CONVERTED
          ? 'Lead conversion must use the future farmer-onboarding workflow'
          : `Farmer lead cannot transition from ${current} to ${next}`,
      );
    }
    if (next === FarmerLeadStatus.LOST && !reason?.trim()) {
      throw this.validationError('A reason is required when marking a lead lost');
    }
  }

  private normalizePhone(phone: string) {
    const digits = phone.replace(/^\+91/, '');
    return `+91${digits}`;
  }

  private phoneCandidates(phone: string) {
    const normalized = this.normalizePhone(phone);
    return [normalized, normalized.slice(3)];
  }

  private conversionResult(lead: FarmerLead, farmerProfileId: string) {
    return { lead, farmerProfileId };
  }

  private optionalText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizedList(values?: string[]) {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  }

  private validationError(message: string) {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private leadAuditValue(lead: FarmerLead): Prisma.InputJsonObject {
    return {
      promoterUserId: lead.promoterUserId,
      fullName: lead.fullName,
      phone: `******${lead.phone.slice(-4)}`,
      source: lead.source,
      status: lead.status,
      pincode: lead.pincode,
      statusReason: lead.statusReason,
      convertedFarmerProfileId: lead.convertedFarmerProfileId,
    };
  }

  private attributionAuditValue(attribution: {
    promoterUserId: string;
    farmerProfileId: string;
    status: PromoterAttributionStatus;
  }): Prisma.InputJsonObject {
    return {
      promoterUserId: attribution.promoterUserId,
      farmerProfileId: attribution.farmerProfileId,
      status: attribution.status,
    };
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }
}
