import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { MaintenanceJob, QueueName } from '../jobs/queue-names';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';

/**
 * Picks up notifications that are waiting to go out and queues them for delivery.
 *
 * Domain events create their notification rows **inside** the transaction that
 * makes the change they describe — that is what guarantees a rolled-back order
 * never notifies anyone. But a job may not be enqueued from inside that
 * transaction: the worker could read the row before it is committed, or send a
 * message for an order that then rolled back.
 *
 * The alternative is an explicit post-commit enqueue at every producer. There
 * are over thirty of them, several inside the largest service in the codebase,
 * and one forgotten call is a notification that silently never sends. Sweeping
 * for PENDING rows instead makes the row itself the queue: correct after a
 * commit, after a crash, and after a restart, with no producer able to forget.
 *
 * The cost is latency of up to one sweep interval. For the events that carry
 * SMS — payment taken, out for delivery, delivered, refunded — that is
 * acceptable. Anything genuinely time-critical bypasses this entirely: OTPs are
 * sent synchronously and never become `Notification` rows at all.
 */
const BATCH_SIZE = 200;

/**
 * Rows younger than this are skipped so a sweep cannot race a transaction that
 * is still open, which would send for a change that then rolled back.
 */
const MIN_AGE_SECONDS = 5;

@Injectable()
export class DispatchPendingNotificationsHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.DISPATCH_PENDING_NOTIFICATIONS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  async handle(_envelope: unknown, context: JobContext): Promise<JobResult> {
    const createdBefore = new Date(Date.now() - MIN_AGE_SECONDS * 1_000);

    const pending = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.PENDING,
        channel: { not: NotificationChannel.IN_APP },
        createdAt: { lt: createdBefore },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const notification of pending) {
      // The delivery job carries a stable job id, so a row swept twice before
      // its status changes still results in a single delivery.
      await this.delivery.enqueueDelivery(notification.id, context.requestId);
    }

    return { queuedCount: pending.length };
  }
}
