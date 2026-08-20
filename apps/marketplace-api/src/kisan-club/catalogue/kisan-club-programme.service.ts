import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogueStatus,
  KisanClubProgrammeStatus,
  OrganisationType,
  Prisma,
  type KisanClubProductProgramme,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateKisanClubProgrammeDto } from '../dto/create-kisan-club-programme.dto';
import type { ListKisanClubProgrammesQueryDto } from '../dto/list-kisan-club-programmes-query.dto';
import type { UpdateKisanClubProgrammeDto } from '../dto/update-kisan-club-programme.dto';

const allowedProgrammeTransitions: Record<
  KisanClubProgrammeStatus,
  readonly KisanClubProgrammeStatus[]
> = {
  [KisanClubProgrammeStatus.DRAFT]: [KisanClubProgrammeStatus.ACTIVE],
  [KisanClubProgrammeStatus.ACTIVE]: [
    KisanClubProgrammeStatus.PAUSED,
    KisanClubProgrammeStatus.ENDED,
  ],
  [KisanClubProgrammeStatus.PAUSED]: [
    KisanClubProgrammeStatus.ACTIVE,
    KisanClubProgrammeStatus.ENDED,
  ],
  [KisanClubProgrammeStatus.ENDED]: [],
};

@Injectable()
export class KisanClubProgrammeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listProgrammes(query: ListKisanClubProgrammesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.KisanClubProductProgrammeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubProductProgramme.findMany({
        where,
        include: {
          product: { include: { brand: true, companyOrganisation: true } },
          variant: true,
        },
        orderBy: [{ displayPriority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.kisanClubProductProgramme.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async createProgramme(
    dto: CreateKisanClubProgrammeDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    await this.validateProductAndVariant(dto.productId, dto.variantId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateWindow(startsAt, endsAt);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const programme = await tx.kisanClubProductProgramme.create({
          data: {
            productId: dto.productId,
            variantId: dto.variantId ?? null,
            startsAt,
            endsAt,
            eligiblePincodes: this.normaliseList(dto.eligiblePincodes),
            eligibleDistricts: this.normaliseList(dto.eligibleDistricts),
            displayPriority: dto.displayPriority ?? 0,
            createdByUserId: actor.userId,
            createdByRole: actor.role,
            reason: dto.reason.trim(),
          },
        });
        await this.recordAudit(actor, null, programme, requestId, dto.reason, tx);
        return programme;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'This product and variant already have a Kisan Club programme',
        });
      }
      throw error;
    }
  }

  async updateProgramme(
    programmeId: string,
    dto: UpdateKisanClubProgrammeDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (Object.keys(dto).length === 0 || (Object.keys(dto).length === 1 && dto.reason)) {
      throw this.validationError('Provide at least one programme field to update');
    }
    const current = await this.prisma.kisanClubProductProgramme.findUnique({
      where: { id: programmeId },
    });
    if (!current) throw this.notFound();
    if (current.status === KisanClubProgrammeStatus.ENDED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'An ended Kisan Club programme is immutable',
      });
    }
    if (dto.status && dto.status !== current.status) {
      if (!allowedProgrammeTransitions[current.status].includes(dto.status)) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: `Programme cannot move from ${current.status} to ${dto.status}`,
        });
      }
      if (!dto.reason?.trim()) {
        throw this.validationError('A reason is required for programme status changes');
      }
      if (dto.status === KisanClubProgrammeStatus.ACTIVE) {
        await this.validateProductAndVariant(current.productId, current.variantId ?? undefined);
        const effectiveEndsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
        if (effectiveEndsAt && effectiveEndsAt <= new Date()) {
          throw this.validationError('An expired programme cannot be activated');
        }
      }
    }
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.validateWindow(startsAt, endsAt);

    return this.prisma.$transaction(async (tx) => {
      const programme = await tx.kisanClubProductProgramme.update({
        where: { id: programmeId },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.startsAt ? { startsAt } : {}),
          ...(dto.endsAt ? { endsAt } : {}),
          ...(dto.eligiblePincodes
            ? { eligiblePincodes: this.normaliseList(dto.eligiblePincodes) }
            : {}),
          ...(dto.eligibleDistricts
            ? { eligibleDistricts: this.normaliseList(dto.eligibleDistricts) }
            : {}),
          ...(dto.displayPriority !== undefined ? { displayPriority: dto.displayPriority } : {}),
          ...(dto.reason ? { reason: dto.reason.trim() } : {}),
        },
      });
      await this.recordAudit(actor, current, programme, requestId, dto.reason, tx);
      return programme;
    });
  }

  private async validateProductAndVariant(productId: string, variantId?: string) {
    const product = await this.prisma.masterProduct.findFirst({
      where: {
        id: productId,
        status: CatalogueStatus.APPROVED,
        companyOrganisation: { type: OrganisationType.VARDHNAM },
      },
      select: {
        id: true,
        variants: variantId
          ? { where: { id: variantId, isActive: true }, select: { id: true } }
          : false,
      },
    });
    if (!product) {
      throw this.validationError(
        'Only approved products owned by a Vardhnam organisation may join Kisan Club',
      );
    }
    if (variantId && product.variants.length !== 1) {
      throw this.validationError('Programme variant must be active and belong to the product');
    }
  }

  private validateWindow(startsAt: Date, endsAt: Date | null): void {
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw this.validationError('Programme dates are invalid');
    }
    if (endsAt && endsAt <= startsAt) {
      throw this.validationError('Programme end must be after its start');
    }
  }

  private async recordAudit(
    actor: CurrentUser,
    previous: KisanClubProductProgramme | null,
    current: KisanClubProductProgramme,
    requestId: string | undefined,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    await this.auditService.record(
      {
        action: previous ? 'KISAN_CLUB_PROGRAMME_UPDATED' : 'KISAN_CLUB_PROGRAMME_CREATED',
        resourceType: 'KisanClubProductProgramme',
        resourceId: current.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
        previousValue: previous ? this.auditValue(previous) : undefined,
        newValue: this.auditValue(current),
        requestId,
        reason: reason?.trim(),
      },
      tx,
    );
  }

  private auditValue(programme: KisanClubProductProgramme): Prisma.InputJsonObject {
    return {
      productId: programme.productId,
      variantId: programme.variantId,
      status: programme.status,
      startsAt: programme.startsAt.toISOString(),
      endsAt: programme.endsAt?.toISOString() ?? null,
      eligiblePincodes: programme.eligiblePincodes,
      eligibleDistricts: programme.eligibleDistricts,
      displayPriority: programme.displayPriority,
    };
  }

  private normaliseList(values: string[] = []): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ApiErrorCode.NOT_FOUND,
      message: 'Kisan Club product programme was not found',
    });
  }
}
