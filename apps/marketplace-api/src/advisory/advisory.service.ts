import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdvisoryCategory,
  AdvisoryEventStatus,
  AdvisoryRuleStatus,
  CropCycleStatus,
  KisanClubMembershipStatus,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  type AdvisoryRule,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { isSystemActor, type AuditActor } from '../common/audit-actor';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryRuleMatches } from './advisory-matching';
import type { CreateAdvisoryRuleDto } from './dto/create-advisory-rule.dto';
import type {
  ListAdvisoryRulesQueryDto,
  ListMyAdvisoriesQueryDto,
} from './dto/list-advisory-query.dto';
import type { ReviewAdvisoryRuleDto } from './dto/review-advisory-rule.dto';
import type { UpdateAdvisoryRuleDto } from './dto/update-advisory-rule.dto';

const eligibleMembershipStatuses = [
  KisanClubMembershipStatus.ACTIVE,
  KisanClubMembershipStatus.AWAITING_PROMOTER,
];
const editableRuleStatuses: readonly AdvisoryRuleStatus[] = [
  AdvisoryRuleStatus.DRAFT,
  AdvisoryRuleStatus.REJECTED,
  AdvisoryRuleStatus.APPROVED,
];
const archivableRuleStatuses: readonly AdvisoryRuleStatus[] = [
  AdvisoryRuleStatus.APPROVED,
  AdvisoryRuleStatus.REJECTED,
];
const sourceOptionalCategories: readonly AdvisoryCategory[] = [
  AdvisoryCategory.CROP_STAGE,
  AdvisoryCategory.GENERAL_PRACTICE,
];
type FarmerAdvisoryEvent = Prisma.AdvisoryEventGetPayload<{
  include: { advisoryRule: true; cropCycle: { include: { crop: true } } };
}>;

