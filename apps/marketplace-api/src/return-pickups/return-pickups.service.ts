import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryPartnerAvailabilityStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  ProductOrderStatus,
  ReturnPickupAssignmentStatus,
  ReturnRequestStatus,
  UserStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import {
  FarmerNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignReturnPickupDto } from './dto/assign-return-pickup.dto';
import type { ListReturnPickupsQueryDto } from './dto/list-return-pickups-query.dto';
import type { ReturnPickupDecisionDto } from './dto/return-pickup-decision.dto';

const pickupInclude = Prisma.validator<Prisma.ReturnPickupAssignmentInclude>()({
  returnRequest: { select: { status: true, reasonCode: true, reasonNote: true } },
});
type PickupWithReturn = Prisma.ReturnPickupAssignmentGetPayload<{ include: typeof pickupInclude }>;

@Injectable()
export class ReturnPickupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  async list(query: ListReturnPickupsQueryDto, actor: CurrentUser) {
    const own = this.readScope(actor);
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.ReturnPickupAssignmentWhereInput = {
      ...(own ? { deliveryPartnerUserId: actor.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.returnPickupAssignment.findMany({
        where,
        include: pickupInclude,
        orderBy: { assignedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.returnPickupAssignment.count({ where }),
    ]);
    return { items: items.map((item) => this.toView(item)), page, limit, total };
  }

  async get(assignmentId: string, actor: CurrentUser) {
    const assignment = await this.find(assignmentId);
    this.ensureReadAccess(actor, assignment);
    return this.toView(assignment);
  }

  async assign(
    returnRequestId: string,
    dto: AssignReturnPickupDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.requirePermission(actor, PermissionCode.RETURN_PICKUPS_MANAGE_ANY);
    const reason = dto.reason?.trim() || 'Return pickup assigned by operations';
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.returnRequest.findUnique({
          where: { id: returnRequestId },
          include: {
            pickupAssignment: true,
            items: { include: { productOrderItem: true }, orderBy: { createdAt: 'asc' } },
            productOrder: true,
          },
        });
        if (!request) throw this.notFound();
        if (
          request.status !== ReturnRequestStatus.APPROVED ||
          request.productOrder.status !== ProductOrderStatus.RETURN_APPROVED
        ) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Only an approved return can be assigned for pickup',
          });
        }
        const partner = await this.findActiveOnlinePartner(tx, dto.deliveryPartnerUserId);
        const existing = request.pickupAssignment;
        if (existing && existing.status !== ReturnPickupAssignmentStatus.REJECTED) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'This return already has an active pickup assignment',
          });
        }
        if (existing?.deliveryPartnerUserId === partner.id) {
          throw new BadRequestException({
            code: ApiErrorCode.VALIDATION_FAILED,
            message: 'A rejected pickup must be reassigned to a different partner',
          });
        }

        const data = {
          deliveryPartnerUserId: partner.id,
          status: ReturnPickupAssignmentStatus.ASSIGNED,
          assignedByUserId: actor.userId,
          assignedByRole: actor.role,
          assignedAt: new Date(),
          respondedByUserId: null,
          respondedByRole: null,
          respondedAt: null,
          rejectionReason: null,
        } satisfies Prisma.ReturnPickupAssignmentUncheckedUpdateInput;
        const assignment = existing
          ? await tx.returnPickupAssignment.update({ where: { id: existing.id }, data })
          : await tx.returnPickupAssignment.create({
              data: {
                returnRequestId: request.id,
                productOrderId: request.productOrderId,
                distributorOrganisationId: request.distributorOrganisationId,
                farmerUserId: request.farmerUserId,
                deliveryPartnerUserId: partner.id,
                assignmentNumber: this.assignmentNumber(),
                status: ReturnPickupAssignmentStatus.ASSIGNED,
                orderNumberSnapshot: request.productOrder.orderNumber,
                sellerNameSnapshot: request.productOrder.sellerNameSnapshot,
                pickupAddressSnapshot: this.toJson(request.productOrder.deliveryAddressSnapshot),
                itemsSnapshot: request.items.map((item) => ({
                  productName: item.productOrderItem.productNameSnapshot,
                  variantName: item.productOrderItem.variantNameSnapshot,
                  quantity: item.quantity,
                })),
                assignedByUserId: actor.userId,
                assignedByRole: actor.role,
              },
            });
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: request.distributorOrganisationId,
            action: existing ? 'RETURN_PICKUP_REASSIGNED' : 'RETURN_PICKUP_ASSIGNED',
            resourceType: 'ReturnPickupAssignment',
            resourceId: assignment.id,
            previousValue: existing ? this.auditValue(existing) : undefined,
            newValue: this.auditValue(assignment),
            requestId,
            reason,
          },
          tx,
        );
        return this.toView(await this.find(assignment.id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async respond(
    assignmentId: string,
    accepted: boolean,
    dto: ReturnPickupDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const supplied = dto.reason?.trim();
    if (!accepted && !supplied) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'A rejection reason is required',
      });
    }
    const reason = supplied || 'Return pickup accepted by delivery partner';
    return this.prisma.$transaction(
      async (tx) => {
        const assignment = await this.find(assignmentId, tx);
        this.ensureManageAccess(actor, assignment);
        if (assignment.status !== ReturnPickupAssignmentStatus.ASSIGNED) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Only an assigned pickup can be accepted or rejected',
          });
        }
        const updated = await tx.returnPickupAssignment.update({
          where: { id: assignment.id },
          data: {
            status: accepted
              ? ReturnPickupAssignmentStatus.ACCEPTED
              : ReturnPickupAssignmentStatus.REJECTED,
            respondedByUserId: actor.userId,
            respondedByRole: actor.role,
            respondedAt: new Date(),
            rejectionReason: accepted ? null : reason,
          },
        });
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: assignment.distributorOrganisationId,
            action: accepted ? 'RETURN_PICKUP_ACCEPTED' : 'RETURN_PICKUP_REJECTED',
            resourceType: 'ReturnPickupAssignment',
            resourceId: assignment.id,
            previousValue: this.auditValue(assignment),
            newValue: this.auditValue(updated),
            requestId,
            reason,
          },
          tx,
        );
        return this.toView(await this.find(updated.id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async collect(
    assignmentId: string,
    dto: ReturnPickupDecisionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const reason = dto.reason?.trim() || 'Return collected from farmer';
    return this.prisma.$transaction(
      async (tx) => {
        const assignment = await this.find(assignmentId, tx);
        this.ensureManageAccess(actor, assignment);
        if (
          assignment.status !== ReturnPickupAssignmentStatus.ACCEPTED ||
          assignment.returnRequest.status !== ReturnRequestStatus.APPROVED
        ) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'Only an accepted approved return pickup can be collected',
          });
        }
        const collectedAt = new Date();
        const updated = await tx.returnPickupAssignment.update({
          where: { id: assignment.id },
          data: {
            status: ReturnPickupAssignmentStatus.COLLECTED,
            collectedByUserId: actor.userId,
            collectedByRole: actor.role,
            collectedAt,
            collectionNote: reason,
          },
        });
        await tx.returnRequest.update({
          where: { id: assignment.returnRequestId },
          data: {
            status: ReturnRequestStatus.IN_TRANSIT,
            statusHistory: {
              create: {
                fromStatus: ReturnRequestStatus.APPROVED,
                toStatus: ReturnRequestStatus.IN_TRANSIT,
                actorUserId: actor.userId,
                actorRole: actor.role,
                reason,
                requestId: requestId ?? null,
              },
            },
          },
        });
        await tx.productOrder.update({
          where: { id: assignment.productOrderId },
          data: {
            status: ProductOrderStatus.RETURN_IN_TRANSIT,
            statusHistory: {
              create: {
                fromStatus: ProductOrderStatus.RETURN_APPROVED,
                toStatus: ProductOrderStatus.RETURN_IN_TRANSIT,
                actorUserId: actor.userId,
                actorRole: actor.role,
                reason,
                requestId: requestId ?? null,
              },
            },
          },
        });
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: assignment.distributorOrganisationId,
            action: 'RETURN_PICKUP_COLLECTED',
            resourceType: 'ReturnPickupAssignment',
            resourceId: assignment.id,
            previousValue: this.auditValue(assignment),
            newValue: this.auditValue(updated),
            requestId,
            reason,
          },
          tx,
        );
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: assignment.distributorOrganisationId,
            action: 'RETURN_PICKUP_RECORDED',
            resourceType: 'ReturnRequest',
            resourceId: assignment.returnRequestId,
            previousValue: { status: ReturnRequestStatus.APPROVED },
            newValue: { status: ReturnRequestStatus.IN_TRANSIT },
            requestId,
            reason,
          },
          tx,
        );
        await this.notificationEventsService.emitFarmerEvent(tx, {
          event: FarmerNotificationEvent.RETURN_IN_TRANSIT,
          recipientUserId: assignment.farmerUserId,
          returnRequestId: assignment.returnRequestId,
          productOrderId: assignment.productOrderId,
          orderNumber: assignment.orderNumberSnapshot,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
        });
        return this.toView(await this.find(updated.id, tx));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private readScope(actor: CurrentUser): boolean {
    if (this.accessService.hasPermission(actor, PermissionCode.RETURN_PICKUPS_READ_ANY))
      return false;
    this.requirePermission(actor, PermissionCode.RETURN_PICKUPS_READ_OWN);
    return true;
  }

  private ensureReadAccess(actor: CurrentUser, assignment: PickupWithReturn): void {
    if (this.accessService.hasPermission(actor, PermissionCode.RETURN_PICKUPS_READ_ANY)) return;
    if (
      this.accessService.hasPermission(actor, PermissionCode.RETURN_PICKUPS_READ_OWN) &&
      assignment.deliveryPartnerUserId === actor.userId
    )
      return;
    throw this.forbidden();
  }

  private ensureManageAccess(actor: CurrentUser, assignment: PickupWithReturn): void {
    if (this.accessService.hasPermission(actor, PermissionCode.RETURN_PICKUPS_MANAGE_ANY)) return;
    if (
      this.accessService.hasPermission(actor, PermissionCode.RETURN_PICKUPS_MANAGE_OWN) &&
      assignment.deliveryPartnerUserId === actor.userId
    )
      return;
    throw this.forbidden();
  }

  private requirePermission(actor: CurrentUser, permission: PermissionCode): void {
    if (!this.accessService.hasPermission(actor, permission)) throw this.forbidden();
  }

  private async find(
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<PickupWithReturn> {
    const assignment = await client.returnPickupAssignment.findUnique({
      where: { id },
      include: pickupInclude,
    });
    if (!assignment) throw this.notFound();
    return assignment;
  }

  private async findActiveOnlinePartner(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: {
            role: PlatformRole.DELIVERY_PARTNER,
            status: MembershipStatus.ACTIVE,
            organisation: {
              type: OrganisationType.DELIVERY_PARTNER,
              status: OrganisationStatus.ACTIVE,
            },
          },
        },
        deliveryPartnerProfiles: {
          where: { availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE },
        },
      },
    });
    const eligibleOrganisationIds = new Set(user?.memberships.map((item) => item.organisationId));
    const online = user?.deliveryPartnerProfiles.some((item) =>
      eligibleOrganisationIds.has(item.organisationId),
    );
    if (!user || user.status !== UserStatus.ACTIVE || !online) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'An active online delivery partner is required',
      });
    }
    return user;
  }

  private toView(assignment: PickupWithReturn) {
    return {
      id: assignment.id,
      returnRequestId: assignment.returnRequestId,
      productOrderId: assignment.productOrderId,
      distributorOrganisationId: assignment.distributorOrganisationId,
      deliveryPartnerUserId: assignment.deliveryPartnerUserId,
      assignmentNumber: assignment.assignmentNumber,
      status: assignment.status,
      orderNumber: assignment.orderNumberSnapshot,
      sellerName: assignment.sellerNameSnapshot,
      pickupAddress: assignment.pickupAddressSnapshot,
      items: assignment.itemsSnapshot,
      returnReasonCode: assignment.returnRequest.reasonCode,
      returnReasonNote: assignment.returnRequest.reasonNote,
      returnStatus: assignment.returnRequest.status,
      assignedAt: assignment.assignedAt,
      respondedAt: assignment.respondedAt,
      rejectionReason: assignment.rejectionReason,
      collectedAt: assignment.collectedAt,
      collectionNote: assignment.collectionNote,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
    };
  }

  private auditValue(assignment: {
    id: string;
    returnRequestId: string;
    deliveryPartnerUserId: string;
    status: ReturnPickupAssignmentStatus;
    assignedAt: Date;
    respondedAt: Date | null;
    rejectionReason: string | null;
    collectedAt: Date | null;
    collectionNote: string | null;
  }) {
    return {
      returnRequestId: assignment.returnRequestId,
      deliveryPartnerUserId: assignment.deliveryPartnerUserId,
      status: assignment.status,
      assignedAt: assignment.assignedAt.toISOString(),
      respondedAt: assignment.respondedAt?.toISOString() ?? null,
      rejectionReason: assignment.rejectionReason,
      collectedAt: assignment.collectedAt?.toISOString() ?? null,
      collectionNote: assignment.collectionNote,
    };
  }

  private assignmentNumber(): string {
    return `RPU-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
  private forbidden() {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message: 'Return pickup permission is required',
    });
  }
  private notFound() {
    return new NotFoundException({
      code: ApiErrorCode.NOT_FOUND,
      message: 'Return pickup assignment was not found',
    });
  }
}
