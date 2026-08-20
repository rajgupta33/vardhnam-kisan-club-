import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DisputeEventType,
  DisputeResolutionOutcome,
  DisputeStatus,
  FinancialLedgerEntryType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  ProductOrderStatus,
  UserStatus,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import {
  FarmerDisputeNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignDisputeDto } from './dto/assign-dispute.dto';
import type { CreateDisputeDto } from './dto/create-dispute.dto';
import type { DisputeNoteDto } from './dto/dispute-note.dto';
import type { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { DisputeInfoTarget, type RequestDisputeInfoDto } from './dto/request-dispute-info.dto';
import type { ResolveDisputeDto } from './dto/resolve-dispute.dto';

const disputeInclude = Prisma.validator<Prisma.DisputeInclude>()({
  productOrder: {
    select: {
      orderNumber: true,
      sellerNameSnapshot: true,
      status: true,
      farmerPayablePaise: true,
    },
  },
  returnRequest: { select: { id: true, status: true } },
  events: { orderBy: { createdAt: 'asc' } },
});

type DisputeWithDetails = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;

const DISPUTABLE_ORDER_STATUSES = new Set<ProductOrderStatus>([
  ProductOrderStatus.DELIVERED,
  ProductOrderStatus.RETURN_REJECTED,
  ProductOrderStatus.REFUNDED,
  ProductOrderStatus.CLOSED,
]);

const RESOLVED_STATUSES = new Set<DisputeStatus>([
  DisputeStatus.RESOLVED_FOR_FARMER,
  DisputeStatus.RESOLVED_FOR_DISTRIBUTOR,
  DisputeStatus.RESOLVED_SPLIT,
]);

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly auditService: AuditService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  async createDispute(dto: CreateDisputeDto, actor: CurrentUser, idempotencyKey?: string, requestId?: string) {
    const key = this.normalizedKey(idempotencyKey);
    const requestHash = this.hash({ actorUserId: actor.userId, dto });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await tx.dispute.findUnique({
          where: { raisedByUserId_idempotencyKey: { raisedByUserId: actor.userId, idempotencyKey: key } },
          include: disputeInclude,
        });
        if (replay) {
          if (replay.requestHash !== requestHash) {
            throw new ConflictException({
              code: ApiErrorCode.CONFLICT,
              message: 'Idempotency-Key was already used with a different dispute request',
            });
          }
          return this.present(replay);
        }

        const order = await tx.productOrder.findUnique({
          where: { id: dto.productOrderId },
          include: { farmerProfile: { select: { userId: true } } },
        });
        if (!order) {
          throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Product order was not found' });
        }
        this.assertCanRaise(order.farmerProfile.userId, order.sellerOrganisationId, actor);
        if (!DISPUTABLE_ORDER_STATUSES.has(order.status)) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: `A dispute cannot be opened while the product order is ${order.status}`,
          });
        }
        if (dto.returnRequestId) {
          const linkedReturn = await tx.returnRequest.findFirst({
            where: { id: dto.returnRequestId, productOrderId: order.id },
          });
          if (!linkedReturn) {
            throw new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'The selected return request does not belong to this product order',
            });
          }
        }
        const active = await tx.dispute.findFirst({
          where: { productOrderId: order.id, status: { not: DisputeStatus.CLOSED } },
        });
        if (active) {
          throw new ConflictException({
            code: ApiErrorCode.CONFLICT,
            message: 'This product order already has a dispute that is not closed',
          });
        }

        const created = await tx.dispute.create({
          data: {
            productOrderId: order.id,
            returnRequestId: dto.returnRequestId ?? null,
            farmerUserId: order.farmerProfile.userId,
            distributorOrganisationId: order.sellerOrganisationId,
            raisedByUserId: actor.userId,
            raisedByRole: actor.role,
            againstOrganisationId: actor.role === PlatformRole.FARMER ? order.sellerOrganisationId : null,
            category: dto.category,
            description: dto.description,
            orderStatusBeforeDispute: order.status,
            idempotencyKey: key,
            requestHash,
            events: {
              create: {
                eventType: DisputeEventType.CREATED,
                toStatus: DisputeStatus.OPEN,
                actorUserId: actor.userId,
                actorRole: actor.role,
                note: dto.description,
                requestId: requestId ?? null,
              },
            },
          },
          include: disputeInclude,
        });

        await tx.productOrder.update({
          where: { id: order.id },
          data: {
            status: ProductOrderStatus.DISPUTED,
            statusHistory: {
              create: {
                fromStatus: order.status,
                toStatus: ProductOrderStatus.DISPUTED,
                actorUserId: actor.userId,
                actorRole: actor.role,
                reason: 'Product-order dispute opened',
                requestId: requestId ?? null,
              },
            },
          },
        });
        await this.auditService.record({
          actorUserId: actor.userId,
          actorRole: actor.role,
          organisationId: order.sellerOrganisationId,
          action: 'DISPUTE_CREATED',
          resourceType: 'Dispute',
          resourceId: created.id,
          newValue: {
            productOrderId: order.id,
            returnRequestId: dto.returnRequestId ?? null,
            category: dto.category,
            status: DisputeStatus.OPEN,
          },
          requestId,
          reason: dto.description,
        }, tx);
        await this.notificationEventsService.emitDisputeEvent(tx, {
          event: FarmerDisputeNotificationEvent.DISPUTE_RAISED,
          recipientUserId: order.farmerProfile.userId,
          disputeId: created.id,
          productOrderId: order.id,
          orderNumber: order.orderNumber,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
        });
        return this.present(created);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'This product order already has a dispute that is not closed',
        });
      }
      throw error;
    }
  }

  async listMyDisputes(query: ListDisputesQueryDto, actor: CurrentUser) {
    if (actor.role !== PlatformRole.FARMER || !this.has(actor, PermissionCode.DISPUTES_READ_OWN)) {
      throw this.forbidden('Farmer dispute permission is required');
    }
    return this.list(query, { farmerUserId: actor.userId });
  }

  async listDisputes(query: ListDisputesQueryDto, actor: CurrentUser) {
    let organisationId = query.distributorOrganisationId;
    if (!this.has(actor, PermissionCode.DISPUTES_READ_ANY)) {
      if (!this.has(actor, PermissionCode.DISPUTES_READ_SELLER_OWN)) {
        throw this.forbidden('Dispute read permission is required');
      }
      if (organisationId && organisationId !== actor.organisationId) {
        throw this.forbidden('Distributor users may only read their own seller disputes');
      }
      organisationId = actor.organisationId;
    }
    return this.list(query, organisationId ? { distributorOrganisationId: organisationId } : {});
  }

  async getDispute(disputeId: string, actor: CurrentUser) {
    const dispute = await this.find(disputeId);
    this.assertCanRead(dispute, actor);
    return this.present(dispute);
  }

  async assignDispute(disputeId: string, dto: AssignDisputeDto, actor: CurrentUser, requestId?: string) {
    this.require(actor, PermissionCode.DISPUTES_MANAGE);
    return this.prisma.$transaction(async (tx) => {
      const dispute = await this.find(disputeId, tx);
      this.assertActive(dispute);
      if (dispute.assignedToUserId === dto.assignedToUserId && dispute.status === DisputeStatus.UNDER_REVIEW) {
        return this.present(dispute);
      }
      const assignee = await tx.user.findFirst({
        where: {
          id: dto.assignedToUserId,
          status: UserStatus.ACTIVE,
          memberships: {
            some: {
              status: MembershipStatus.ACTIVE,
              role: { in: [PlatformRole.SUPPORT_AGENT, PlatformRole.OPERATIONS_MANAGER, PlatformRole.ADMIN] },
              organisation: { type: OrganisationType.VARDHNAM, status: OrganisationStatus.ACTIVE },
            },
          },
        },
      });
      if (!assignee) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Assignee must be an active Vardhnam support, operations or admin user',
        });
      }
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          assignedToUserId: assignee.id,
          status: DisputeStatus.UNDER_REVIEW,
          events: { create: this.event(dispute, DisputeEventType.ASSIGNED, DisputeStatus.UNDER_REVIEW, actor, dto.note ?? 'Dispute assigned', requestId) },
        },
      });
      await this.auditTransition(tx, dispute, actor, 'DISPUTE_ASSIGNED', DisputeStatus.UNDER_REVIEW, dto.note ?? 'Dispute assigned', requestId, { assignedToUserId: assignee.id });
      return this.present(await this.find(dispute.id, tx));
    });
  }

  async addNote(disputeId: string, dto: DisputeNoteDto, actor: CurrentUser, idempotencyKey?: string, requestId?: string) {
    const key = this.normalizedKey(idempotencyKey);
    return this.prisma.$transaction(async (tx) => {
      const dispute = await this.find(disputeId, tx);
      this.assertCanRead(dispute, actor);
      if (dispute.status === DisputeStatus.CLOSED) {
        throw new ConflictException({ code: ApiErrorCode.CONFLICT, message: 'A closed dispute cannot receive notes' });
      }
      const replay = await tx.disputeEvent.findUnique({
        where: { actorUserId_idempotencyKey: { actorUserId: actor.userId, idempotencyKey: key } },
      });
      if (replay) {
        if (replay.disputeId !== dispute.id || replay.note !== dto.note) {
          throw new ConflictException({ code: ApiErrorCode.CONFLICT, message: 'Idempotency-Key was already used for another dispute note' });
        }
        return this.present(dispute);
      }
      await tx.disputeEvent.create({
        data: {
          disputeId: dispute.id,
          eventType: DisputeEventType.NOTE_ADDED,
          fromStatus: dispute.status,
          toStatus: dispute.status,
          actorUserId: actor.userId,
          actorRole: actor.role,
          note: dto.note,
          requestId: requestId ?? null,
          idempotencyKey: key,
        },
      });
      await this.auditService.record({
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: dispute.distributorOrganisationId,
        action: 'DISPUTE_NOTE_ADDED',
        resourceType: 'Dispute',
        resourceId: dispute.id,
        requestId,
        reason: dto.note,
      }, tx);
      return this.present(await this.find(dispute.id, tx));
    });
  }

  async requestInformation(disputeId: string, dto: RequestDisputeInfoDto, actor: CurrentUser, requestId?: string) {
    this.require(actor, PermissionCode.DISPUTES_MANAGE);
    const nextStatus = dto.target === DisputeInfoTarget.FARMER ? DisputeStatus.AWAITING_FARMER : DisputeStatus.AWAITING_DISTRIBUTOR;
    const eventType = dto.target === DisputeInfoTarget.FARMER ? DisputeEventType.INFO_REQUESTED_FROM_FARMER : DisputeEventType.INFO_REQUESTED_FROM_DISTRIBUTOR;
    return this.prisma.$transaction(async (tx) => {
      const dispute = await this.find(disputeId, tx);
      this.assertActive(dispute);
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: nextStatus,
          events: { create: this.event(dispute, eventType, nextStatus, actor, dto.note, requestId) },
        },
      });
      await this.auditTransition(tx, dispute, actor, 'DISPUTE_INFORMATION_REQUESTED', nextStatus, dto.note, requestId);
      return this.present(await this.find(dispute.id, tx));
    });
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto, actor: CurrentUser, requestId?: string) {
    this.require(actor, PermissionCode.DISPUTES_RESOLVE);
    return this.prisma.$transaction(async (tx) => {
      const dispute = await this.find(disputeId, tx);
      this.assertActive(dispute);
      if (dto.outcome === DisputeResolutionOutcome.DISTRIBUTOR && dto.resolutionAmountPaise !== 0) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'A distributor resolution cannot award money to the farmer',
        });
      }
      if (dto.resolutionAmountPaise > dispute.productOrder.farmerPayablePaise) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'A dispute adjustment cannot exceed the farmer payable for the child order',
        });
      }
      const nextStatus = this.resolvedStatus(dto.outcome);
      const resolvedAt = new Date();
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: nextStatus,
          resolutionOutcome: dto.outcome,
          resolutionNote: dto.resolutionNote,
          resolutionAmountPaise: dto.resolutionAmountPaise,
          resolvedAt,
          events: { create: this.event(dispute, DisputeEventType.RESOLVED, nextStatus, actor, dto.resolutionNote, requestId) },
        },
      });
      await tx.productOrder.update({
        where: { id: dispute.productOrderId },
        data: {
          status: dispute.orderStatusBeforeDispute,
          statusHistory: {
            create: {
              fromStatus: ProductOrderStatus.DISPUTED,
              toStatus: dispute.orderStatusBeforeDispute,
              actorUserId: actor.userId,
              actorRole: actor.role,
              reason: `Dispute resolved: ${dto.outcome}`,
              requestId: requestId ?? null,
            },
          },
        },
      });
      if (dto.resolutionAmountPaise > 0) {
        await tx.financialLedgerEntry.create({
          data: {
            entryType: FinancialLedgerEntryType.ADJUSTMENT,
            amountPaise: -dto.resolutionAmountPaise,
            organisationId: dispute.distributorOrganisationId,
            productOrderId: dispute.productOrderId,
            disputeId: dispute.id,
            requestId: requestId ?? null,
            reason: 'Farmer award from product-order dispute resolution',
          },
        });
      }
      await this.auditTransition(tx, dispute, actor, 'DISPUTE_RESOLVED', nextStatus, dto.resolutionNote, requestId, {
        outcome: dto.outcome,
        resolutionAmountPaise: dto.resolutionAmountPaise,
        restoredProductOrderStatus: dispute.orderStatusBeforeDispute,
      });
      await this.notificationEventsService.emitDisputeEvent(tx, {
        event: FarmerDisputeNotificationEvent.DISPUTE_RESOLVED,
        recipientUserId: dispute.farmerUserId,
        disputeId: dispute.id,
        productOrderId: dispute.productOrderId,
        orderNumber: dispute.productOrder.orderNumber,
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId,
        resolutionAmountPaise: dto.resolutionAmountPaise,
      });
      return this.present(await this.find(dispute.id, tx));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async closeDispute(disputeId: string, dto: DisputeNoteDto, actor: CurrentUser, requestId?: string) {
    this.require(actor, PermissionCode.DISPUTES_RESOLVE);
    return this.prisma.$transaction(async (tx) => {
      const dispute = await this.find(disputeId, tx);
      if (dispute.status === DisputeStatus.CLOSED) {
        return this.present(dispute);
      }
      if (!RESOLVED_STATUSES.has(dispute.status)) {
        throw new ConflictException({
          code: ApiErrorCode.CONFLICT,
          message: 'Only a resolved dispute can be closed',
        });
      }
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.CLOSED,
          closedAt: new Date(),
          events: { create: this.event(dispute, DisputeEventType.CLOSED, DisputeStatus.CLOSED, actor, dto.note, requestId) },
        },
      });
      await this.auditTransition(tx, dispute, actor, 'DISPUTE_CLOSED', DisputeStatus.CLOSED, dto.note, requestId);
      return this.present(await this.find(dispute.id, tx));
    });
  }

  private async list(query: ListDisputesQueryDto, scope: Prisma.DisputeWhereInput) {
    const { page, limit, skip } = paginationOffset(query);
    const q = query.q?.trim();
    const where: Prisma.DisputeWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
      ...(q ? { OR: [
        { productOrder: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { description: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({ where, include: disputeInclude, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items: items.map((item) => this.present(item)), page, limit, total };
  }

  private async find(disputeId: string, client: PrismaService | Prisma.TransactionClient = this.prisma): Promise<DisputeWithDetails> {
    const dispute = await client.dispute.findUnique({ where: { id: disputeId }, include: disputeInclude });
    if (!dispute) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Dispute was not found' });
    }
    return dispute;
  }

  private assertCanRaise(farmerUserId: string, sellerOrganisationId: string, actor: CurrentUser) {
    if (actor.role === PlatformRole.FARMER && this.has(actor, PermissionCode.DISPUTES_CREATE_OWN) && actor.userId === farmerUserId) {
      return;
    }
    if (this.has(actor, PermissionCode.DISPUTES_CREATE_SELLER_OWN) && actor.organisationId === sellerOrganisationId) {
      return;
    }
    throw this.forbidden('Only the owning farmer or seller organisation may raise this dispute');
  }

  private assertCanRead(dispute: DisputeWithDetails, actor: CurrentUser) {
    if (this.has(actor, PermissionCode.DISPUTES_READ_ANY)) return;
    if (this.has(actor, PermissionCode.DISPUTES_READ_OWN) && dispute.farmerUserId === actor.userId) return;
    if (this.has(actor, PermissionCode.DISPUTES_READ_SELLER_OWN) && dispute.distributorOrganisationId === actor.organisationId) return;
    throw this.forbidden('You do not have access to this dispute');
  }

  private assertActive(dispute: DisputeWithDetails) {
    if (RESOLVED_STATUSES.has(dispute.status) || dispute.status === DisputeStatus.CLOSED) {
      throw new ConflictException({ code: ApiErrorCode.CONFLICT, message: 'The dispute is already resolved' });
    }
  }

  private event(dispute: DisputeWithDetails, eventType: DisputeEventType, toStatus: DisputeStatus, actor: CurrentUser, note: string, requestId?: string) {
    return {
      eventType,
      fromStatus: dispute.status,
      toStatus,
      actorUserId: actor.userId,
      actorRole: actor.role,
      note,
      requestId: requestId ?? null,
    };
  }

  private async auditTransition(tx: Prisma.TransactionClient, dispute: DisputeWithDetails, actor: CurrentUser, action: string, toStatus: DisputeStatus, reason: string, requestId?: string, extra: Record<string, unknown> = {}) {
    await this.auditService.record({
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: dispute.distributorOrganisationId,
      action,
      resourceType: 'Dispute',
      resourceId: dispute.id,
      previousValue: { status: dispute.status },
      newValue: { status: toStatus, ...extra },
      requestId,
      reason,
    }, tx);
  }

  private resolvedStatus(outcome: DisputeResolutionOutcome): DisputeStatus {
    if (outcome === DisputeResolutionOutcome.FARMER) return DisputeStatus.RESOLVED_FOR_FARMER;
    if (outcome === DisputeResolutionOutcome.DISTRIBUTOR) return DisputeStatus.RESOLVED_FOR_DISTRIBUTOR;
    return DisputeStatus.RESOLVED_SPLIT;
  }

  private present(dispute: DisputeWithDetails) {
    return {
      id: dispute.id,
      productOrderId: dispute.productOrderId,
      orderNumber: dispute.productOrder.orderNumber,
      sellerName: dispute.productOrder.sellerNameSnapshot,
      returnRequestId: dispute.returnRequestId,
      returnStatus: dispute.returnRequest?.status ?? null,
      farmerUserId: dispute.farmerUserId,
      distributorOrganisationId: dispute.distributorOrganisationId,
      raisedByUserId: dispute.raisedByUserId,
      raisedByRole: dispute.raisedByRole,
      againstOrganisationId: dispute.againstOrganisationId,
      status: dispute.status,
      category: dispute.category,
      description: dispute.description,
      orderStatusBeforeDispute: dispute.orderStatusBeforeDispute,
      assignedToUserId: dispute.assignedToUserId,
      resolutionOutcome: dispute.resolutionOutcome,
      resolutionNote: dispute.resolutionNote,
      resolutionAmountPaise: dispute.resolutionAmountPaise,
      resolvedAt: dispute.resolvedAt,
      closedAt: dispute.closedAt,
      events: dispute.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        note: event.note,
        requestId: event.requestId,
        createdAt: event.createdAt,
      })),
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
    };
  }

  private has(actor: CurrentUser, permission: PermissionCode) {
    return this.accessService.hasPermission(actor, permission);
  }

  private require(actor: CurrentUser, permission: PermissionCode) {
    if (!this.has(actor, permission)) throw this.forbidden(`${permission} permission is required`);
  }

  private forbidden(message: string) {
    return new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message });
  }

  private normalizedKey(value?: string) {
    const key = value?.trim();
    if (!key || key.length > 120) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Idempotency-Key header is required and must be 120 characters or fewer',
      });
    }
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
