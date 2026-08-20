import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { systemActor, withAuditActor } from '../common/audit-actor';
import { NotificationJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { isOptOutable } from './notification-categories';
import { renderForChannel } from './notification-templates';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';
import { PermanentDeliveryError } from './providers/notification-provider.interface';

export interface DeliveryOutcome {
  notificationId: string;
  status: NotificationStatus;
  skippedReason?: string;
  providerReferenceId?: string;
}

/**
 * Sends notifications out through their channel's provider.
 *
 * Delivery is a queue job, never part of the request that produced the event:
 * an SMS gateway being slow must not slow down accepting an order, and a
 * provider outage must not roll back a delivered order. Retry, backoff and
 * dead-lettering are inherited from WP-04.
 */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
    private readonly providers: NotificationProviderRegistry,
  ) {}

  /**
   * Queues a notification for delivery.
   *
   * **Call this after the producing transaction has committed.** Enqueueing
   * inside the transaction would let a rolled-back order still notify the
   * farmer, and the worker could read the row before it exists.
   */
  async enqueueDelivery(notificationId: string, requestId?: string): Promise<void> {
    await this.queueService.enqueue(
      QueueName.NOTIFICATIONS,
      NotificationJob.SEND_NOTIFICATION,
      { notificationId },
      {
        ...(requestId ? { requestId } : {}),
        // Stable id so a retried producer enqueues one delivery, not two.
        jobId: `send-${notificationId}`,
      },
    );
  }

  /**
   * Performs one delivery attempt. Called by the queue handler.
   *
   * Throws on a retryable failure so BullMQ retries; returns normally for
   * permanent failures and for messages that should not be sent at all.
   */
  async deliver(notificationId: string, requestId?: string): Promise<DeliveryOutcome> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        recipient: {
          select: {
            id: true,
            phone: true,
            email: true,
            farmerProfile: { select: { preferredLocale: true } },
          },
        },
      },
    });

    if (!notification) {
      // The notification was deleted between enqueue and delivery. Nothing to
      // retry -- fail quietly rather than burning the attempt budget.
      return { notificationId, status: NotificationStatus.FAILED, skippedReason: 'NOT_FOUND' };
    }

    if (notification.status === NotificationStatus.SENT) {
      // Already delivered; a replayed job must not send twice.
      return { notificationId, status: NotificationStatus.SENT, skippedReason: 'ALREADY_SENT' };
    }

    // In-app notifications are delivered by existing as a row the recipient can
    // read. There is nothing to transmit.
    if (notification.channel === NotificationChannel.IN_APP) {
      return this.markSent(notification.id, notification.status, undefined, requestId);
    }

    const suppressed = await this.isSuppressedByPreference(
      notification.recipientUserId,
      notification.category,
      notification.channel,
    );
    if (suppressed) {
      return this.markSuppressed(notification.id, notification.status, requestId);
    }

    const destination = this.destinationFor(notification.channel, notification.recipient);
    if (!destination) {
      return this.markFailed(
        notification.id,
        notification.status,
        'NO_DESTINATION',
        `Recipient has no ${notification.channel} destination on file`,
        requestId,
      );
    }

    const provider = this.providers.forChannel(notification.channel);
    if (!provider) {
      return this.markFailed(
        notification.id,
        notification.status,
        'NO_PROVIDER',
        `No provider is configured for ${notification.channel}`,
        requestId,
      );
    }

    const locale = notification.recipient.farmerProfile?.preferredLocale ?? 'en-IN';
    const rendered = renderForChannel(notification.channel, notification.title, notification.body);

    try {
      const result = await provider.send({
        notificationId: notification.id,
        destination,
        title: rendered.title,
        body: rendered.body,
        category: notification.category,
        locale,
      });
      return this.markSent(
        notification.id,
        notification.status,
        result.providerReferenceId,
        requestId,
      );
    } catch (error) {
      const permanent = error instanceof PermanentDeliveryError;
      const errorCode = permanent ? error.errorCode : 'PROVIDER_SEND_FAILED';
      const errorMessage = error instanceof Error ? error.message : 'Unknown provider error';

      await this.markFailed(
        notification.id,
        notification.status,
        errorCode,
        errorMessage,
        requestId,
      );

      if (permanent) {
        // Retrying will not change the outcome, so stop here rather than
        // spending the remaining attempts and dead-lettering something that was
        // never going to succeed.
        return { notificationId, status: NotificationStatus.FAILED, skippedReason: errorCode };
      }

      throw error;
    }
  }

  private async isSuppressedByPreference(
    userId: string,
    category: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    // Transactional categories are never suppressed, whatever a stale preference
    // row says -- the class of a category can change as the domain grows, and a
    // preference saved while it was optional must not silence it afterwards.
    if (!isOptOutable(category)) {
      return false;
    }

    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId_category_channel: { userId, category, channel } },
    });

    return preference ? !preference.enabled : false;
  }

  private destinationFor(
    channel: NotificationChannel,
    recipient: { phone: string | null; email: string | null },
  ): string | undefined {
    switch (channel) {
      case NotificationChannel.SMS:
      case NotificationChannel.WHATSAPP:
        return recipient.phone ?? undefined;
      case NotificationChannel.EMAIL:
        return recipient.email ?? undefined;
      case NotificationChannel.PUSH:
        // Device-token registration is not built yet, so push has no
        // destination and is recorded as failed rather than silently dropped.
        return undefined;
      default:
        return undefined;
    }
  }

  private async markSent(
    notificationId: string,
    previousStatus: NotificationStatus,
    providerReferenceId: string | undefined,
    requestId?: string,
  ): Promise<DeliveryOutcome> {
    await this.recordAttempt(notificationId, previousStatus, {
      outcome: NotificationStatus.SENT,
      ...(providerReferenceId ? { providerReferenceId } : {}),
      requestId,
    });
    return {
      notificationId,
      status: NotificationStatus.SENT,
      ...(providerReferenceId ? { providerReferenceId } : {}),
    };
  }

  private async markFailed(
    notificationId: string,
    previousStatus: NotificationStatus,
    errorCode: string,
    errorMessage: string,
    requestId?: string,
  ): Promise<DeliveryOutcome> {
    await this.recordAttempt(notificationId, previousStatus, {
      outcome: NotificationStatus.FAILED,
      errorCode,
      errorMessage,
      requestId,
    });
    return { notificationId, status: NotificationStatus.FAILED, skippedReason: errorCode };
  }

  private async markSuppressed(
    notificationId: string,
    previousStatus: NotificationStatus,
    requestId?: string,
  ): Promise<DeliveryOutcome> {
    // Recorded as a failed attempt with an explicit code rather than as sent:
    // claiming delivery for a message deliberately not sent would make the
    // notification log untrustworthy.
    await this.recordAttempt(notificationId, previousStatus, {
      outcome: NotificationStatus.FAILED,
      errorCode: 'SUPPRESSED_BY_PREFERENCE',
      errorMessage: 'Recipient has disabled this category on this channel',
      requestId,
    });
    return {
      notificationId,
      status: NotificationStatus.FAILED,
      skippedReason: 'SUPPRESSED_BY_PREFERENCE',
    };
  }

  private async recordAttempt(
    notificationId: string,
    previousStatus: NotificationStatus,
    input: {
      outcome: NotificationStatus;
      providerReferenceId?: string | undefined;
      errorCode?: string | undefined;
      errorMessage?: string | undefined;
      requestId?: string | undefined;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.notification.findUniqueOrThrow({
        where: { id: notificationId },
        select: { attemptCount: true, providerReferenceId: true, channel: true, category: true },
      });
      const attemptNumber = current.attemptCount + 1;

      await tx.notificationAttempt.create({
        data: {
          notificationId,
          attemptNumber,
          outcome: input.outcome,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          // No performedByUserId: this attempt was made by the worker, not a
          // person. See common/audit-actor.ts.
        },
      });

      await tx.notification.update({
        where: { id: notificationId },
        data: {
          status: input.outcome,
          attemptCount: attemptNumber,
          lastAttemptAt: new Date(),
          lastErrorCode: input.errorCode ?? null,
          lastErrorMessage: input.errorMessage ?? null,
          providerReferenceId: input.providerReferenceId ?? current.providerReferenceId,
        },
      });

      await this.auditService.record(
        withAuditActor(systemActor(`job:${NotificationJob.SEND_NOTIFICATION}`), {
          action:
            input.outcome === NotificationStatus.SENT
              ? 'NOTIFICATION_SENT'
              : 'NOTIFICATION_SEND_FAILED',
          resourceType: 'Notification',
          resourceId: notificationId,
          previousValue: { status: previousStatus } as Prisma.InputJsonObject,
          newValue: {
            status: input.outcome,
            channel: current.channel,
            category: current.category,
            attemptNumber,
            ...(input.errorCode ? { errorCode: input.errorCode } : {}),
          } as Prisma.InputJsonObject,
          ...(input.requestId ? { requestId: input.requestId } : {}),
        }),
        tx,
      );
    });

    this.logger.log(
      JSON.stringify({
        message: 'Notification delivery attempt recorded',
        notificationId,
        outcome: input.outcome,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      }),
    );
  }
}