@Injectable()
export class AdvisoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listRules(query: ListAdvisoryRulesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.AdvisoryRuleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.advisoryRule.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.advisoryRule.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  async getRule(id: string) {
    return this.requireRule(id);
  }

  async createRule(dto: CreateAdvisoryRuleDto, actor: CurrentUser, requestId?: string) {
    this.validateWindow(dto.minDaysAfterSowing, dto.maxDaysAfterSowing);
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.advisoryRule.create({ data: this.ruleData(dto, actor.userId) });
      await this.recordAudit(tx, actor, 'ADVISORY_RULE_CREATED', rule, requestId, dto.reason);
      return rule;
    });
  }

  async updateRule(id: string, dto: UpdateAdvisoryRuleDto, actor: CurrentUser, requestId?: string) {
    const current = await this.requireRule(id);
    if (!editableRuleStatuses.includes(current.status)) {
      throw this.conflict('Only draft, rejected or approved advisory rules can be edited');
    }
    const min = dto.minDaysAfterSowing ?? current.minDaysAfterSowing;
    const max = dto.maxDaysAfterSowing ?? current.maxDaysAfterSowing;
    this.validateWindow(min, max);
    if (!dto.reason?.trim()) throw this.validation('A reason is required to edit advisory content');

    return this.prisma.$transaction(async (tx) => {
      const data = this.mergedRuleData(current, dto, actor.userId);
      const updated =
        current.status === AdvisoryRuleStatus.APPROVED
          ? await tx.advisoryRule.create({ data: { ...data, version: current.version + 1 } })
          : await tx.advisoryRule.update({
              where: { id },
              data: {
                ...data,
                status: AdvisoryRuleStatus.DRAFT,
                reviewedAt: null,
                reviewedByUserId: null,
                reviewReason: null,
              },
            });
      await this.recordAudit(
        tx,
        actor,
        current.status === AdvisoryRuleStatus.APPROVED
          ? 'ADVISORY_RULE_VERSION_CREATED'
          : 'ADVISORY_RULE_UPDATED',
        updated,
        requestId,
        dto.reason,
        current,
      );
      return updated;
    });
  }

  async submitRule(id: string, reason: string, actor: CurrentUser, requestId?: string) {
    const current = await this.requireRule(id);
    if (current.status !== AdvisoryRuleStatus.DRAFT)
      throw this.conflict('Only a draft advisory rule can be submitted');
    return this.changeStatus(
      current,
      AdvisoryRuleStatus.PENDING_REVIEW,
      actor,
      requestId,
      reason,
      'ADVISORY_RULE_SUBMITTED',
    );
  }

  async reviewRule(id: string, dto: ReviewAdvisoryRuleDto, actor: CurrentUser, requestId?: string) {
    const current = await this.requireRule(id);
    if (current.status !== AdvisoryRuleStatus.PENDING_REVIEW)
      throw this.conflict('Only a pending advisory rule can be reviewed');
    if (current.authoredByUserId === actor.userId)
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'An advisory author cannot approve their own content',
      });
    if (!dto.approved && !dto.reason?.trim())
      throw this.validation('A rejection reason is required');
    if (
      dto.approved &&
      !sourceOptionalCategories.includes(current.category) &&
      !current.sourceReference?.trim()
    ) {
      throw this.validation(
        'A source reference is required before this advisory category can be approved',
      );
    }
    return this.changeStatus(
      current,
      dto.approved ? AdvisoryRuleStatus.APPROVED : AdvisoryRuleStatus.REJECTED,
      actor,
      requestId,
      dto.reason,
      dto.approved ? 'ADVISORY_RULE_APPROVED' : 'ADVISORY_RULE_REJECTED',
      true,
    );
  }

  async archiveRule(id: string, reason: string, actor: CurrentUser, requestId?: string) {
    const current = await this.requireRule(id);
    if (!archivableRuleStatuses.includes(current.status))
      throw this.conflict('Only approved or rejected advisory rules can be archived');
    return this.changeStatus(
      current,
      AdvisoryRuleStatus.ARCHIVED,
      actor,
      requestId,
      reason,
      'ADVISORY_RULE_ARCHIVED',
    );
  }

  /**
   * Matches approved rules against active crop cycles and publishes advisories.
   *
   * Accepts a system actor so the scheduled job can run this without an
   * operator, which ADR 0009 recorded as the intended end state once a queue
   * existed. Human-triggered generation from the portal still works and is
   * still attributed to that person.
   */
  async generate(actor: AuditActor, requestId?: string, now = new Date()) {
    const human = isSystemActor(actor) ? undefined : actor;
    const dueOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [rules, cycles] = await Promise.all([
      this.prisma.advisoryRule.findMany({ where: { status: AdvisoryRuleStatus.APPROVED } }),
      this.prisma.farmCropCycle.findMany({
        where: {
          status: CropCycleStatus.ACTIVE,
          sowingDate: { not: null, lte: dueOn },
          farm: {
            membership: { advisoryConsent: true, status: { in: eligibleMembershipStatuses } },
          },
        },
        include: {
          crop: true,
          farm: { include: { membership: { include: { farmerProfile: true } } } },
        },
      }),
    ]);
    let generated = 0;
    for (const cycle of cycles) {
      const membership = cycle.farm.membership;
      if (!membership) continue;
      const daysAfterSowing = Math.floor(
        (dueOn.getTime() - cycle.sowingDate!.getTime()) / 86_400_000,
      );
      for (const rule of rules) {
        if (
          !advisoryRuleMatches(rule, {
            cropName: cycle.crop.nameEn,
            varietyName: cycle.varietyName,
            season: cycle.season,
            district: cycle.farm.district,
            state: cycle.farm.state,
            daysAfterSowing,
          })
        )
          continue;
        const existing = await this.prisma.advisoryEvent.findUnique({
          where: {
            cropCycleId_advisoryRuleId_ruleVersion: {
              cropCycleId: cycle.id,
              advisoryRuleId: rule.id,
              ruleVersion: rule.version,
            },
          },
          select: { id: true },
        });
        if (existing) continue;
        try {
          await this.prisma.$transaction(async (tx) => {
            const event = await tx.advisoryEvent.create({
              data: {
                cropCycleId: cycle.id,
                membershipId: membership.id,
                advisoryRuleId: rule.id,
                ruleVersion: rule.version,
                dueOn,
              },
            });
            const hindi = membership.farmerProfile.preferredLocale.toLowerCase().startsWith('hi');
            const notification = await tx.notification.create({
              data: {
                recipientUserId: membership.farmerProfile.userId,
                channel: NotificationChannel.IN_APP,
                category: 'CLUB_ADVISORY_PUBLISHED',
                title: hindi ? rule.titleHi : rule.titleEn,
                body: hindi ? rule.bodyHi : rule.bodyEn,
                payloadSnapshot: { event: 'CLUB_ADVISORY_PUBLISHED', advisoryEventId: event.id },
                status: NotificationStatus.SENT,
                relatedResourceType: 'AdvisoryEvent',
                relatedResourceId: event.id,
                // Null for a scheduled run: no person triggered it. Both
                // columns are nullable precisely so this needs no fake user.
                triggeredByUserId: human?.userId ?? null,
                triggeredByRole: human?.role ?? null,
                reason: 'Approved Kisan Club advisory matched an active crop cycle',
              },
            });
            await tx.advisoryEvent.update({
              where: { id: event.id },
              data: { status: AdvisoryEventStatus.DELIVERED, notificationId: notification.id },
            });
            await this.audit.record(
              {
                ...(human
                  ? {
                      actorUserId: human.userId,
                      actorRole: human.role,
                      organisationId: human.organisationId,
                    }
                  : {}),
                action: 'ADVISORY_EVENT_GENERATED',
                resourceType: 'AdvisoryEvent',
                resourceId: event.id,
                newValue: {
                  cropCycleId: cycle.id,
                  advisoryRuleId: rule.id,
                  ruleVersion: rule.version,
                  notificationId: notification.id,
                },
                requestId,
                reason: 'Deterministic match against approved advisory content',
              },
              tx,
            );
            await this.audit.record(
              {
                ...(human
                  ? {
                      actorUserId: human.userId,
                      actorRole: human.role,
                      organisationId: human.organisationId,
                    }
                  : {}),
                action: 'NOTIFICATION_ENQUEUED',
                resourceType: 'Notification',
                resourceId: notification.id,
                newValue: {
                  recipientUserId: membership.farmerProfile.userId,
                  category: 'CLUB_ADVISORY_PUBLISHED',
                  status: NotificationStatus.SENT,
                  relatedResourceType: 'AdvisoryEvent',
                  relatedResourceId: event.id,
                },
                requestId,
                reason: 'Approved Kisan Club advisory matched an active crop cycle',
              },
              tx,
            );
          });
          generated += 1;
        } catch (error: unknown) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            continue;
          throw error;
        }
      }
    }
    return {
      generated,
      evaluatedCropCycles: cycles.length,
      approvedRules: rules.length,
      dueOn: dueOn.toISOString().slice(0, 10),
    };
  }

  async listMine(query: ListMyAdvisoriesQueryDto, actor: CurrentUser) {
    const membership = await this.requireEligibleMembership(actor);
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.AdvisoryEventWhereInput = {
      membershipId: membership.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.advisoryEvent.findMany({
        where,
        include: { advisoryRule: true, cropCycle: { include: { crop: true } } },
        orderBy: [{ dueOn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.advisoryEvent.count({ where }),
    ]);
    return {
      items: events.map((event) =>
        this.farmerView(event, membership.farmerProfile.preferredLocale),
      ),
      page,
      limit,
      total,
    };
  }

  async getMine(id: string, actor: CurrentUser) {
    const membership = await this.requireEligibleMembership(actor);
    const event = await this.prisma.advisoryEvent.findFirst({
      where: { id, membershipId: membership.id },
      include: { advisoryRule: true, cropCycle: { include: { crop: true } } },
    });
    if (!event) throw this.notFound('Advisory was not found');
    return this.farmerView(event, membership.farmerProfile.preferredLocale);
  }

  async markMine(id: string, status: 'READ' | 'DISMISSED', actor: CurrentUser, requestId?: string) {
    const membership = await this.requireEligibleMembership(actor);
    const event = await this.prisma.advisoryEvent.findFirst({
      where: { id, membershipId: membership.id },
    });
    if (!event) throw this.notFound('Advisory was not found');
    if (event.status === AdvisoryEventStatus.DISMISSED && status === AdvisoryEventStatus.READ)
      throw this.conflict('A dismissed advisory cannot be marked read');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.advisoryEvent.update({
        where: { id },
        data: { status, ...(status === AdvisoryEventStatus.READ ? { readAt: new Date() } : {}) },
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          organisationId: actor.organisationId,
          action:
            status === AdvisoryEventStatus.READ
              ? 'ADVISORY_EVENT_READ'
              : 'ADVISORY_EVENT_DISMISSED',
          resourceType: 'AdvisoryEvent',
          resourceId: id,
          previousValue: { status: event.status },
          newValue: { status },
          requestId,
        },
        tx,
      );
      return updated;
    });
  }

  private async requireEligibleMembership(actor: CurrentUser) {
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: { farmerProfile: { userId: actor.userId } },
      include: { farmerProfile: true },
    });
    if (!membership) throw this.notFound('Kisan Club membership was not found');
    if (!membership.advisoryConsent)
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Advisory consent is required',
      });
    return membership;
  }

  private farmerView(event: FarmerAdvisoryEvent, locale: string) {
    const hindi = locale.toLowerCase().startsWith('hi');
    return {
      id: event.id,
      status: event.status,
      dueOn: event.dueOn.toISOString().slice(0, 10),
      readAt: event.readAt?.toISOString() ?? null,
      category: event.advisoryRule.category,
      title: hindi ? event.advisoryRule.titleHi : event.advisoryRule.titleEn,
      body: hindi ? event.advisoryRule.bodyHi : event.advisoryRule.bodyEn,
      sourceReference: event.advisoryRule.sourceReference,
      ruleVersion: event.ruleVersion,
      cropCycle: {
        id: event.cropCycle.id,
        cropName: hindi ? event.cropCycle.crop.nameHi : event.cropCycle.crop.nameEn,
        varietyName: event.cropCycle.varietyName,
      },
    };
  }

  private async changeStatus(
    current: AdvisoryRule,
    status: AdvisoryRuleStatus,
    actor: CurrentUser,
    requestId: string | undefined,
    reason: string | undefined,
    action: string,
    reviewed = false,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.advisoryRule.update({
        where: { id: current.id },
        data: {
          status,
          ...(reviewed
            ? {
                reviewedByUserId: actor.userId,
                reviewedAt: new Date(),
                reviewReason: reason?.trim() ?? null,
              }
            : {}),
        },
      });
      await this.recordAudit(tx, actor, action, updated, requestId, reason, current);
      return updated;
    });
  }

  private ruleData(
    dto: CreateAdvisoryRuleDto,
    authorId: string,
  ): Prisma.AdvisoryRuleUncheckedCreateInput {
    return {
      cropName: dto.cropName.trim(),
      varietyName: dto.varietyName?.trim() || null,
      category: dto.category,
      minDaysAfterSowing: dto.minDaysAfterSowing,
      maxDaysAfterSowing: dto.maxDaysAfterSowing,
      eligibleStates: this.list(dto.eligibleStates),
      eligibleDistricts: this.list(dto.eligibleDistricts),
      seasons: this.list(dto.seasons),
      titleEn: dto.titleEn.trim(),
      bodyEn: dto.bodyEn.trim(),
      titleHi: dto.titleHi.trim(),
      bodyHi: dto.bodyHi.trim(),
      sourceReference: dto.sourceReference?.trim() || null,
      authoredByUserId: authorId,
    };
  }

  private mergedRuleData(
    current: AdvisoryRule,
    dto: UpdateAdvisoryRuleDto,
    authorId: string,
  ): Prisma.AdvisoryRuleUncheckedCreateInput {
    return {
      cropName: dto.cropName?.trim() ?? current.cropName,
      varietyName:
        dto.varietyName === undefined ? current.varietyName : dto.varietyName.trim() || null,
      category: dto.category ?? current.category,
      minDaysAfterSowing: dto.minDaysAfterSowing ?? current.minDaysAfterSowing,
      maxDaysAfterSowing: dto.maxDaysAfterSowing ?? current.maxDaysAfterSowing,
      eligibleStates: dto.eligibleStates ? this.list(dto.eligibleStates) : current.eligibleStates,
      eligibleDistricts: dto.eligibleDistricts
        ? this.list(dto.eligibleDistricts)
        : current.eligibleDistricts,
      seasons: dto.seasons ? this.list(dto.seasons) : current.seasons,
      titleEn: dto.titleEn?.trim() ?? current.titleEn,
      bodyEn: dto.bodyEn?.trim() ?? current.bodyEn,
      titleHi: dto.titleHi?.trim() ?? current.titleHi,
      bodyHi: dto.bodyHi?.trim() ?? current.bodyHi,
      sourceReference:
        dto.sourceReference === undefined
          ? current.sourceReference
          : dto.sourceReference.trim() || null,
      authoredByUserId: authorId,
    };
  }

  private list(values: string[] = []) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  }
  private validateWindow(min: number, max: number) {
    if (max < min) throw this.validation('Maximum days after sowing must be at least the minimum');
  }
  private async requireRule(id: string) {
    const rule = await this.prisma.advisoryRule.findUnique({ where: { id } });
    if (!rule) throw this.notFound('Advisory rule was not found');
    return rule;
  }
  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: CurrentUser,
    action: string,
    current: AdvisoryRule,
    requestId?: string,
    reason?: string,
    previous?: AdvisoryRule,
  ) {
    await this.audit.record(
      {
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
        action,
        resourceType: 'AdvisoryRule',
        resourceId: current.id,
        previousValue: previous ? this.auditValue(previous) : undefined,
        newValue: this.auditValue(current),
        requestId,
        reason: reason?.trim(),
      },
      tx,
    );
  }
  private auditValue(rule: AdvisoryRule): Prisma.InputJsonObject {
    return {
      cropName: rule.cropName,
      varietyName: rule.varietyName,
      category: rule.category,
      minDaysAfterSowing: rule.minDaysAfterSowing,
      maxDaysAfterSowing: rule.maxDaysAfterSowing,
      eligibleStates: rule.eligibleStates,
      eligibleDistricts: rule.eligibleDistricts,
      seasons: rule.seasons,
      status: rule.status,
      version: rule.version,
      reviewedByUserId: rule.reviewedByUserId,
      reviewedAt: rule.reviewedAt?.toISOString() ?? null,
      sourceReference: rule.sourceReference,
    };
  }
  private validation(message: string) {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }
  private conflict(message: string) {
    return new ConflictException({ code: ApiErrorCode.CONFLICT, message });
  }
  private notFound(message: string) {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
