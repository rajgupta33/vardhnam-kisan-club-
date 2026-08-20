import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  PromoterAttributionStatus,
  PromoterVisitLocationStatus,
  UserStatus,
} from '@prisma/client';
import { PermissionCode } from '../access/permission-codes';
import type { CurrentUser } from '../auth/current-user.interface';
import { AuditService } from '../audit/audit.service';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePromoterVisitDto } from './dto/create-promoter-visit.dto';
import type { ListPromoterVisitsQueryDto } from './dto/list-promoter-visits-query.dto';

const visitInclude = {
  farmerLead: { select: { id: true, fullName: true, phone: true, status: true } },
  farmerProfile: { select: { id: true, fullName: true, primaryPincode: true } },
} satisfies Prisma.PromoterVisitInclude;

@Injectable()
export class PromoterVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePromoterVisitDto, actor: CurrentUser, requestId?: string) {
    this.ensurePromoter(actor);
    if ((dto.farmerLeadId ? 1 : 0) + (dto.farmerProfileId ? 1 : 0) !== 1) {
      throw this.validationError('Exactly one farmer lead or farmer profile is required');
    }
    const occurredAt = new Date(dto.occurredAt);
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      throw this.validationError('Visit occurrence time cannot be in the future');
    }
    const location = this.validateLocation(dto, occurredAt);

    if (dto.farmerLeadId) {
      const lead = await this.prisma.farmerLead.findFirst({
        where: {
          id: dto.farmerLeadId,
          promoterUserId: actor.userId,
          promoterOrganisationId: actor.organisationId,
        },
        select: { id: true },
      });
      if (!lead) throw this.notFound('Owned farmer lead was not found');
    } else {
      const farmerProfileId = dto.farmerProfileId!;
      const attribution = await this.prisma.promoterAttribution.findFirst({
        where: {
          farmerProfileId,
          promoterUserId: actor.userId,
          promoterOrganisationId: actor.organisationId,
          status: PromoterAttributionStatus.ACTIVE,
          farmerProfile: {
            user: {
              status: UserStatus.ACTIVE,
              memberships: {
                some: {
                  role: PlatformRole.FARMER,
                  status: MembershipStatus.ACTIVE,
                  organisation: { status: OrganisationStatus.ACTIVE },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!attribution) throw this.notFound('Active promoter attribution for the farmer was not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.promoterVisit.create({
        data: {
          promoterUserId: actor.userId,
          promoterOrganisationId: actor.organisationId,
          farmerLeadId: dto.farmerLeadId ?? null,
          farmerProfileId: dto.farmerProfileId ?? null,
          purpose: dto.purpose,
          notes: dto.notes?.trim() || null,
          occurredAt,
          locationStatus: dto.locationStatus,
          ...location,
        },
        include: visitInclude,
      });
      await this.auditService.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          organisationId: actor.organisationId,
          action: 'PROMOTER_VISIT_RECORDED',
          resourceType: 'PromoterVisit',
          resourceId: visit.id,
          newValue: {
            farmerLeadId: visit.farmerLeadId,
            farmerProfileId: visit.farmerProfileId,
            purpose: visit.purpose,
            occurredAt: visit.occurredAt.toISOString(),
            locationStatus: visit.locationStatus,
            hasPreciseLocation: visit.locationStatus === PromoterVisitLocationStatus.GRANTED,
          },
          requestId,
          reason: 'Promoter explicitly submitted a field visit record',
        },
        tx,
      );
      return visit;
    });
  }

  async list(
    query: ListPromoterVisitsQueryDto,
    promoterUserId?: string,
    promoterOrganisationId?: string,
  ) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.PromoterVisitWhereInput = {
      ...(promoterUserId ? { promoterUserId } : {}),
      ...(promoterOrganisationId ? { promoterOrganisationId } : {}),
      ...(query.farmerLeadId ? { farmerLeadId: query.farmerLeadId } : {}),
      ...(query.farmerProfileId ? { farmerProfileId: query.farmerProfileId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promoterVisit.findMany({
        where,
        include: visitInclude,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.promoterVisit.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async get(visitId: string, actor: CurrentUser) {
    const visit = await this.prisma.promoterVisit.findUnique({
      where: { id: visitId },
      include: visitInclude,
    });
    if (!visit) throw this.notFound('Promoter visit was not found');
    if (
      !actor.permissions.includes(PermissionCode.PROMOTER_VISITS_READ_ANY) &&
      (visit.promoterUserId !== actor.userId ||
        visit.promoterOrganisationId !== actor.organisationId)
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Promoters may access only their own organisation-scoped visits',
      });
    }
    return visit;
  }

  private validateLocation(dto: CreatePromoterVisitDto, occurredAt: Date) {
    const values = [dto.latitude, dto.longitude, dto.accuracyMetres, dto.locationCapturedAt];
    if (dto.locationStatus !== PromoterVisitLocationStatus.GRANTED) {
      if (values.some((value) => value !== undefined)) {
        throw this.validationError('Coordinates are accepted only when location permission is granted');
      }
      return {
        latitude: null,
        longitude: null,
        accuracyMetres: null,
        locationCapturedAt: null,
      };
    }
    if (values.some((value) => value === undefined)) {
      throw this.validationError('Granted location requires coordinates, accuracy and capture time');
    }
    const capturedAt = new Date(dto.locationCapturedAt!);
    if (capturedAt.getTime() > Date.now() + 5 * 60_000) {
      throw this.validationError('Location capture time cannot be in the future');
    }
    if (Math.abs(capturedAt.getTime() - occurredAt.getTime()) > 30 * 60_000) {
      throw this.validationError('Location must be captured within 30 minutes of the visit time');
    }
    return {
      latitude: dto.latitude!,
      longitude: dto.longitude!,
      accuracyMetres: dto.accuracyMetres!,
      locationCapturedAt: capturedAt,
    };
  }

  private ensurePromoter(actor: CurrentUser) {
    if (actor.role !== PlatformRole.PROMOTER && actor.role !== PlatformRole.SALES_PARTNER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'An active promoter or sales-partner context is required',
      });
    }
  }

  private validationError(message: string) {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string) {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
