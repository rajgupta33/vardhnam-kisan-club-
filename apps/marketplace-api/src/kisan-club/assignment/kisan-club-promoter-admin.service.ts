import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KycDocumentStatus,
  MembershipStatus,
  OrganisationStatus,
  PayoutAccountStatus,
  PlatformRole,
  Prisma,
  PromoterTerritoryStatus,
  UserStatus,
  type KisanClubPromoterProfile,
  type PromoterTerritory,
} from '@prisma/client';
import { PermissionCode } from '../../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreatePromoterTerritoryDto } from '../dto/create-promoter-territory.dto';
import type { ListKisanClubPromoterProfilesQueryDto } from '../dto/list-kisan-club-promoter-profiles-query.dto';
import type { ListPromoterTerritoriesQueryDto } from '../dto/list-promoter-territories-query.dto';
import type { UpdatePromoterTerritoryDto } from '../dto/update-promoter-territory.dto';
import type { UpsertKisanClubPromoterProfileDto } from '../dto/upsert-kisan-club-promoter-profile.dto';

const promoterRoles: PlatformRole[] = [PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER];

@Injectable()
export class KisanClubPromoterAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Every territory a selector could legitimately offer.
   *
   * Separate from `listTerritories` on purpose. That feed is filtered and
   * paged for the management queue, and reusing it to populate the promoter
   * form silently narrowed the form to whatever the queue happened to be
   * showing: filter the queue to ACTIVE and an inactive territory became
   * unselectable, and past the queue's page size the tail vanished with no
   * error. A selector must offer the complete set or it is quietly wrong.
   *
   * Deliberately unpaged. Territories are administrative geography -- tens,
   * not thousands -- and a paged selector is the bug this method exists to
   * remove. The projection stays narrow so the payload is a selector, not a
   * second copy of the management list.
   */
  async listTerritoryOptions(actor: CurrentUser) {
    this.ensureTerritoryOptionsPermission(actor);
    const items = await this.prisma.promoterTerritory.findMany({
      orderBy: [{ status: 'asc' }, { state: 'asc' }, { district: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        state: true,
        district: true,
        status: true,
      },
    });
    return { items, total: items.length };
  }

  /**
   * Either permission that has a real use for the selector opens it.
   *
   * Requiring territory management would lock out the promoter-profile
   * managers who are the main consumers -- they have to pick a territory to
   * do their own job -- and the guard decorator can only express AND.
   */
  private ensureTerritoryOptionsPermission(actor: CurrentUser): void {
    if (
      !actor.permissions.includes(PermissionCode.KISAN_CLUB_TERRITORIES_MANAGE) &&
      !actor.permissions.includes(PermissionCode.KISAN_CLUB_PROMOTER_PROFILES_MANAGE)
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'You do not have permission to perform this action',
      });
    }
  }

  async listTerritories(query: ListPromoterTerritoriesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const q = query.q?.trim();
    const where: Prisma.PromoterTerritoryWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { district: { contains: q, mode: 'insensitive' } },
              { state: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promoterTerritory.findMany({
        where,
        orderBy: [{ status: 'asc' }, { state: 'asc' }, { district: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.promoterTerritory.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async createTerritory(
    dto: CreatePromoterTerritoryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const territory = await tx.promoterTerritory.create({
        data: this.territoryCreateInput(dto),
      });
      await this.recordAudit(
        actor,
        {
          action: 'KISAN_CLUB_TERRITORY_CREATED',
          resourceType: 'PromoterTerritory',
          resourceId: territory.id,
          newValue: this.territoryAuditValue(territory),
          requestId,
        },
        tx,
      );
      return territory;
    });
  }

  async updateTerritory(
    territoryId: string,
    dto: UpdatePromoterTerritoryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw this.validationError('Provide at least one territory field to update');
    }
    const current = await this.prisma.promoterTerritory.findUnique({ where: { id: territoryId } });
    if (!current) throw this.notFound('Promoter territory was not found');
    if (
      dto.status === PromoterTerritoryStatus.INACTIVE &&
      current.status !== PromoterTerritoryStatus.INACTIVE
    ) {
      const activeAssignments = await this.prisma.kisanClubPromoterAssignment.count({
        where: { territoryId, status: 'ACTIVE' },
      });
      if (activeAssignments > 0) {
        throw this.validationError(
          'Reassign active farmers before deactivating this territory',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const territory = await tx.promoterTerritory.update({
        where: { id: territoryId },
        data: this.territoryUpdateInput(dto),
      });
      await this.recordAudit(
        actor,
        {
          action: 'KISAN_CLUB_TERRITORY_UPDATED',
          resourceType: 'PromoterTerritory',
          resourceId: territory.id,
          previousValue: this.territoryAuditValue(current),
          newValue: this.territoryAuditValue(territory),
          requestId,
        },
        tx,
      );
      return territory;
    });
  }

  async listPromoterProfiles(query: ListKisanClubPromoterProfilesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.KisanClubPromoterProfileWhereInput = {
      ...(query.territoryId ? { territoryId: query.territoryId } : {}),
      ...(query.clubEnabled !== undefined ? { clubEnabled: query.clubEnabled } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubPromoterProfile.findMany({
        where,
        include: {
          territory: true,
          promoterUser: {
            select: {
              id: true,
              email: true,
              phone: true,
              status: true,
              profile: { select: { displayName: true } },
            },
          },
          promoterOrganisation: { select: { id: true, displayName: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kisanClubPromoterProfile.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async upsertPromoterProfile(
    dto: UpsertKisanClubPromoterProfileDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.prisma.kisanClubPromoterProfile.findUnique({
      where: { promoterUserId: dto.promoterUserId },
    });
    const maxActiveFarmers = dto.maxActiveFarmers ?? existing?.maxActiveFarmers ?? 150;
    if (existing && maxActiveFarmers < existing.activeFarmerCount) {
      throw this.validationError('Maximum farmer capacity cannot be below the active count');
    }
    if (
      existing &&
      existing.activeFarmerCount > 0 &&
      ((dto.clubEnabled === false && existing.clubEnabled) ||
        (dto.territoryId !== undefined && dto.territoryId !== existing.territoryId) ||
        dto.promoterOrganisationId !== existing.promoterOrganisationId)
    ) {
      throw this.validationError(
        'Reassign active farmers before disabling or moving this Club promoter',
      );
    }
    const effectiveTerritoryId = dto.territoryId ?? existing?.territoryId;
    const eligibilityInput: UpsertKisanClubPromoterProfileDto = {
      ...dto,
      ...(effectiveTerritoryId ? { territoryId: effectiveTerritoryId } : {}),
    };
    await this.validatePromoterEligibilityForProfile(
      eligibilityInput,
      dto.clubEnabled ?? existing?.clubEnabled,
    );

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.kisanClubPromoterProfile.upsert({
        where: { promoterUserId: dto.promoterUserId },
        create: {
          promoterUserId: dto.promoterUserId,
          promoterOrganisationId: dto.promoterOrganisationId,
          territoryId: dto.territoryId ?? null,
          homeVillage: this.nullableText(dto.homeVillage),
          homePincode: dto.homePincode ?? null,
          clubEnabled: dto.clubEnabled ?? false,
          acceptingNewFarmers: dto.acceptingNewFarmers ?? true,
          maxActiveFarmers,
        },
        update: {
          promoterOrganisationId: dto.promoterOrganisationId,
          ...(dto.territoryId !== undefined ? { territoryId: dto.territoryId } : {}),
          ...(dto.homeVillage !== undefined
            ? { homeVillage: this.nullableText(dto.homeVillage) }
            : {}),
          ...(dto.homePincode !== undefined ? { homePincode: dto.homePincode } : {}),
          ...(dto.clubEnabled !== undefined ? { clubEnabled: dto.clubEnabled } : {}),
          ...(dto.acceptingNewFarmers !== undefined
            ? { acceptingNewFarmers: dto.acceptingNewFarmers }
            : {}),
          maxActiveFarmers,
        },
        include: { territory: true },
      });
      await this.recordAudit(
        actor,
        {
          action: existing
            ? 'KISAN_CLUB_PROMOTER_PROFILE_UPDATED'
            : 'KISAN_CLUB_PROMOTER_PROFILE_CREATED',
          resourceType: 'KisanClubPromoterProfile',
          resourceId: profile.id,
          previousValue: existing ? this.profileAuditValue(existing) : undefined,
          newValue: this.profileAuditValue(profile),
          requestId,
        },
        tx,
      );
      return profile;
    });
  }

  private async validatePromoterEligibilityForProfile(
    dto: UpsertKisanClubPromoterProfileDto,
    enablingClub = false,
  ) {
    const [membership, organisation, territory, approvedKyc, payout] = await Promise.all([
      this.prisma.organisationMembership.findFirst({
        where: {
          userId: dto.promoterUserId,
          organisationId: dto.promoterOrganisationId,
          role: { in: promoterRoles },
          status: MembershipStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE },
        },
        select: { id: true },
      }),
      this.prisma.organisation.findFirst({
        where: { id: dto.promoterOrganisationId, status: OrganisationStatus.ACTIVE },
        select: { id: true },
      }),
      dto.territoryId
        ? this.prisma.promoterTerritory.findUnique({
            where: { id: dto.territoryId },
            select: { id: true, status: true },
          })
        : Promise.resolve(null),
      this.prisma.kycDocument.findFirst({
        where: {
          organisationId: dto.promoterOrganisationId,
          status: KycDocumentStatus.APPROVED,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      }),
      this.prisma.payoutAccount.findUnique({
        where: { userId: dto.promoterUserId },
        select: { status: true },
      }),
    ]);
    if (!membership || !organisation) {
      throw this.validationError(
        'Promoter must have an active promoter or sales-partner membership in an active organisation',
      );
    }
    if (dto.territoryId && !territory) throw this.notFound('Promoter territory was not found');
    if (enablingClub && territory?.status !== PromoterTerritoryStatus.ACTIVE) {
      throw this.validationError('An active territory is required to enable a Club promoter');
    }
    if (enablingClub && !approvedKyc) {
      throw this.validationError('Approved organisation KYC is required to enable a Club promoter');
    }
    const commissionBps = this.configService.get<number>(
      'DEFAULT_KISAN_CLUB_PROMOTER_COMMISSION_BPS',
      0,
    );
    if (enablingClub && commissionBps > 0 && payout?.status !== PayoutAccountStatus.VERIFIED) {
      throw this.validationError('A verified payout account is required for paid Club promotion');
    }
  }

  private territoryCreateInput(
    dto: CreatePromoterTerritoryDto,
  ): Prisma.PromoterTerritoryCreateInput {
    return {
      name: dto.name.trim(),
      state: dto.state.trim(),
      district: dto.district.trim(),
      blocks: this.normaliseList(dto.blocks),
      pincodes: this.normaliseList(dto.pincodes),
      villages: this.normaliseList(dto.villages),
      status: dto.status ?? PromoterTerritoryStatus.ACTIVE,
    };
  }

  private territoryUpdateInput(dto: UpdatePromoterTerritoryDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
      ...(dto.district !== undefined ? { district: dto.district.trim() } : {}),
      ...(dto.blocks !== undefined ? { blocks: this.normaliseList(dto.blocks) } : {}),
      ...(dto.pincodes !== undefined ? { pincodes: this.normaliseList(dto.pincodes) } : {}),
      ...(dto.villages !== undefined ? { villages: this.normaliseList(dto.villages) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
  }

  private territoryAuditValue(territory: PromoterTerritory): Prisma.InputJsonObject {
    return {
      name: territory.name,
      state: territory.state,
      district: territory.district,
      blocks: territory.blocks,
      pincodes: territory.pincodes,
      villages: territory.villages,
      status: territory.status,
    };
  }

  private profileAuditValue(profile: KisanClubPromoterProfile): Prisma.InputJsonObject {
    return {
      promoterUserId: profile.promoterUserId,
      promoterOrganisationId: profile.promoterOrganisationId,
      territoryId: profile.territoryId,
      homeVillage: profile.homeVillage,
      homePincode: profile.homePincode,
      clubEnabled: profile.clubEnabled,
      acceptingNewFarmers: profile.acceptingNewFarmers,
      maxActiveFarmers: profile.maxActiveFarmers,
      activeFarmerCount: profile.activeFarmerCount,
    };
  }

  private normaliseList(values: string[] = []): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
  }

  private nullableText(value?: string): string | null {
    const text = value?.trim();
    return text ? text : null;
  }

  private async recordAudit(
    actor: CurrentUser,
    input: AuditRecordInput,
    tx: Prisma.TransactionClient,
  ) {
    await this.auditService.record(
      {
        ...input,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
      },
      tx,
    );
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
