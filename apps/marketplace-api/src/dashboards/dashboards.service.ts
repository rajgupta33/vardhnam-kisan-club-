import { Injectable } from '@nestjs/common';
import {
  CatalogueStatus,
  CommissionEntryStatus,
  DistributorOfferStatus,
  OrganisationStatus,
  PayoutAccountStatus,
  ProductDeliveryAssignmentStatus,
  ProductOrderStatus,
  PromoterAttributionStatus,
  SettlementStatus,
  SupportTicketStatus,
  TallySyncStatus,
} from '@prisma/client';
import { NotificationStatus } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { PrismaService } from '../prisma/prisma.service';

type DashboardScope = 'PLATFORM' | 'ORGANISATION' | 'SELF';

interface DashboardItemDefinition {
  code: string;
  label: string;
  scope: DashboardScope;
  permission: PermissionCode;
  isApplicable?: (actor: CurrentUser) => boolean;
  count: (actor: CurrentUser) => Promise<number>;
}

export interface DashboardItem {
  code: string;
  label: string;
  scope: DashboardScope;
  count: number;
}

@Injectable()
export class DashboardsService {
  private readonly itemDefinitions: DashboardItemDefinition[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {
    this.itemDefinitions = this.buildItemDefinitions();
  }

  async getSummary(actor: CurrentUser): Promise<{ items: DashboardItem[] }> {
    const applicableItems = this.itemDefinitions.filter(
      (item) =>
        this.accessService.hasPermission(actor, item.permission) &&
        (!item.isApplicable || item.isApplicable(actor)),
    );

    const counts = await Promise.all(applicableItems.map((item) => item.count(actor)));

    return {
      items: applicableItems.map((item, index) => ({
        code: item.code,
        label: item.label,
        scope: item.scope,
        count: counts[index] ?? 0,
      })),
    };
  }

  async exportSummary(actor: CurrentUser, requestId?: string): Promise<{ items: DashboardItem[] }> {
    const summary = await this.getSummary(actor);

    await this.auditService.record({
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: actor.organisationId,
      action: 'DASHBOARD_EXPORTED',
      resourceType: 'DashboardSummary',
      newValue: { itemCodes: summary.items.map((item) => item.code) },
      requestId,
      reason: 'Dashboard summary exported',
    });

    return summary;
  }

  private buildItemDefinitions(): DashboardItemDefinition[] {
    return [
      {
        code: 'onboarding_pending',
        label: 'Organisations pending onboarding verification',
        scope: 'PLATFORM',
        permission: PermissionCode.ONBOARDING_QUEUE_READ,
        count: () =>
          this.prisma.organisation.count({
            where: { status: OrganisationStatus.PENDING_VERIFICATION },
          }),
      },
      {
        code: 'catalogue_pending_review',
        label: 'Catalogue records pending review',
        scope: 'PLATFORM',
        permission: PermissionCode.CATALOGUE_QUEUE_READ,
        count: async () => {
          const [brandCount, productCount] = await Promise.all([
            this.prisma.brand.count({ where: { status: CatalogueStatus.SUBMITTED } }),
            this.prisma.masterProduct.count({ where: { status: CatalogueStatus.SUBMITTED } }),
          ]);
          return brandCount + productCount;
        },
      },
      {
        code: 'offers_pending_review',
        label: 'Distributor offers pending review',
        scope: 'PLATFORM',
        permission: PermissionCode.OFFERS_QUEUE_READ,
        count: () =>
          this.prisma.distributorOffer.count({
            where: { status: DistributorOfferStatus.SUBMITTED },
          }),
      },
      {
        code: 'support_tickets_open_any',
        label: 'Open support tickets (platform-wide)',
        scope: 'PLATFORM',
        permission: PermissionCode.SUPPORT_TICKETS_READ_ANY,
        count: () =>
          this.prisma.supportTicket.count({
            where: { status: { notIn: [SupportTicketStatus.CLOSED] } },
          }),
      },
      {
        code: 'tally_sync_pending',
        label: 'Tally sync records awaiting sync',
        scope: 'PLATFORM',
        permission: PermissionCode.TALLY_SYNC_READ,
        count: () =>
          this.prisma.tallySyncRecord.count({
            where: { status: { in: [TallySyncStatus.PENDING, TallySyncStatus.FAILED] } },
          }),
      },
      {
        code: 'notifications_failed',
        label: 'Failed notifications',
        scope: 'PLATFORM',
        permission: PermissionCode.NOTIFICATIONS_READ_ANY,
        count: () =>
          this.prisma.notification.count({ where: { status: NotificationStatus.FAILED } }),
      },
      {
        code: 'settlements_eligible',
        label: 'Settlements eligible for payout',
        scope: 'PLATFORM',
        permission: PermissionCode.FINANCE_SETTLEMENTS_READ,
        count: () =>
          this.prisma.settlement.count({ where: { status: SettlementStatus.ELIGIBLE } }),
      },
      {
        code: 'commission_entries_provisional',
        label: 'Commission entries ready to finalize',
        scope: 'PLATFORM',
        permission: PermissionCode.FINANCE_COMMISSION_ENTRIES_READ,
        count: () =>
          this.prisma.commissionEntry.count({
            where: { status: CommissionEntryStatus.PROVISIONAL, eligibleAt: { lte: new Date() } },
          }),
      },
      {
        code: 'payout_accounts_pending_verification',
        label: 'Payout accounts pending verification',
        scope: 'PLATFORM',
        permission: PermissionCode.PAYOUT_ACCOUNTS_READ_ANY,
        count: () =>
          this.prisma.payoutAccount.count({
            where: { status: PayoutAccountStatus.PENDING_VERIFICATION },
          }),
      },
      {
        code: 'catalogue_pending_review_own',
        label: 'Own catalogue records pending review',
        scope: 'ORGANISATION',
        permission: PermissionCode.CATALOGUE_READ_OWN,
        isApplicable: (actor) => Boolean(actor.organisationId),
        count: async (actor) => {
          const [brandCount, productCount] = await Promise.all([
            this.prisma.brand.count({
              where: {
                companyOrganisationId: actor.organisationId,
                status: CatalogueStatus.SUBMITTED,
              },
            }),
            this.prisma.masterProduct.count({
              where: {
                companyOrganisationId: actor.organisationId,
                status: CatalogueStatus.SUBMITTED,
              },
            }),
          ]);
          return brandCount + productCount;
        },
      },
      {
        code: 'offers_pending_review_own',
        label: 'Own distributor offers pending review',
        scope: 'ORGANISATION',
        permission: PermissionCode.OFFERS_READ_OWN,
        isApplicable: (actor) => Boolean(actor.organisationId),
        count: (actor) =>
          this.prisma.distributorOffer.count({
            where: {
              distributorOrganisationId: actor.organisationId,
              status: DistributorOfferStatus.SUBMITTED,
            },
          }),
      },
      {
        code: 'fulfilment_orders_pending_own',
        label: 'Own orders awaiting fulfilment action',
        scope: 'ORGANISATION',
        permission: PermissionCode.FULFILMENT_ORDERS_READ_OWN,
        isApplicable: (actor) => Boolean(actor.organisationId),
        count: (actor) =>
          this.prisma.productOrder.count({
            where: {
              sellerOrganisationId: actor.organisationId,
              status: {
                in: [
                  ProductOrderStatus.CONFIRMED,
                  ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
                  ProductOrderStatus.READY_TO_PACK,
                  ProductOrderStatus.PACKED,
                ],
              },
            },
          }),
      },
      {
        code: 'support_tickets_open_own_org',
        label: 'Own organisation\'s open support tickets',
        scope: 'ORGANISATION',
        permission: PermissionCode.SUPPORT_TICKETS_READ_OWN,
        isApplicable: (actor) => Boolean(actor.organisationId),
        count: (actor) =>
          this.prisma.supportTicket.count({
            where: {
              raiserOrganisationId: actor.organisationId,
              status: { notIn: [SupportTicketStatus.CLOSED] },
            },
          }),
      },
      {
        code: 'my_support_tickets_open',
        label: 'My open support tickets',
        scope: 'SELF',
        permission: PermissionCode.SUPPORT_TICKETS_READ_OWN,
        count: (actor) =>
          this.prisma.supportTicket.count({
            where: {
              raisedByUserId: actor.userId,
              status: { notIn: [SupportTicketStatus.CLOSED] },
            },
          }),
      },
      {
        code: 'my_unread_notifications',
        label: 'My unread notifications',
        scope: 'SELF',
        permission: PermissionCode.NOTIFICATIONS_READ_OWN,
        count: (actor) =>
          this.prisma.notification.count({
            where: { recipientUserId: actor.userId, readAt: null },
          }),
      },
      {
        code: 'my_payout_account_action_needed',
        label: 'My payout account needs attention',
        scope: 'SELF',
        permission: PermissionCode.PAYOUT_ACCOUNTS_READ_OWN,
        count: (actor) =>
          this.prisma.payoutAccount.count({
            where: { userId: actor.userId, status: { not: PayoutAccountStatus.VERIFIED } },
          }),
      },
      {
        code: 'my_promoter_attributions_active',
        label: 'My active promoter attributions',
        scope: 'SELF',
        permission: PermissionCode.PROMOTER_ATTRIBUTIONS_READ_OWN,
        count: (actor) =>
          this.prisma.promoterAttribution.count({
            where: { promoterUserId: actor.userId, status: PromoterAttributionStatus.ACTIVE },
          }),
      },
      {
        code: 'my_delivery_assignments_pending',
        label: 'My pending delivery assignments',
        scope: 'SELF',
        permission: PermissionCode.DELIVERY_ASSIGNMENTS_READ_OWN,
        count: (actor) =>
          this.prisma.productDeliveryAssignment.count({
            where: {
              deliveryPartnerUserId: actor.userId,
              status: {
                in: [ProductDeliveryAssignmentStatus.ASSIGNED, ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY],
              },
            },
          }),
      },
    ];
  }
}
