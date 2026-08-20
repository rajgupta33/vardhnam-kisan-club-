import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CropCycleStatus,
  KisanClubBenefitStatus,
  KisanClubBenefitType,
  KisanClubMembershipStatus,
  KisanClubProgrammeStatus,
  Prisma,
  type KisanClubBenefitRule,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateKisanClubBenefitRuleDto } from '../dto/create-kisan-club-benefit-rule.dto';
import type { ListKisanClubBenefitRulesQueryDto } from '../dto/list-kisan-club-benefit-rules-query.dto';
import type { UpdateKisanClubBenefitRuleDto } from '../dto/update-kisan-club-benefit-rule.dto';

type BenefitClient = PrismaService | Prisma.TransactionClient;

export interface KisanClubBenefitEvaluation {
  membershipId: string;
  ruleId: string;
  perUnitBenefitPaise: number;
  totalBenefitPaise: number;
}

export interface BenefitAmountInput {
  benefitType: KisanClubBenefitType;
  flatAmountPaise: number | null;
  percentBps: number | null;
  maxBenefitPaise: number | null;
  minimumQuantity: number;
  unitPricePaise: number;
  quantity: number;
}

export function calculateKisanClubBenefit(input: BenefitAmountInput): {
  perUnitBenefitPaise: number;
  totalBenefitPaise: number;
} {
  if (input.quantity < input.minimumQuantity || input.quantity <= 0 || input.unitPricePaise <= 0) {
    return { perUnitBenefitPaise: 0, totalBenefitPaise: 0 };
  }
  const rawPerUnit =
    input.benefitType === KisanClubBenefitType.PERCENT_OFF
      ? Math.floor((input.unitPricePaise * (input.percentBps ?? 0)) / 10_000)
      : (input.flatAmountPaise ?? 0);
  const perUnitBenefitPaise = Math.min(input.unitPricePaise, Math.max(0, rawPerUnit));
  const grossLinePaise = input.unitPricePaise * input.quantity;
  const uncappedTotal = perUnitBenefitPaise * input.quantity;
  const totalBenefitPaise = Math.min(
    grossLinePaise,
    input.maxBenefitPaise === null ? uncappedTotal : Math.min(uncappedTotal, input.maxBenefitPaise),
  );
  return { perUnitBenefitPaise, totalBenefitPaise };
}

const allowedTransitions: Record<KisanClubBenefitStatus, readonly KisanClubBenefitStatus[]> = {
  DRAFT: [KisanClubBenefitStatus.ACTIVE],
  ACTIVE: [KisanClubBenefitStatus.PAUSED, KisanClubBenefitStatus.EXPIRED],
  PAUSED: [KisanClubBenefitStatus.ACTIVE, KisanClubBenefitStatus.EXPIRED],
  EXPIRED: [],
};

