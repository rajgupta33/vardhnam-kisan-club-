import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KisanClubAssignmentStatus,
  KisanClubFulfilmentMode,
  KisanClubFulfilmentStatus,
  KisanClubMembershipStatus,
  KycDocumentStatus,
  MembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  UserStatus,
  type ProductOrder,
} from '@prisma/client';
import { PermissionCode } from '../../access/permission-codes';
import { AuditService } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { KisanClubFulfilmentActionDto } from '../dto/kisan-club-fulfilment-action.dto';
import type { ListKisanClubFulfilmentQueryDto } from '../dto/list-kisan-club-fulfilment-query.dto';
import type { ReassignKisanClubFulfilmentDto } from '../dto/reassign-kisan-club-fulfilment.dto';

const promoterRoles: PlatformRole[] = [PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER];

const allowedTransitions: Record<KisanClubFulfilmentStatus, readonly KisanClubFulfilmentStatus[]> =
  {
    ASSIGNED: [
      KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
      KisanClubFulfilmentStatus.PROMOTER_DECLINED,
      KisanClubFulfilmentStatus.REASSIGNED,
      KisanClubFulfilmentStatus.CANCELLED,
    ],
    PROMOTER_ACCEPTED: [
      KisanClubFulfilmentStatus.PRODUCT_READY,
      KisanClubFulfilmentStatus.FAILED,
      KisanClubFulfilmentStatus.REASSIGNED,
      KisanClubFulfilmentStatus.CANCELLED,
    ],
    PROMOTER_DECLINED: [KisanClubFulfilmentStatus.REASSIGNED, KisanClubFulfilmentStatus.CANCELLED],
    PRODUCT_READY: [
      KisanClubFulfilmentStatus.FARMER_CONTACTED,
      KisanClubFulfilmentStatus.READY_FOR_PICKUP,
      KisanClubFulfilmentStatus.FAILED,
      KisanClubFulfilmentStatus.REASSIGNED,
      KisanClubFulfilmentStatus.CANCELLED,
    ],
    FARMER_CONTACTED: [
      KisanClubFulfilmentStatus.READY_FOR_PICKUP,
      KisanClubFulfilmentStatus.OUT_FOR_DELIVERY,
      KisanClubFulfilmentStatus.COMPLETED,
      KisanClubFulfilmentStatus.FAILED,
      KisanClubFulfilmentStatus.REASSIGNED,
      KisanClubFulfilmentStatus.CANCELLED,
    ],
    READY_FOR_PICKUP: [
      KisanClubFulfilmentStatus.OUT_FOR_DELIVERY,
      KisanClubFulfilmentStatus.COMPLETED,
      KisanClubFulfilmentStatus.FAILED,
      KisanClubFulfilmentStatus.REASSIGNED,
      KisanClubFulfilmentStatus.CANCELLED,
    ],
    OUT_FOR_DELIVERY: [KisanClubFulfilmentStatus.COMPLETED, KisanClubFulfilmentStatus.FAILED],
    COMPLETED: [],
    FAILED: [KisanClubFulfilmentStatus.REASSIGNED, KisanClubFulfilmentStatus.CANCELLED],
    REASSIGNED: [KisanClubFulfilmentStatus.ASSIGNED],
    CANCELLED: [],
  };

