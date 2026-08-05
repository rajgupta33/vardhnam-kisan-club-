import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, PlatformRole, Prisma, PromoterAttributionStatus } from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePromoterAttributionDto } from './dto/create-promoter-attribution.dto';
import type { ListPromoterAttributionsQueryDto } from './dto/list-promoter-attributions-query.dto';
import type { RevokePromoterAttributionDto } from './dto/revoke-promoter-attribution.dto';

const PROMOTER_ELIGIBLE_ROLES: PlatformRole[] = [
  PlatformRole.PROMOTER,
  PlatformRole.SALES_PARTNER,
];

@Injectable()
export class PromotersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAttribution(
    dto: CreatePromoterAttributionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const promoterMembership = await this.prisma.organisationMembership.findFirst({
      where: {
        userId: dto.promoterUserId,
        role: { in: PROMOTER_ELIGIBLE_ROLES },
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!promoterMembership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'promoterUserId does not have an active promoter or sales-partner membership',
      });
    }

    const farmerProfile = await this.prisma.farmerProfile.findUnique({
      where: { userId: dto.farmerUserId },
    });
    if (!farmerProfile) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Farmer profile was not found for farmerUserId',
      });
    }

    return this.prisma.$transaction(async (tx) => {
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
    });
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