@Injectable()
export class KisanClubBenefitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async listRules(query: ListKisanClubBenefitRulesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.KisanClubBenefitRuleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.programmeId ? { programmeId: query.programmeId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubBenefitRule.findMany({
        where,
        include: { programme: { include: { product: true, variant: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kisanClubBenefitRule.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async createRule(dto: CreateKisanClubBenefitRuleDto, actor: CurrentUser, requestId?: string) {
    const programme = await this.prisma.kisanClubProductProgramme.findUnique({
      where: { id: dto.programmeId },
    });
    if (!programme) throw this.notFound('Kisan Club programme was not found');
    await this.validateCropIds(dto.eligibleCropIds ?? []);
    this.validateRuleShape(dto.benefitType, dto.flatAmountPaise, dto.percentBps);
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateWindowAndLimits(startsAt, endsAt, dto.totalUsageLimit, dto.perMemberUsageLimit);

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.kisanClubBenefitRule.create({
        data: {
          programmeId: dto.programmeId,
          benefitType: dto.benefitType,
          flatAmountPaise: dto.flatAmountPaise ?? null,
          percentBps: dto.percentBps ?? null,
          maxBenefitPaise: dto.maxBenefitPaise ?? null,
          minimumQuantity: dto.minimumQuantity ?? 1,
          eligiblePincodes: this.normaliseList(dto.eligiblePincodes),
          eligibleCropIds: this.normaliseList(dto.eligibleCropIds),
          startsAt,
          endsAt,
          totalUsageLimit: dto.totalUsageLimit ?? null,
          perMemberUsageLimit: dto.perMemberUsageLimit ?? null,
          createdByUserId: actor.userId,
          createdByRole: actor.role,
          reason: dto.reason.trim(),
        },
      });
      await this.recordAudit(actor, null, rule, requestId, dto.reason, tx);
      return rule;
    });
  }

  async updateRule(
    ruleId: string,
    dto: UpdateKisanClubBenefitRuleDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const current = await this.prisma.kisanClubBenefitRule.findUnique({ where: { id: ruleId } });
    if (!current) throw this.notFound('Kisan Club benefit rule was not found');
    if (current.status === KisanClubBenefitStatus.EXPIRED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'An expired benefit rule is immutable',
      });
    }
    const economicFields = [
      'benefitType',
      'flatAmountPaise',
      'percentBps',
      'maxBenefitPaise',
      'minimumQuantity',
      'eligiblePincodes',
      'eligibleCropIds',
      'startsAt',
      'totalUsageLimit',
      'perMemberUsageLimit',
    ];
    if (current.usageCount > 0 && economicFields.some((field) => field in dto)) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'A redeemed benefit rule cannot change its financial or eligibility terms',
      });
    }
    if (dto.status && dto.status !== current.status) {
      if (!allowedTransitions[current.status].includes(dto.status)) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: `Benefit rule cannot move from ${current.status} to ${dto.status}`,
        });
      }
      if (dto.status === KisanClubBenefitStatus.ACTIVE) {
        const programme = await this.prisma.kisanClubProductProgramme.findFirst({
          where: { id: current.programmeId, status: KisanClubProgrammeStatus.ACTIVE },
          select: { id: true },
        });
        if (!programme) throw this.validationError('Benefit rule requires an active programme');
      }
    }
    await this.validateCropIds(dto.eligibleCropIds ?? []);
    const benefitType = dto.benefitType ?? current.benefitType;
    const flatAmountPaise =
      benefitType === KisanClubBenefitType.PERCENT_OFF
        ? undefined
        : (dto.flatAmountPaise ?? current.flatAmountPaise ?? undefined);
    const percentBps =
      benefitType === KisanClubBenefitType.PERCENT_OFF
        ? (dto.percentBps ?? current.percentBps ?? undefined)
        : undefined;
    this.validateRuleShape(benefitType, flatAmountPaise, percentBps);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.validateWindowAndLimits(
      startsAt,
      endsAt,
      dto.totalUsageLimit ?? current.totalUsageLimit ?? undefined,
      dto.perMemberUsageLimit ?? current.perMemberUsageLimit ?? undefined,
    );

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.kisanClubBenefitRule.update({
        where: { id: ruleId },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          benefitType,
          flatAmountPaise: flatAmountPaise ?? null,
          percentBps: percentBps ?? null,
          ...(dto.maxBenefitPaise !== undefined ? { maxBenefitPaise: dto.maxBenefitPaise } : {}),
          ...(dto.minimumQuantity !== undefined ? { minimumQuantity: dto.minimumQuantity } : {}),
          ...(dto.eligiblePincodes
            ? { eligiblePincodes: this.normaliseList(dto.eligiblePincodes) }
            : {}),
          ...(dto.eligibleCropIds
            ? { eligibleCropIds: this.normaliseList(dto.eligibleCropIds) }
            : {}),
          ...(dto.startsAt ? { startsAt } : {}),
          ...(dto.endsAt ? { endsAt } : {}),
          ...(dto.totalUsageLimit !== undefined ? { totalUsageLimit: dto.totalUsageLimit } : {}),
          ...(dto.perMemberUsageLimit !== undefined
            ? { perMemberUsageLimit: dto.perMemberUsageLimit }
            : {}),
          reason: dto.reason.trim(),
        },
      });
      await this.recordAudit(actor, current, rule, requestId, dto.reason, tx);
      return rule;
    });
  }

  async evaluateForCheckout(
    tx: BenefitClient,
    input: {
      farmerProfileId: string;
      productId: string;
      variantId: string;
      pincode: string;
      unitPricePaise: number;
      quantity: number;
      at: Date;
      reservedRuleUsage?: ReadonlyMap<string, number>;
    },
  ): Promise<KisanClubBenefitEvaluation | null> {
    if (!this.configService.get<boolean>('KISAN_CLUB_ENABLED')) return null;
    const membership = await tx.kisanClubMembership.findFirst({
      where: { farmerProfileId: input.farmerProfileId, status: KisanClubMembershipStatus.ACTIVE },
      select: {
        id: true,
        homeDistrict: true,
        farms: {
          where: { isActive: true },
          select: {
            cropCycles: {
              where: { status: CropCycleStatus.ACTIVE },
              select: { cropId: true },
            },
          },
        },
      },
    });
    if (!membership) return null;
    const cropIds = new Set(
      membership.farms.flatMap((farm) => farm.cropCycles.map((cycle) => cycle.cropId)),
    );
    const rules = await tx.kisanClubBenefitRule.findMany({
      where: {
        status: KisanClubBenefitStatus.ACTIVE,
        startsAt: { lte: input.at },
        OR: [{ endsAt: null }, { endsAt: { gt: input.at } }],
        programme: {
          status: KisanClubProgrammeStatus.ACTIVE,
          startsAt: { lte: input.at },
          AND: [
            { OR: [{ endsAt: null }, { endsAt: { gt: input.at } }] },
            { OR: [{ variantId: null }, { variantId: input.variantId }] },
            {
              OR: [
                { eligiblePincodes: { isEmpty: true } },
                { eligiblePincodes: { has: input.pincode } },
              ],
            },
            {
              OR: [
                { eligibleDistricts: { isEmpty: true } },
                { eligibleDistricts: { has: membership.homeDistrict ?? '' } },
              ],
            },
          ],
          productId: input.productId,
        },
      },
      include: {
        redemptions: { where: { membershipId: membership.id }, select: { id: true } },
      },
    });

    const eligible = rules.flatMap((rule) => {
      const reservedUsage = input.reservedRuleUsage?.get(rule.id) ?? 0;
      if (rule.totalUsageLimit !== null && rule.usageCount + reservedUsage >= rule.totalUsageLimit)
        return [];
      if (
        rule.perMemberUsageLimit !== null &&
        rule.redemptions.length + reservedUsage >= rule.perMemberUsageLimit
      )
        return [];
      if (rule.eligiblePincodes.length > 0 && !rule.eligiblePincodes.includes(input.pincode))
        return [];
      if (rule.eligibleCropIds.length > 0 && !rule.eligibleCropIds.some((id) => cropIds.has(id)))
        return [];
      const amount = calculateKisanClubBenefit({
        ...rule,
        unitPricePaise: input.unitPricePaise,
        quantity: input.quantity,
      });
      if (amount.totalBenefitPaise <= 0) return [];
      const specificity =
        Number(rule.eligibleCropIds.length > 0) * 2 + Number(rule.eligiblePincodes.length > 0);
      return [{ rule, ...amount, specificity }];
    });
    eligible.sort(
      (a, b) =>
        b.totalBenefitPaise - a.totalBenefitPaise ||
        b.specificity - a.specificity ||
        a.rule.startsAt.getTime() - b.rule.startsAt.getTime() ||
        a.rule.id.localeCompare(b.rule.id),
    );
    const selected = eligible[0];
    return selected
      ? {
          membershipId: membership.id,
          ruleId: selected.rule.id,
          perUnitBenefitPaise: selected.perUnitBenefitPaise,
          totalBenefitPaise: selected.totalBenefitPaise,
        }
      : null;
  }

  async isProgrammeEligibleForCheckout(
    client: BenefitClient,
    input: {
      farmerProfileId: string;
      productId: string;
      variantId: string;
      pincode: string;
      at: Date;
    },
  ): Promise<boolean> {
    if (!this.configService.get<boolean>('KISAN_CLUB_ENABLED')) return false;
    const membership = await client.kisanClubMembership.findFirst({
      where: {
        farmerProfileId: input.farmerProfileId,
        status: KisanClubMembershipStatus.ACTIVE,
      },
      select: { homeDistrict: true },
    });
    if (!membership) return false;
    const programme = await client.kisanClubProductProgramme.findFirst({
      where: {
        productId: input.productId,
        status: KisanClubProgrammeStatus.ACTIVE,
        startsAt: { lte: input.at },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gt: input.at } }] },
          { OR: [{ variantId: null }, { variantId: input.variantId }] },
          {
            OR: [
              { eligiblePincodes: { isEmpty: true } },
              { eligiblePincodes: { has: input.pincode } },
            ],
          },
          {
            OR: [
              { eligibleDistricts: { isEmpty: true } },
              { eligibleDistricts: { has: membership.homeDistrict ?? '' } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    return programme !== null;
  }

  async redeem(
    tx: Prisma.TransactionClient,
    evaluation: KisanClubBenefitEvaluation,
    input: {
      productOrderId: string;
      productOrderItemId: string;
      quantity: number;
      benefitTokenId?: string;
    },
  ): Promise<void> {
    const rule = await tx.kisanClubBenefitRule.findUniqueOrThrow({
      where: { id: evaluation.ruleId },
    });
    if (rule.perMemberUsageLimit !== null) {
      const memberUsage = await tx.kisanClubBenefitRedemption.count({
        where: { ruleId: rule.id, membershipId: evaluation.membershipId },
      });
      if (memberUsage >= rule.perMemberUsageLimit) throw this.exhausted();
    }
    const incremented = await tx.kisanClubBenefitRule.updateMany({
      where: {
        id: rule.id,
        status: KisanClubBenefitStatus.ACTIVE,
        ...(rule.totalUsageLimit !== null ? { usageCount: { lt: rule.totalUsageLimit } } : {}),
      },
      data: { usageCount: { increment: 1 } },
    });
    if (incremented.count !== 1) throw this.exhausted();
    await tx.kisanClubBenefitRedemption.create({
      data: {
        ruleId: rule.id,
        membershipId: evaluation.membershipId,
        productOrderId: input.productOrderId,
        productOrderItemId: input.productOrderItemId,
        quantity: input.quantity,
        perUnitBenefitPaise: evaluation.perUnitBenefitPaise,
        totalBenefitPaise: evaluation.totalBenefitPaise,
        benefitTokenId: input.benefitTokenId ?? null,
      },
    });
  }

  private validateRuleShape(type: KisanClubBenefitType, flat?: number, percent?: number): void {
    if (type === KisanClubBenefitType.PERCENT_OFF) {
      if (!percent || flat !== undefined)
        throw this.validationError('Percentage rules require only percentBps');
      return;
    }
    if (!flat || percent !== undefined)
      throw this.validationError('Flat and threshold rules require only flatAmountPaise');
  }

  private validateWindowAndLimits(
    startsAt: Date,
    endsAt: Date | null,
    total?: number,
    perMember?: number,
  ): void {
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw this.validationError('Benefit rule dates are invalid');
    }
    if (endsAt && endsAt <= startsAt)
      throw this.validationError('Benefit rule end must be after its start');
    if (total !== undefined && perMember !== undefined && perMember > total) {
      throw this.validationError('Per-member usage limit cannot exceed the total usage limit');
    }
  }

  private async validateCropIds(cropIds: string[]): Promise<void> {
    const unique = this.normaliseList(cropIds);
    if (unique.length === 0) return;
    const count = await this.prisma.crop.count({ where: { id: { in: unique }, isActive: true } });
    if (count !== unique.length)
      throw this.validationError('Every eligible crop must be active and recognised');
  }

  private async recordAudit(
    actor: CurrentUser,
    previous: KisanClubBenefitRule | null,
    current: KisanClubBenefitRule,
    requestId: string | undefined,
    reason: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.auditService.record(
      {
        action: previous ? 'KISAN_CLUB_BENEFIT_RULE_UPDATED' : 'KISAN_CLUB_BENEFIT_RULE_CREATED',
        resourceType: 'KisanClubBenefitRule',
        resourceId: current.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
        previousValue: previous ? this.auditValue(previous) : undefined,
        newValue: this.auditValue(current),
        requestId,
        reason: reason.trim(),
      },
      tx,
    );
  }

  private auditValue(rule: KisanClubBenefitRule): Prisma.InputJsonObject {
    return {
      programmeId: rule.programmeId,
      benefitType: rule.benefitType,
      flatAmountPaise: rule.flatAmountPaise,
      percentBps: rule.percentBps,
      maxBenefitPaise: rule.maxBenefitPaise,
      minimumQuantity: rule.minimumQuantity,
      status: rule.status,
      startsAt: rule.startsAt.toISOString(),
      endsAt: rule.endsAt?.toISOString() ?? null,
      totalUsageLimit: rule.totalUsageLimit,
      perMemberUsageLimit: rule.perMemberUsageLimit,
      usageCount: rule.usageCount,
    };
  }

  private normaliseList(values: string[] = []): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }

  private exhausted(): ConflictException {
    return new ConflictException({
      code: ApiErrorCode.CONFLICT,
      message:
        'Kisan Club benefit usage limit was reached during checkout; retry to refresh pricing',
    });
  }
}
