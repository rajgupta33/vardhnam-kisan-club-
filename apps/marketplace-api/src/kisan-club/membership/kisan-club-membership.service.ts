import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KisanClubMembership,
  KisanClubAssignmentStatus,
  KisanClubMembershipStatus,
  PlatformRole,
  Prisma,
  PromoterAttributionStatus,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CloseKisanClubMembershipDto } from '../dto/close-kisan-club-membership.dto';
import type { CreateKisanClubMembershipDto } from '../dto/create-kisan-club-membership.dto';
import type { ListKisanClubMembershipsQueryDto } from '../dto/list-kisan-club-memberships-query.dto';
import type { SuspendKisanClubMembershipDto } from '../dto/suspend-kisan-club-membership.dto';
import type { UpdateKisanClubConsentsDto } from '../dto/update-kisan-club-consents.dto';

@Injectable()
export class KisanClubMembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createMembership(
    dto: CreateKisanClubMembershipDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    const farmerProfile = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!farmerProfile) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Create the farmer profile before joining Kisan Club',
      });
    }

    const existing = await this.prisma.kisanClubMembership.findUnique({
      where: { farmerProfileId: farmerProfile.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'The farmer already has a Kisan Club membership',
      });
    }

    if (dto.referredByMembershipId) {
      const referral = await this.prisma.kisanClubMembership.findFirst({
        where: {
          id: dto.referredByMembershipId,
          status: {
            notIn: [KisanClubMembershipStatus.CLOSED, KisanClubMembershipStatus.SUSPENDED],
          },
        },
        select: { id: true },
      });
      if (!referral) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'The referral is not valid',
        });
      }
    }

    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const membership = await tx.kisanClubMembership.create({
          data: {
            farmerProfileId: farmerProfile.id,
            memberNumber: this.generateMemberNumber(now),
            status: KisanClubMembershipStatus.PENDING_PROFILE,
            homePincode: dto.homePincode,
            homeVillage: this.nullableText(dto.homeVillage),
            homeDistrict: this.nullableText(dto.homeDistrict),
            homeState: this.nullableText(dto.homeState),
            joinedAt: now,
            termsVersion: dto.termsVersion.trim(),
            termsAcceptedAt: now,
            referredByMembershipId: dto.referredByMembershipId ?? null,
          },
        });

        await this.auditService.record(
          this.withActor(actor, {
            action: 'KISAN_CLUB_MEMBERSHIP_CREATED',
            resourceType: 'KisanClubMembership',
            resourceId: membership.id,
            newValue: this.auditValue(membership),
            requestId,
          }),
          tx,
        );
        return membership;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'The farmer already has a Kisan Club membership',
        });
      }
      throw error;
    }
  }

  async getMyMembership(actor: CurrentUser) {
    this.ensureFarmer(actor);
    const profile = await this.prisma.farmerProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    if (!profile) {
      return null;
    }
    return this.prisma.kisanClubMembership.findUnique({
      where: { farmerProfileId: profile.id },
    });
  }

  async updateMyConsents(dto: UpdateKisanClubConsentsDto, actor: CurrentUser, requestId?: string) {
    this.ensureFarmer(actor);
    if (
      dto.advisoryConsent === undefined &&
      dto.marketingConsent === undefined &&
      dto.preciseLocationConsent === undefined
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Provide at least one consent choice',
      });
    }

    const current = await this.findMyMembershipOrThrow(actor.userId);
    this.ensureMembershipEditable(current);
    const now = new Date();
    const data: Prisma.KisanClubMembershipUpdateInput = {};
    if (dto.advisoryConsent !== undefined) {
      data.advisoryConsent = dto.advisoryConsent;
      data.advisoryConsentAt = now;
    }
    if (dto.marketingConsent !== undefined) {
      data.marketingConsent = dto.marketingConsent;
      data.marketingConsentAt = now;
    }
    if (dto.preciseLocationConsent !== undefined) {
      data.preciseLocationConsent = dto.preciseLocationConsent;
      data.preciseLocationConsentAt = now;
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.preciseLocationConsent === false) {
        await this.removePreciseFarmLocations(tx, current.id, actor, requestId);
      }
      const membership = await tx.kisanClubMembership.update({
        where: { id: current.id },
        data,
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'KISAN_CLUB_CONSENTS_UPDATED',
          resourceType: 'KisanClubMembership',
          resourceId: membership.id,
          previousValue: this.consentAuditValue(current),
          newValue: this.consentAuditValue(membership),
          requestId,
        }),
        tx,
      );
      return membership;
    });
  }

  async closeMyMembership(
    dto: CloseKisanClubMembershipDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    const current = await this.findMyMembershipOrThrow(actor.userId);
    if (current.status === KisanClubMembershipStatus.CLOSED) {
      return current;
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await this.removePreciseFarmLocations(tx, current.id, actor, requestId);
      await this.endActivePromoterAssignment(
        tx,
        current.id,
        actor,
        requestId,
        dto.reason ?? 'Membership closed',
      );
      const membership = await tx.kisanClubMembership.update({
        where: { id: current.id },
        data: {
          status: KisanClubMembershipStatus.CLOSED,
          closedAt: now,
          advisoryConsent: false,
          advisoryConsentAt: current.advisoryConsent ? now : current.advisoryConsentAt,
          marketingConsent: false,
          marketingConsentAt: current.marketingConsent ? now : current.marketingConsentAt,
          preciseLocationConsent: false,
          preciseLocationConsentAt: current.preciseLocationConsent
            ? now
            : current.preciseLocationConsentAt,
        },
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'KISAN_CLUB_MEMBERSHIP_CLOSED',
          resourceType: 'KisanClubMembership',
          resourceId: membership.id,
          previousValue: this.auditValue(current),
          newValue: this.auditValue(membership),
          requestId,
          reason: this.optionalText(dto.reason),
        }),
        tx,
      );
      return membership;
    });
  }

  async listMemberships(query: ListKisanClubMembershipsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const q = query.q?.trim();
    const where: Prisma.KisanClubMembershipWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { memberNumber: { contains: q, mode: 'insensitive' } },
              { farmerProfile: { fullName: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubMembership.findMany({
        where,
        include: { farmerProfile: true },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kisanClubMembership.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async getMembership(membershipId: string) {
    const membership = await this.prisma.kisanClubMembership.findUnique({
      where: { id: membershipId },
      include: { farmerProfile: true },
    });
    if (!membership) {
      throw this.notFound();
    }
    return membership;
  }

  async suspendMembership(
    membershipId: string,
    dto: SuspendKisanClubMembershipDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const current = await this.prisma.kisanClubMembership.findUnique({
      where: { id: membershipId },
    });
    if (!current) {
      throw this.notFound();
    }
    if (current.status === KisanClubMembershipStatus.CLOSED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'A closed Kisan Club membership cannot be suspended',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.endActivePromoterAssignment(tx, current.id, actor, requestId, dto.reason);
      const membership = await tx.kisanClubMembership.update({
        where: { id: current.id },
        data: {
          status: KisanClubMembershipStatus.SUSPENDED,
          suspendedReason: dto.reason.trim(),
        },
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'KISAN_CLUB_MEMBERSHIP_SUSPENDED',
          resourceType: 'KisanClubMembership',
          resourceId: membership.id,
          previousValue: this.auditValue(current),
          newValue: this.auditValue(membership),
          requestId,
          reason: dto.reason.trim(),
        }),
        tx,
      );
      return membership;
    });
  }

  private async findMyMembershipOrThrow(userId: string): Promise<KisanClubMembership> {
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: { farmerProfile: { userId } },
    });
    if (!membership) {
      throw this.notFound();
    }
    return membership;
  }

  private async endActivePromoterAssignment(
    tx: Prisma.TransactionClient,
    membershipId: string,
    actor: CurrentUser,
    requestId: string | undefined,
    reason: string,
  ): Promise<void> {
    const assignment = await tx.kisanClubPromoterAssignment.findFirst({
      where: { membershipId, status: KisanClubAssignmentStatus.ACTIVE },
    });
    if (!assignment) return;

    const ended = await tx.kisanClubPromoterAssignment.update({
      where: { id: assignment.id },
      data: { status: KisanClubAssignmentStatus.ENDED, endedAt: new Date() },
    });
    await tx.kisanClubPromoterProfile.updateMany({
      where: { promoterUserId: assignment.promoterUserId, activeFarmerCount: { gt: 0 } },
      data: { activeFarmerCount: { decrement: 1 } },
    });
    if (assignment.promoterAttributionId) {
      await tx.promoterAttribution.updateMany({
        where: {
          id: assignment.promoterAttributionId,
          status: PromoterAttributionStatus.ACTIVE,
        },
        data: { status: PromoterAttributionStatus.REVOKED, revokedAt: new Date() },
      });
    }
    await this.auditService.record(
      this.withActor(actor, {
        action: 'KISAN_CLUB_PROMOTER_ASSIGNMENT_ENDED',
        resourceType: 'KisanClubPromoterAssignment',
        resourceId: ended.id,
        previousValue: {
          promoterUserId: assignment.promoterUserId,
          status: assignment.status,
        },
        newValue: {
          promoterUserId: ended.promoterUserId,
          status: ended.status,
        },
        requestId,
        reason: reason.trim(),
      }),
      tx,
    );
  }

  private async removePreciseFarmLocations(
    tx: Prisma.TransactionClient,
    membershipId: string,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    const farms = await tx.farm.findMany({
      where: {
        membershipId,
        OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
      },
      select: { id: true, farmerProfileId: true },
    });
    if (farms.length === 0) return;
    await tx.farm.updateMany({
      where: { id: { in: farms.map((farm) => farm.id) } },
      data: { latitude: null, longitude: null, locationCapturedAt: null },
    });
    for (const farm of farms) {
      await this.auditService.record(
        this.withActor(actor, {
          action: 'FARM_PRECISE_LOCATION_REMOVED',
          resourceType: 'Farm',
          resourceId: farm.id,
          previousValue: { farmerProfileId: farm.farmerProfileId, hasPreciseLocation: true },
          newValue: { farmerProfileId: farm.farmerProfileId, hasPreciseLocation: false },
          requestId,
          reason: 'Precise-location consent withdrawn',
        }),
        tx,
      );
    }
  }

  private ensureMembershipEditable(membership: KisanClubMembership): void {
    if (
      membership.status === KisanClubMembershipStatus.CLOSED ||
      membership.status === KisanClubMembershipStatus.SUSPENDED
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'This Kisan Club membership is read-only',
      });
    }
  }

  private ensureFarmer(actor: CurrentUser): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Farmer role is required',
      });
    }
  }

  private generateMemberNumber(at: Date): string {
    const datePart = at.toISOString().slice(0, 10).replaceAll('-', '');
    return `VKC-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private optionalText(value?: string): string | undefined {
    const normalised = value?.trim();
    return normalised ? normalised : undefined;
  }

  private nullableText(value?: string): string | null {
    return this.optionalText(value) ?? null;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ApiErrorCode.NOT_FOUND,
      message: 'Kisan Club membership was not found',
    });
  }

  private auditValue(membership: KisanClubMembership): Prisma.InputJsonObject {
    return {
      farmerProfileId: membership.farmerProfileId,
      memberNumber: membership.memberNumber,
      status: membership.status,
      homePincode: membership.homePincode,
      homeVillage: membership.homeVillage,
      homeDistrict: membership.homeDistrict,
      homeState: membership.homeState,
      joinedAt: membership.joinedAt.toISOString(),
      termsVersion: membership.termsVersion,
      termsAcceptedAt: membership.termsAcceptedAt.toISOString(),
      ...this.consentAuditValue(membership),
      referredByMembershipId: membership.referredByMembershipId,
      suspendedReason: membership.suspendedReason,
      closedAt: membership.closedAt?.toISOString() ?? null,
    };
  }

  private consentAuditValue(membership: KisanClubMembership): Prisma.InputJsonObject {
    return {
      advisoryConsent: membership.advisoryConsent,
      advisoryConsentAt: membership.advisoryConsentAt?.toISOString() ?? null,
      marketingConsent: membership.marketingConsent,
      marketingConsentAt: membership.marketingConsentAt?.toISOString() ?? null,
      preciseLocationConsent: membership.preciseLocationConsent,
      preciseLocationConsentAt: membership.preciseLocationConsentAt?.toISOString() ?? null,
    };
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: actor.organisationId,
    };
  }
}
