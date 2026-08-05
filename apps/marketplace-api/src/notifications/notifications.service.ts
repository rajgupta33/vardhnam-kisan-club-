import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationStatus, Prisma, type Notification } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmNotificationAttemptDto, NotificationOutcome } from './dto/confirm-notification-attempt.dto';
import type { CreateNotificationDto } from './dto/create-notification.dto';
import type { ListMyNotificationsQueryDto } from './dto/list-my-notifications-query.dto';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async enqueueNotification(dto: CreateNotificationDto, actor: CurrentUser, requestId?: string) {
    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientUserId } });
    if (!recipient) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'recipientUserId was not found',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          recipientUserId: dto.recipientUserId,
          channel: dto.channel,
          category: dto.category,
          title: dto.title,
          body: dto.body,
          payloadSnapshot: dto.payload ? (dto.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
          relatedResourceType: dto.relatedResourceType ?? null,
          relatedResourceId: dto.relatedResourceId ?? null,
          triggeredByUserId: actor.userId,
          triggeredByRole: actor.role,
          reason: dto.reason ?? null,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'NOTIFICATION_ENQUEUED',
          resourceType: 'Notification',
          resourceId: notification.id,
          newValue: this.notificationAuditValue(notification),
          requestId,
          reason: dto.reason ?? 'Notification enqueued',
        }),
        tx,
      );

      return notification;
    });
  }

  async attemptDelivery(
    id: string,
    dto: ConfirmNotificationAttemptDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const notification = await this.findNotificationOrThrow(id);
    if (notification.status !== NotificationStatus.PENDING && notification.status !== NotificationStatus.FAILED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Notification cannot be attempted from status ${notification.status}`,
      });
    }

    const isSuccess = dto.outcome === NotificationOutcome.SENT;
    const attemptNumber = notification.attemptCount + 1;
    const errorCode = isSuccess ? null : dto.errorCode ?? 'MOCK_NOTIFICATION_SEND_FAILED';
    const errorMessage = isSuccess
      ? null
      : dto.errorMessage ?? 'Mock notification delivery failed for local testing';
    const providerReferenceId = isSuccess
      ? dto.providerReferenceId ?? `MOCK-${notification.channel}-${notification.id.slice(0, 8).toUpperCase()}`
      : notification.providerReferenceId;

    return this.prisma.$transaction(async (tx) => {
      await tx.notificationAttempt.create({
        data: {
          notificationId: notification.id,
          attemptNumber,
          outcome: isSuccess ? NotificationStatus.SENT : NotificationStatus.FAILED,
          errorCode,
          errorMessage,
          performedByUserId: actor.userId,
          performedByRole: actor.role,
        },
      });

      const updated = await tx.notification.update({
        where: { id: notification.id },
        data: {
          status: isSuccess ? NotificationStatus.SENT : NotificationStatus.FAILED,
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
          lastErrorCode: errorCode,
          lastErrorMessage: errorMessage,
          providerReferenceId,
        },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: isSuccess ? 'NOTIFICATION_SENT' : 'NOTIFICATION_SEND_FAILED',
          resourceType: 'Notification',
          resourceId: updated.id,
          previousValue: this.notificationAuditValue(notification),
          newValue: this.notificationAuditValue(updated),
          requestId,
          reason: dto.reason ?? (isSuccess ? 'Notification sent' : 'Notification send failed'),
        }),
        tx,
      );

      return updated;
    });
  }

  async markRead(id: string, actor: CurrentUser, requestId?: string) {
    const notification = await this.findNotificationOrThrow(id);
    this.ensureCanActOnNotification(notification, actor);

    if (notification.readAt) {
      return notification;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() },
      });

      await this.auditService.record(
        this.withActor(actor, {
          action: 'NOTIFICATION_READ',
          resourceType: 'Notification',
          resourceId: updated.id,
          newValue: this.notificationAuditValue(updated),
          requestId,
          reason: 'Notification marked read',
        }),
        tx,
      );

      return updated;
    });
  }

  async listNotifications(query: ListNotificationsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.NotificationWhereInput = {
      ...(query.recipientUserId ? { recipientUserId: query.recipientUserId } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async listMyNotifications(actor: CurrentUser, query: ListMyNotificationsQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: actor.userId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getNotificationById(id: string, actor: CurrentUser) {
    const notification = await this.findNotificationOrThrow(id);
    this.ensureCanActOnNotification(notification, actor);
    return notification;
  }

  private ensureCanActOnNotification(notification: Notification, actor: CurrentUser): void {
    if (
      this.accessService.hasPermission(actor, PermissionCode.NOTIFICATIONS_READ_ANY) ||
      this.accessService.hasPermission(actor, PermissionCode.NOTIFICATIONS_MANAGE)
    ) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.NOTIFICATIONS_READ_OWN) &&
      notification.recipientUserId === actor.userId
    ) {
      return;
    }

    throw this.forbidden('Notification permission is required');
  }

  private async findNotificationOrThrow(id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Notification was not found',
      });
    }
    return notification;
  }

  private notificationAuditValue(notification: Notification): Prisma.InputJsonObject {
    return {
      channel: notification.channel,
      category: notification.category,
      status: notification.status,
      attemptCount: notification.attemptCount,
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
