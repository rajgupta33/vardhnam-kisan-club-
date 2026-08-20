import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  PlatformRole,
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
  type SupportTicket,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import {
  FarmerSupportNotificationEvent,
  NotificationEventsService,
} from '../notifications/notification-events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AddSupportTicketEvidenceDto } from './dto/add-support-ticket-evidence.dto';
import type { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import type { MarkSupportTicketWaitingDto } from './dto/mark-support-ticket-waiting.dto';
import type { ResolveSupportTicketDto } from './dto/resolve-support-ticket.dto';
import type { SupportTicketActionDto } from './dto/support-ticket-action.dto';

const SLA_PRIORITY_MULTIPLIER: Record<SupportTicketPriority, number> = {
  [SupportTicketPriority.URGENT]: 0.25,
  [SupportTicketPriority.HIGH]: 0.5,
  [SupportTicketPriority.MEDIUM]: 1,
  [SupportTicketPriority.LOW]: 2,
};

const WAITING_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.WAITING_FOR_CUSTOMER,
  SupportTicketStatus.WAITING_FOR_SELLER,
];

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly configService: ConfigService,
    private readonly notificationEventsService: NotificationEventsService,
  ) {}

  async createTicket(dto: CreateSupportTicketDto, actor: CurrentUser, requestId?: string) {
    if (dto.productOrderId) {
      await this.ensureCanReferenceOrder(dto.productOrderId, actor);
    }

    const priority = dto.priority ?? SupportTicketPriority.MEDIUM;
    const baseHours = this.configService.getOrThrow<number>('SUPPORT_TICKET_DEFAULT_SLA_HOURS');
    const slaDueAt = new Date(
      Date.now() + baseHours * SLA_PRIORITY_MULTIPLIER[priority] * 3_600_000,
    );

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          raisedByUserId: actor.userId,
          raisedByRole: actor.role,
          raiserOrganisationId: actor.organisationId ?? null,
          productOrderId: dto.productOrderId ?? null,
          category: dto.category,
          priority,
          subject: dto.subject,
          description: dto.description,
          status: SupportTicketStatus.OPEN,
          slaDueAt,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'SUPPORT_TICKET_CREATED',
          resourceType: 'SupportTicket',
          resourceId: ticket.id,
          newValue: this.ticketAuditValue(ticket),
          requestId,
          reason: 'Support ticket raised',
        }),
        tx,
      );

      if (ticket.raisedByRole === PlatformRole.FARMER) {
        await this.notificationEventsService.emitSupportEvent(tx, {
          event: FarmerSupportNotificationEvent.SUPPORT_TICKET_CREATED,
          recipientUserId: ticket.raisedByUserId,
          supportTicketId: ticket.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
        });
      }

      return ticket;
    });
  }

  async addEvidence(
    ticketId: string,
    dto: AddSupportTicketEvidenceDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureCanActOnTicket(ticket, actor);

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.supportTicketEvidence.create({
        data: {
          supportTicketId: ticket.id,
          fileName: dto.fileName,
          storageKey: dto.storageKey,
          uploadedByUserId: actor.userId,
          uploadedByRole: actor.role,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'SUPPORT_TICKET_EVIDENCE_ADDED',
          resourceType: 'SupportTicket',
          resourceId: ticket.id,
          newValue: { fileName: dto.fileName },
          requestId,
          reason: 'Evidence attached',
        }),
        tx,
      );

      return evidence;
    });
  }

  async assignTicket(
    ticketId: string,
    dto: AssignSupportTicketDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [
      SupportTicketStatus.OPEN,
      SupportTicketStatus.ESCALATED,
      SupportTicketStatus.REOPENED,
    ]);

    const assigneeMembership = await this.prisma.organisationMembership.findFirst({
      where: {
        userId: dto.assignedToUserId,
        role: PlatformRole.SUPPORT_AGENT,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!assigneeMembership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'assignedToUserId does not have an active support-agent membership',
      });
    }

    return this.transitionTicket(
      ticket,
      {
        status: SupportTicketStatus.ASSIGNED,
        assignedToUserId: dto.assignedToUserId,
        assignedAt: new Date(),
      },
      actor,
      'SUPPORT_TICKET_ASSIGNED',
      dto.reason ?? 'Ticket assigned',
      requestId,
    );
  }

  async markWaiting(
    ticketId: string,
    dto: MarkSupportTicketWaitingDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [SupportTicketStatus.ASSIGNED]);

    return this.transitionTicket(
      ticket,
      { status: dto.status },
      actor,
      'SUPPORT_TICKET_MARKED_WAITING',
      dto.reason ?? 'Awaiting a response',
      requestId,
    );
  }

  async resumeTicket(
    ticketId: string,
    dto: SupportTicketActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, WAITING_STATUSES);

    return this.transitionTicket(
      ticket,
      { status: SupportTicketStatus.ASSIGNED },
      actor,
      'SUPPORT_TICKET_RESUMED',
      dto.reason ?? 'Response received',
      requestId,
    );
  }

  async escalateTicket(
    ticketId: string,
    dto: SupportTicketActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [SupportTicketStatus.ASSIGNED, ...WAITING_STATUSES]);

    return this.transitionTicket(
      ticket,
      { status: SupportTicketStatus.ESCALATED },
      actor,
      'SUPPORT_TICKET_ESCALATED',
      dto.reason ?? 'Ticket escalated',
      requestId,
    );
  }

  async resolveTicket(
    ticketId: string,
    dto: ResolveSupportTicketDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [
      SupportTicketStatus.ASSIGNED,
      SupportTicketStatus.ESCALATED,
      ...WAITING_STATUSES,
    ]);

    return this.transitionTicket(
      ticket,
      {
        status: SupportTicketStatus.RESOLVED,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
      },
      actor,
      'SUPPORT_TICKET_RESOLVED',
      dto.resolutionNote,
      requestId,
    );
  }

  async closeTicket(
    ticketId: string,
    dto: SupportTicketActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [SupportTicketStatus.RESOLVED]);

    return this.transitionTicket(
      ticket,
      { status: SupportTicketStatus.CLOSED, closedAt: new Date() },
      actor,
      'SUPPORT_TICKET_CLOSED',
      dto.reason ?? 'Ticket closed',
      requestId,
    );
  }

  async reopenTicket(
    ticketId: string,
    dto: SupportTicketActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureValidTransition(ticket, [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED]);

    return this.transitionTicket(
      ticket,
      {
        status: SupportTicketStatus.REOPENED,
        resolvedAt: null,
        closedAt: null,
      },
      actor,
      'SUPPORT_TICKET_REOPENED',
      dto.reason ?? 'Ticket reopened',
      requestId,
    );
  }

  async reopenOwnTicket(
    ticketId: string,
    dto: SupportTicketActionDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const ticket = await this.findTicketOrThrow(ticketId);
    if (ticket.raisedByUserId !== actor.userId) {
      throw this.forbidden('Farmers may only reopen their own support tickets');
    }
    this.ensureValidTransition(ticket, [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED]);

    return this.transitionTicket(
      ticket,
      {
        status: SupportTicketStatus.REOPENED,
        resolvedAt: null,
        closedAt: null,
      },
      actor,
      'SUPPORT_TICKET_REOPENED_BY_RAISER',
      dto.reason ?? 'Ticket reopened by its raiser',
      requestId,
    );
  }

  async listTickets(query: ListSupportTicketsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async listMyTickets(actor: CurrentUser, query: ListSupportTicketsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.SupportTicketWhereInput = {
      raisedByUserId: actor.userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getTicketById(ticketId: string, actor: CurrentUser) {
    const ticket = await this.findTicketOrThrow(ticketId);
    this.ensureCanActOnTicket(ticket, actor);
    return ticket;
  }

  private async ensureCanReferenceOrder(productOrderId: string, actor: CurrentUser): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.SUPPORT_TICKETS_MANAGE)) {
      return;
    }

    const order = await this.prisma.productOrder.findUnique({
      where: { id: productOrderId },
      include: { farmerProfile: true },
    });
    if (!order) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'productOrderId was not found',
      });
    }

    const isFarmerOwner = order.farmerProfile.userId === actor.userId;
    const isSellerOrganisation = order.sellerOrganisationId === actor.organisationId;
    if (!isFarmerOwner && !isSellerOrganisation) {
      throw this.forbidden('You do not have standing to raise a ticket for this order');
    }
  }

  private ensureCanActOnTicket(ticket: SupportTicket, actor: CurrentUser): void {
    if (
      this.accessService.hasPermission(actor, PermissionCode.SUPPORT_TICKETS_READ_ANY) ||
      this.accessService.hasPermission(actor, PermissionCode.SUPPORT_TICKETS_MANAGE)
    ) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.SUPPORT_TICKETS_READ_OWN) &&
      ticket.raisedByUserId === actor.userId
    ) {
      return;
    }

    throw this.forbidden('Support ticket permission is required');
  }

  private ensureValidTransition(ticket: SupportTicket, allowedFrom: SupportTicketStatus[]): void {
    if (!allowedFrom.includes(ticket.status)) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Support ticket cannot transition from ${ticket.status}`,
      });
    }
  }

  private async findTicketOrThrow(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Support ticket was not found',
      });
    }
    return ticket;
  }

  private async transitionTicket(
    ticket: SupportTicket,
    data: Prisma.SupportTicketUncheckedUpdateInput,
    actor: CurrentUser,
    action: string,
    reason: string | undefined,
    requestId: string | undefined,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: ticket.id },
        data,
      });

      await this.auditService.record(
        this.withActor(actor, {
          action,
          resourceType: 'SupportTicket',
          resourceId: updated.id,
          previousValue: this.ticketAuditValue(ticket),
          newValue: this.ticketAuditValue(updated),
          requestId,
          reason,
        }),
        tx,
      );

      if (ticket.raisedByRole === PlatformRole.FARMER) {
        await this.notificationEventsService.emitSupportEvent(tx, {
          event: this.supportNotificationEvent(action, updated.status),
          recipientUserId: ticket.raisedByUserId,
          supportTicketId: ticket.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          requestId,
        });
      }

      return updated;
    });
  }

  private supportNotificationEvent(
    action: string,
    status: SupportTicketStatus,
  ): FarmerSupportNotificationEvent {
    if (action === 'SUPPORT_TICKET_ASSIGNED') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_ASSIGNED;
    }
    if (action === 'SUPPORT_TICKET_MARKED_WAITING') {
      return status === SupportTicketStatus.WAITING_FOR_CUSTOMER
        ? FarmerSupportNotificationEvent.SUPPORT_TICKET_WAITING_FOR_CUSTOMER
        : FarmerSupportNotificationEvent.SUPPORT_TICKET_WAITING_FOR_SELLER;
    }
    if (action === 'SUPPORT_TICKET_RESUMED') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_RESUMED;
    }
    if (action === 'SUPPORT_TICKET_ESCALATED') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_ESCALATED;
    }
    if (action === 'SUPPORT_TICKET_RESOLVED') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_RESOLVED;
    }
    if (action === 'SUPPORT_TICKET_CLOSED') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_CLOSED;
    }
    if (action === 'SUPPORT_TICKET_REOPENED' || action === 'SUPPORT_TICKET_REOPENED_BY_RAISER') {
      return FarmerSupportNotificationEvent.SUPPORT_TICKET_REOPENED;
    }
    throw new Error(`No farmer notification event is defined for support action ${action}`);
  }

  private ticketAuditValue(ticket: SupportTicket): Prisma.InputJsonObject {
    return {
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedToUserId: ticket.assignedToUserId,
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

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }
}