const assignmentInclude = Prisma.validator<Prisma.KisanClubFulfilmentAssignmentInclude>()({
  productOrder: {
    select: {
      orderNumber: true,
      status: true,
      sellerOrganisationId: true,
      sellerNameSnapshot: true,
      serviceablePincode: true,
      subtotalPaise: true,
      clubBenefitPaise: true,
      farmerPayablePaise: true,
      isKisanClubOrder: true,
      createdAt: true,
    },
  },
  membership: {
    select: {
      memberNumber: true,
      status: true,
      homeVillage: true,
      homeDistrict: true,
      homeState: true,
      homePincode: true,
      farmerProfile: { select: { fullName: true } },
    },
  },
  promoterUser: { select: { profile: { select: { displayName: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
});

type AssignmentDetail = Prisma.KisanClubFulfilmentAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>;

@Injectable()
export class KisanClubFulfilmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async createForConfirmedOrders(
    tx: Prisma.TransactionClient,
    orders: ProductOrder[],
    /** Absent when the payment was settled from a gateway webhook. */
    actor: CurrentUser | undefined,
    requestId?: string,
  ): Promise<void> {
    if (!this.configService.get<boolean>('KISAN_CLUB_ENABLED')) return;
    for (const order of orders) {
      if (!order.isKisanClubOrder) continue;
      const existing = await tx.kisanClubFulfilmentAssignment.findUnique({
        where: { productOrderId: order.id },
        select: { id: true },
      });
      if (existing) continue;
      const relationship = await tx.kisanClubPromoterAssignment.findFirst({
        where: {
          status: KisanClubAssignmentStatus.ACTIVE,
          membership: {
            farmerProfileId: order.farmerProfileId,
            status: KisanClubMembershipStatus.ACTIVE,
          },
          promoterUser: {
            status: UserStatus.ACTIVE,
            kisanClubPromoterProfile: {
              clubEnabled: true,
              promoterOrganisation: {
                status: OrganisationStatus.ACTIVE,
                kycDocuments: {
                  some: {
                    status: KycDocumentStatus.APPROVED,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                  },
                },
              },
            },
          },
        },
        select: {
          membershipId: true,
          promoterUserId: true,
          promoterUser: {
            select: {
              kisanClubPromoterProfile: { select: { promoterOrganisationId: true } },
            },
          },
        },
      });
      if (!relationship) continue;
      const promoterOrganisationId =
        relationship.promoterUser.kisanClubPromoterProfile?.promoterOrganisationId;
      if (!promoterOrganisationId) continue;
      const activePromoterMembership = await tx.organisationMembership.findFirst({
        where: {
          userId: relationship.promoterUserId,
          organisationId: promoterOrganisationId,
          role: { in: promoterRoles },
          status: MembershipStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!activePromoterMembership) continue;
      const assistedToken = await tx.kisanClubBenefitToken.findUnique({
        where: { productOrderId: order.id },
        select: { id: true },
      });
      const mode = assistedToken
        ? KisanClubFulfilmentMode.ASSISTED_PURCHASE
        : KisanClubFulfilmentMode.CLUB_HOME_DELIVERY;
      const assignmentReason = assistedToken
        ? 'Assisted Kisan Club order confirmed and assigned to the redeeming promoter'
        : 'Club order confirmed and assigned to the active member promoter';

      const assignment = await tx.kisanClubFulfilmentAssignment.create({
        data: {
          productOrderId: order.id,
          membershipId: relationship.membershipId,
          promoterUserId: relationship.promoterUserId,
          mode,
          statusHistory: {
            create: {
              toStatus: KisanClubFulfilmentStatus.ASSIGNED,
              // Null when the order was confirmed by a gateway webhook rather
              // than by a person; operator surfaces render that as "system".
              changedByUserId: actor?.userId ?? null,
              changedByRole: actor?.role ?? null,
              reason: assignmentReason,
              requestId: requestId ?? null,
            },
          },
        },
      });
      await this.auditService.record(
        {
          action: 'KISAN_CLUB_FULFILMENT_ASSIGNED',
          resourceType: 'KisanClubFulfilmentAssignment',
          resourceId: assignment.id,
          actorUserId: actor?.userId,
          actorRole: actor?.role,
          organisationId: order.sellerOrganisationId,
          newValue: this.auditValue(assignment),
          requestId,
          reason: assignmentReason,
        },
        tx,
      );
    }
  }

  async listAssignments(query: ListKisanClubFulfilmentQueryDto, actor: CurrentUser) {
    this.ensureReadPermission(actor);
    const { page, limit, skip } = paginationOffset(query);
    const canReadAny = actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_READ_ANY);
    const where: Prisma.KisanClubFulfilmentAssignmentWhereInput = {
      ...(!canReadAny ? { promoterUserId: actor.userId } : {}),
      ...(canReadAny && query.promoterUserId ? { promoterUserId: query.promoterUserId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.membershipId ? { membershipId: query.membershipId } : {}),
      ...(query.productOrderId ? { productOrderId: query.productOrderId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubFulfilmentAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kisanClubFulfilmentAssignment.count({ where }),
    ]);
    return { items: items.map((item) => this.toDetail(item)), page, limit, total };
  }

  async getAssignment(assignmentId: string, actor: CurrentUser) {
    const assignment = await this.findAssignmentOrThrow(this.prisma, assignmentId);
    this.ensureReadAccess(actor, assignment);
    return this.toDetail(assignment);
  }

  async transition(
    assignmentId: string,
    toStatus: KisanClubFulfilmentStatus,
    dto: KisanClubFulfilmentActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (
      toStatus === KisanClubFulfilmentStatus.REASSIGNED ||
      toStatus === KisanClubFulfilmentStatus.ASSIGNED
    ) {
      throw this.validationError('This transition requires an operations workflow');
    }
    if (toStatus === KisanClubFulfilmentStatus.CANCELLED) {
      if (!actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_ANY)) {
        throw this.forbidden();
      }
      if (!dto.reason?.trim()) {
        throw this.validationError('A reason is required to cancel Club fulfilment');
      }
    }
    if (
      (toStatus === KisanClubFulfilmentStatus.PROMOTER_DECLINED ||
        toStatus === KisanClubFulfilmentStatus.FAILED) &&
      !dto.reason?.trim()
    ) {
      throw this.validationError('A reason is required for decline or failure');
    }
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.findAssignmentOrThrow(tx, assignmentId);
        this.ensureManageAccess(actor, current);
        this.ensureTransition(current.status, toStatus);
        const now = new Date();
        const updated = await tx.kisanClubFulfilmentAssignment.update({
          where: { id: current.id },
          data: {
            status: toStatus,
            ...(toStatus === KisanClubFulfilmentStatus.PROMOTER_ACCEPTED
              ? { acceptedAt: now }
              : {}),
            ...(toStatus === KisanClubFulfilmentStatus.COMPLETED ? { completedAt: now } : {}),
            ...(toStatus === KisanClubFulfilmentStatus.FAILED
              ? { failureReason: dto.reason!.trim() }
              : {}),
            statusHistory: {
              create: {
                fromStatus: current.status,
                toStatus,
                changedByUserId: actor.userId,
                changedByRole: actor.role,
                reason: dto.reason?.trim() || this.defaultReason(toStatus),
                requestId: requestId ?? null,
              },
            },
          },
          include: assignmentInclude,
        });
        await this.recordTransitionAudit(current, updated, actor, requestId, dto.reason, tx);
        return this.toDetail(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reassign(
    assignmentId: string,
    dto: ReassignKisanClubFulfilmentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (!actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_ANY)) {
      throw this.forbidden();
    }
    return this.prisma.$transaction(
      async (tx) => {
        const current = await this.findAssignmentOrThrow(tx, assignmentId);
        if (current.promoterUserId === dto.promoterUserId) {
          throw this.validationError('Select a different promoter for reassignment');
        }
        this.ensureTransition(current.status, KisanClubFulfilmentStatus.REASSIGNED);
        await this.findEligiblePromoterOrThrow(tx, dto.promoterUserId);
        const now = new Date();
        const updated = await tx.kisanClubFulfilmentAssignment.update({
          where: { id: current.id },
          data: {
            promoterUserId: dto.promoterUserId,
            status: KisanClubFulfilmentStatus.ASSIGNED,
            assignedAt: now,
            acceptedAt: null,
            completedAt: null,
            failureReason: null,
            statusHistory: {
              create: [
                {
                  fromStatus: current.status,
                  toStatus: KisanClubFulfilmentStatus.REASSIGNED,
                  changedByUserId: actor.userId,
                  changedByRole: actor.role,
                  reason: dto.reason.trim(),
                  requestId: requestId ?? null,
                },
                {
                  fromStatus: KisanClubFulfilmentStatus.REASSIGNED,
                  toStatus: KisanClubFulfilmentStatus.ASSIGNED,
                  changedByUserId: actor.userId,
                  changedByRole: actor.role,
                  reason: dto.reason.trim(),
                  requestId: requestId ?? null,
                },
              ],
            },
          },
          include: assignmentInclude,
        });
        await this.recordTransitionAudit(current, updated, actor, requestId, dto.reason, tx);
        return this.toDetail(updated);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async findEligiblePromoterOrThrow(tx: Prisma.TransactionClient, promoterUserId: string) {
    const profile = await tx.kisanClubPromoterProfile.findFirst({
      where: {
        promoterUserId,
        clubEnabled: true,
        promoterUser: { status: UserStatus.ACTIVE },
        promoterOrganisation: {
          status: OrganisationStatus.ACTIVE,
          kycDocuments: {
            some: {
              status: KycDocumentStatus.APPROVED,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
      select: { id: true, promoterOrganisationId: true },
    });
    if (!profile) throw this.validationError('Target promoter is not active and Club-enabled');
    const membership = await tx.organisationMembership.findFirst({
      where: {
        userId: promoterUserId,
        organisationId: profile.promoterOrganisationId,
        role: { in: promoterRoles },
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!membership) {
      throw this.validationError(
        'Target promoter lacks an active promoter organisation membership',
      );
    }
  }

  private async findAssignmentOrThrow(
    client: PrismaService | Prisma.TransactionClient,
    assignmentId: string,
  ): Promise<AssignmentDetail> {
    const assignment = await client.kisanClubFulfilmentAssignment.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
    if (!assignment) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Kisan Club fulfilment assignment was not found',
      });
    }
    return assignment;
  }

  private ensureReadPermission(actor: CurrentUser): void {
    if (
      !actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_READ_OWN) &&
      !actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_READ_ANY)
    )
      throw this.forbidden();
  }

  private ensureReadAccess(actor: CurrentUser, assignment: AssignmentDetail): void {
    if (actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_READ_ANY)) return;
    if (
      actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_READ_OWN) &&
      assignment.promoterUserId === actor.userId
    )
      return;
    throw this.forbidden();
  }

  private ensureManageAccess(actor: CurrentUser, assignment: AssignmentDetail): void {
    if (actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_ANY)) return;
    if (
      actor.permissions.includes(PermissionCode.KISAN_CLUB_FULFILMENT_MANAGE_OWN) &&
      assignment.promoterUserId === actor.userId
    )
      return;
    throw this.forbidden();
  }

  private ensureTransition(
    fromStatus: KisanClubFulfilmentStatus,
    toStatus: KisanClubFulfilmentStatus,
  ): void {
    if (!allowedTransitions[fromStatus].includes(toStatus)) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Club fulfilment cannot move from ${fromStatus} to ${toStatus}`,
      });
    }
  }

  private async recordTransitionAudit(
    previous: AssignmentDetail,
    current: AssignmentDetail,
    actor: CurrentUser,
    requestId: string | undefined,
    reason: string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.auditService.record(
      {
        action: 'KISAN_CLUB_FULFILMENT_UPDATED',
        resourceType: 'KisanClubFulfilmentAssignment',
        resourceId: current.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: current.productOrder.sellerOrganisationId,
        previousValue: this.auditValue(previous),
        newValue: this.auditValue(current),
        requestId,
        reason: reason?.trim() || this.defaultReason(current.status),
      },
      tx,
    );
  }

  private auditValue(assignment: {
    productOrderId: string;
    membershipId: string;
    promoterUserId: string;
    mode: KisanClubFulfilmentMode;
    status: KisanClubFulfilmentStatus;
    assignedAt: Date;
    acceptedAt: Date | null;
    completedAt: Date | null;
    failureReason: string | null;
  }): Prisma.InputJsonObject {
    return {
      productOrderId: assignment.productOrderId,
      membershipId: assignment.membershipId,
      promoterUserId: assignment.promoterUserId,
      mode: assignment.mode,
      status: assignment.status,
      assignedAt: assignment.assignedAt.toISOString(),
      acceptedAt: assignment.acceptedAt?.toISOString() ?? null,
      completedAt: assignment.completedAt?.toISOString() ?? null,
      failureReason: assignment.failureReason,
    };
  }

  private toDetail(assignment: AssignmentDetail) {
    return {
      id: assignment.id,
      productOrderId: assignment.productOrderId,
      membershipId: assignment.membershipId,
      promoterUserId: assignment.promoterUserId,
      promoterName: assignment.promoterUser.profile?.displayName ?? null,
      mode: assignment.mode,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      acceptedAt: assignment.acceptedAt,
      completedAt: assignment.completedAt,
      failureReason: assignment.failureReason,
      member: {
        memberNumber: assignment.membership.memberNumber,
        fullName: assignment.membership.farmerProfile.fullName,
        status: assignment.membership.status,
        village: assignment.membership.homeVillage,
        district: assignment.membership.homeDistrict,
        state: assignment.membership.homeState,
        pincode: assignment.membership.homePincode,
      },
      order: assignment.productOrder,
      statusHistory: assignment.statusHistory,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private defaultReason(status: KisanClubFulfilmentStatus): string {
    return `Kisan Club fulfilment moved to ${status}`;
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message: 'You cannot access this Kisan Club fulfilment assignment',
    });
  }
}
