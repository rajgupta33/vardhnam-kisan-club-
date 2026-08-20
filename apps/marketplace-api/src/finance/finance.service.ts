import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommissionEntryStatus,
  CommissionEntryType,
  CommissionRuleStatus,
  FinancialLedgerEntryType,
  MembershipStatus,
  PlatformRole,
  Prisma,
  PromoterAttributionStatus,
  type CommissionRule,
  type PaymentIntent,
  type ProductOrder,
} from '@prisma/client';
import type { AuditRecordInput } from '../audit/audit.service';
import { AuditService } from '../audit/audit.service';
import { withAuditActor, type AuditActor } from '../common/audit-actor';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import type { CurrentUser } from '../auth/current-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import type { CreateSettlementDto } from './dto/create-settlement.dto';
import type { ListCommissionEntriesQueryDto } from './dto/list-commission-entries-query.dto';
import type { ListCommissionRulesQueryDto } from './dto/list-commission-rules-query.dto';
import type { ListLedgerQueryDto } from './dto/list-ledger-query.dto';
import type { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import type { ReverseCommissionEntryDto } from './dto/reverse-commission-entry.dto';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Hooks called from other services' own transactions (payments/checkout).
  // -------------------------------------------------------------------------

  async recordFarmerPayment(
    tx: PrismaTransactionClient,
    paymentIntent: PaymentIntent,
    /** Absent when the payment was settled from a gateway webhook. */
    actor: CurrentUser | undefined,
    requestId?: string,
  ): Promise<void> {
    await tx.financialLedgerEntry.create({
      data: {
        entryType: FinancialLedgerEntryType.FARMER_PAYMENT,
        amountPaise: paymentIntent.amountPaise,
        paymentIntentId: paymentIntent.id,
        requestId: requestId ?? null,
        reason: 'Mock payment confirmed',
      },
    });
    const benefitedOrders = await tx.productOrder.findMany({
      where: { checkoutId: paymentIntent.checkoutId, clubBenefitPaise: { gt: 0 } },
      select: { id: true, sellerOrganisationId: true, clubBenefitPaise: true },
    });
    for (const order of benefitedOrders) {
      await tx.financialLedgerEntry.create({
        data: {
          entryType: FinancialLedgerEntryType.CLUB_BENEFIT_SUBSIDY,
          amountPaise: order.clubBenefitPaise,
          organisationId: order.sellerOrganisationId,
          productOrderId: order.id,
          paymentIntentId: paymentIntent.id,
          requestId: requestId ?? null,
          reason: 'Kisan Club benefit funded against gross distributor goods value',
        },
      });
    }
  }

  async reverseCommissionEntriesForOrder(
    tx: PrismaTransactionClient,
    productOrderId: string,
    actor: CurrentUser,
    reason: string,
    requestId?: string,
    refundId?: string,
  ) {
    const siblings = await tx.commissionEntry.findMany({
      where: {
        productOrderId,
        status: { not: CommissionEntryStatus.REVERSED },
      },
    });
    const reversed = [];
    const reversedAt = new Date();
    for (const sibling of siblings) {
      const updated = await tx.commissionEntry.update({
        where: { id: sibling.id },
        data: {
          status: CommissionEntryStatus.REVERSED,
          reversedAt,
          reversalReason: reason,
        },
      });
      await tx.financialLedgerEntry.create({
        data: {
          entryType: FinancialLedgerEntryType.REFUND,
          amountPaise: -sibling.amountPaise,
          organisationId: sibling.sellerOrganisationId,
          productOrderId: sibling.productOrderId,
          commissionEntryId: sibling.id,
          refundId: refundId ?? null,
          requestId: requestId ?? null,
          reason,
        },
      });
      await this.auditService.record(
        this.withActor(actor, {
          action: 'COMMISSION_ENTRY_REVERSED',
          resourceType: 'CommissionEntry',
          resourceId: updated.id,
          organisationId: updated.sellerOrganisationId,
          previousValue: this.commissionEntryAuditValue(sibling),
          newValue: this.commissionEntryAuditValue(updated),
          requestId,
          reason,
        }),
        tx,
      );
      reversed.push(updated);
    }

    return { reversedEntries: reversed };
  }

  async recordDeliveryCommission(
    tx: PrismaTransactionClient,
    order: ProductOrder,
    deliveryPartnerUserId: string,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    const rule = await this.resolveApplicableCommissionRule(
      tx,
      order.sellerOrganisationId,
      order.updatedAt,
    );

    const marketplaceCommissionPaise = Math.round(
      (order.subtotalPaise * rule.marketplaceCommissionBps) / 10_000,
    );
    const distributorPayablePaise = order.subtotalPaise - marketplaceCommissionPaise;
    const returnWindowDays = this.configService.getOrThrow<number>('RETURN_WINDOW_DAYS');
    const eligibleAt = new Date(Date.now() + returnWindowDays * 86_400_000);

    const marketplaceEntry = await tx.commissionEntry.create({
      data: {
        productOrderId: order.id,
        sellerOrganisationId: order.sellerOrganisationId,
        commissionRuleId: rule.id,
        entryType: CommissionEntryType.MARKETPLACE_COMMISSION,
        amountPaise: marketplaceCommissionPaise,
        status: CommissionEntryStatus.PROVISIONAL,
        eligibleAt,
      },
    });
    const payableEntry = await tx.commissionEntry.create({
      data: {
        productOrderId: order.id,
        sellerOrganisationId: order.sellerOrganisationId,
        commissionRuleId: rule.id,
        entryType: CommissionEntryType.DISTRIBUTOR_PAYABLE,
        amountPaise: distributorPayablePaise,
        status: CommissionEntryStatus.PROVISIONAL,
        eligibleAt,
      },
    });

    await tx.financialLedgerEntry.create({
      data: {
        entryType: FinancialLedgerEntryType.MARKETPLACE_COMMISSION,
        amountPaise: marketplaceCommissionPaise,
        organisationId: order.sellerOrganisationId,
        productOrderId: order.id,
        commissionEntryId: marketplaceEntry.id,
        requestId: requestId ?? null,
        reason: 'Marketplace commission calculated on delivery',
      },
    });
    await tx.financialLedgerEntry.create({
      data: {
        entryType: FinancialLedgerEntryType.DISTRIBUTOR_PAYABLE,
        amountPaise: distributorPayablePaise,
        organisationId: order.sellerOrganisationId,
        productOrderId: order.id,
        commissionEntryId: payableEntry.id,
        requestId: requestId ?? null,
        reason: 'Distributor payable calculated on delivery',
      },
    });

    // Promoter commission is platform-borne: it does not reduce the
    // distributor's payable above. The transaction stays between farmer and
    // distributor per docs/PRODUCT_REQUIREMENTS.md#16 -- the distributor did
    // not engage the promoter, so its payout shouldn't shrink because one
    // exists. Only created when an active attribution exists for this order's
    // farmer; skipped entirely otherwise (no zero-amount noise on every order).
    const activeAttribution = await tx.promoterAttribution.findFirst({
      where: { farmerProfileId: order.farmerProfileId, status: PromoterAttributionStatus.ACTIVE },
    });
    let promoterCommissionPaise: number | undefined;
    if (activeAttribution) {
      promoterCommissionPaise = Math.round(
        (order.subtotalPaise * rule.promoterCommissionBps) / 10_000,
      );
      const promoterEntry = await tx.commissionEntry.create({
        data: {
          productOrderId: order.id,
          sellerOrganisationId: order.sellerOrganisationId,
          commissionRuleId: rule.id,
          entryType: CommissionEntryType.PROMOTER_COMMISSION,
          amountPaise: promoterCommissionPaise,
          status: CommissionEntryStatus.PROVISIONAL,
          eligibleAt,
          recipientUserId: activeAttribution.promoterUserId,
        },
      });
      await tx.financialLedgerEntry.create({
        data: {
          entryType: FinancialLedgerEntryType.PROMOTER_COMMISSION,
          amountPaise: promoterCommissionPaise,
          organisationId: activeAttribution.promoterOrganisationId,
          productOrderId: order.id,
          commissionEntryId: promoterEntry.id,
          requestId: requestId ?? null,
          reason: 'Promoter commission calculated on delivery',
        },
      });
    }

    // Delivery fee is likewise platform-borne and unconditional -- every
    // delivered order has exactly one delivery partner, unlike promoter
    // attribution which is optional.
    const deliveryPartnerMembership = await tx.organisationMembership.findFirst({
      where: {
        userId: deliveryPartnerUserId,
        role: PlatformRole.DELIVERY_PARTNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const deliveryFeePaise = rule.deliveryFeePaise;
    const deliveryFeeEntry = await tx.commissionEntry.create({
      data: {
        productOrderId: order.id,
        sellerOrganisationId: order.sellerOrganisationId,
        commissionRuleId: rule.id,
        entryType: CommissionEntryType.DELIVERY_FEE,
        amountPaise: deliveryFeePaise,
        status: CommissionEntryStatus.PROVISIONAL,
        eligibleAt,
        recipientUserId: deliveryPartnerUserId,
      },
    });
    await tx.financialLedgerEntry.create({
      data: {
        entryType: FinancialLedgerEntryType.DELIVERY_FEE,
        amountPaise: deliveryFeePaise,
        organisationId: deliveryPartnerMembership?.organisationId ?? null,
        productOrderId: order.id,
        commissionEntryId: deliveryFeeEntry.id,
        requestId: requestId ?? null,
        reason: 'Delivery fee calculated on delivery',
      },
    });

    await this.auditService.record(
      this.withActor(actor, {
        action: 'PRODUCT_ORDER_COMMISSION_CALCULATED',
        resourceType: 'ProductOrder',
        resourceId: order.id,
        organisationId: order.sellerOrganisationId,
        newValue: {
          commissionRuleId: rule.id,
          marketplaceCommissionPaise,
          distributorPayablePaise,
          promoterCommissionPaise: promoterCommissionPaise ?? null,
          deliveryFeePaise,
          eligibleAt: eligibleAt.toISOString(),
        },
        requestId,
        reason: 'Order delivered',
      }),
      tx,
    );
  }

  private async resolveApplicableCommissionRule(
    client: PrismaTransactionClient | PrismaService,
    sellerOrganisationId: string,
    at: Date,
  ): Promise<CommissionRule> {
    const baseWhere = {
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    } satisfies Prisma.CommissionRuleWhereInput;

    const specificRule = await client.commissionRule.findFirst({
      where: { ...baseWhere, sellerOrganisationId },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (specificRule) {
      return specificRule;
    }

    const globalRule = await client.commissionRule.findFirst({
      where: { ...baseWhere, sellerOrganisationId: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!globalRule) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'No active commission rule is configured',
      });
    }

    return globalRule;
  }

  // -------------------------------------------------------------------------
  // Commission rules
  // -------------------------------------------------------------------------

  async listCommissionRules(query: ListCommissionRulesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.CommissionRuleWhereInput = {
      ...(query.sellerOrganisationId ? { sellerOrganisationId: query.sellerOrganisationId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.commissionRule.findMany({
        where,
        orderBy: { effectiveFrom: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commissionRule.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async createCommissionRule(dto: CreateCommissionRuleDto, actor: CurrentUser, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const effectiveFrom = new Date();
      const sellerOrganisationId = dto.sellerOrganisationId ?? null;

      await tx.commissionRule.updateMany({
        where: { sellerOrganisationId, status: CommissionRuleStatus.ACTIVE },
        data: { status: CommissionRuleStatus.INACTIVE, effectiveTo: effectiveFrom },
      });

      const rule = await tx.commissionRule.create({
        data: {
          sellerOrganisationId,
          marketplaceCommissionBps: dto.marketplaceCommissionBps,
          status: CommissionRuleStatus.ACTIVE,
          effectiveFrom,
          createdByUserId: actor.userId,
          createdByRole: actor.role,
          reason: dto.reason,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'COMMISSION_RULE_CREATED',
          resourceType: 'CommissionRule',
          resourceId: rule.id,
          organisationId: sellerOrganisationId ?? undefined,
          newValue: this.commissionRuleAuditValue(rule),
          requestId,
          reason: dto.reason,
        }),
        tx,
      );

      return rule;
    });
  }

  // -------------------------------------------------------------------------
  // Commission entries
  // -------------------------------------------------------------------------

  async listCommissionEntries(query: ListCommissionEntriesQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.CommissionEntryWhereInput = {
      ...(query.productOrderId ? { productOrderId: query.productOrderId } : {}),
      ...(query.sellerOrganisationId ? { sellerOrganisationId: query.sellerOrganisationId } : {}),
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.commissionEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commissionEntry.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  // Accepts a system actor so the scheduled finalisation job can run this
  // without a human operator; see `common/audit-actor.ts`.
  async finalizeEligibleCommissionEntries(actor: AuditActor, requestId?: string) {
    const now = new Date();
    const eligible = await this.prisma.commissionEntry.findMany({
      where: { status: CommissionEntryStatus.PROVISIONAL, eligibleAt: { lte: now } },
    });

    if (eligible.length === 0) {
      return { finalizedCount: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of eligible) {
        const updated = await tx.commissionEntry.update({
          where: { id: entry.id },
          data: { status: CommissionEntryStatus.FINAL, finalizedAt: now },
        });
        await this.auditService.record(
          this.withActor(actor, {
            action: 'COMMISSION_ENTRY_FINALIZED',
            resourceType: 'CommissionEntry',
            resourceId: updated.id,
            organisationId: updated.sellerOrganisationId,
            previousValue: this.commissionEntryAuditValue(entry),
            newValue: this.commissionEntryAuditValue(updated),
            requestId,
            reason: 'Return/dispute window elapsed',
          }),
          tx,
        );
      }
    });

    return { finalizedCount: eligible.length };
  }

  async reverseCommissionEntry(
    entryId: string,
    dto: ReverseCommissionEntryDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const entry = await this.prisma.commissionEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Commission entry was not found',
      });
    }
    if (entry.status === CommissionEntryStatus.REVERSED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Commission entry has already been reversed',
      });
    }

    return this.prisma.$transaction((tx) =>
      this.reverseCommissionEntriesForOrder(tx, entry.productOrderId, actor, dto.reason, requestId),
    );
  }

  // -------------------------------------------------------------------------
  // Ledger
  // -------------------------------------------------------------------------

  async listLedgerEntries(query: ListLedgerQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.FinancialLedgerEntryWhereInput = {
      ...(query.entryType ? { entryType: query.entryType } : {}),
      ...(query.organisationId ? { organisationId: query.organisationId } : {}),
      ...(query.productOrderId ? { productOrderId: query.productOrderId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financialLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialLedgerEntry.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  // -------------------------------------------------------------------------
  // Settlements
  // -------------------------------------------------------------------------

  async listSettlements(query: ListSettlementsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.SettlementWhereInput = {
      ...(query.sellerOrganisationId ? { sellerOrganisationId: query.sellerOrganisationId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getSettlementById(settlementId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { commissionEntries: true },
    });
    if (!settlement) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Settlement was not found',
      });
    }

    return settlement;
  }

  async createSettlement(dto: CreateSettlementDto, actor: CurrentUser, requestId?: string) {
    const eligibleEntries = await this.prisma.commissionEntry.findMany({
      where: {
        sellerOrganisationId: dto.sellerOrganisationId,
        entryType: CommissionEntryType.DISTRIBUTOR_PAYABLE,
        status: CommissionEntryStatus.FINAL,
        settlementId: null,
      },
    });

    if (eligibleEntries.length === 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'No eligible distributor payable entries to settle',
      });
    }

    const totalPayablePaise = eligibleEntries.reduce((sum, entry) => sum + entry.amountPaise, 0);

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          sellerOrganisationId: dto.sellerOrganisationId,
          settlementNumber: this.generateSettlementNumber(),
          totalPayablePaise,
          entryCount: eligibleEntries.length,
          createdByUserId: actor.userId,
          createdByRole: actor.role,
        },
      });

      await tx.commissionEntry.updateMany({
        where: { id: { in: eligibleEntries.map((entry) => entry.id) } },
        data: { settlementId: settlement.id },
      });

      await tx.financialLedgerEntry.create({
        data: {
          entryType: FinancialLedgerEntryType.SETTLEMENT,
          amountPaise: totalPayablePaise,
          organisationId: dto.sellerOrganisationId,
          settlementId: settlement.id,
          requestId: requestId ?? null,
          reason: 'Distributor payable settlement created',
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'SETTLEMENT_CREATED',
          resourceType: 'Settlement',
          resourceId: settlement.id,
          organisationId: dto.sellerOrganisationId,
          newValue: this.settlementAuditValue(settlement),
          requestId,
          reason: 'Distributor payable settlement created',
        }),
        tx,
      );

      return settlement;
    });
  }

  private generateSettlementNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `SET-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private commissionRuleAuditValue(rule: CommissionRule): Prisma.InputJsonObject {
    return {
      sellerOrganisationId: rule.sellerOrganisationId,
      marketplaceCommissionBps: rule.marketplaceCommissionBps,
      status: rule.status,
      effectiveFrom: rule.effectiveFrom.toISOString(),
    };
  }

  private commissionEntryAuditValue(entry: {
    status: CommissionEntryStatus;
    amountPaise: number;
    entryType: CommissionEntryType;
  }): Prisma.InputJsonObject {
    return {
      entryType: entry.entryType,
      amountPaise: entry.amountPaise,
      status: entry.status,
    };
  }

  private settlementAuditValue(settlement: {
    settlementNumber: string;
    totalPayablePaise: number;
    entryCount: number;
  }): Prisma.InputJsonObject {
    return {
      settlementNumber: settlement.settlementNumber,
      totalPayablePaise: settlement.totalPayablePaise,
      entryCount: settlement.entryCount,
    };
  }

  private withActor(actor: AuditActor, input: AuditRecordInput): AuditRecordInput {
    return withAuditActor(actor, input);
  }
}
