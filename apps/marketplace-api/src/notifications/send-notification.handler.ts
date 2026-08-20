import { Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { NotificationJob, QueueName } from '../jobs/queue-names';
import { NotificationDeliveryService } from './notification-delivery.service';

interface SendNotificationPayload {
  notificationId: string;
}

/**
 * Delivers one notification through its channel provider.
 *
 * Retryable provider failures propagate so BullMQ retries with backoff and
 * eventually dead-letters for an operator. Permanent failures -- no destination,
 * suppressed by preference, already sent -- are recorded and return normally,
 * because retrying them would only delay the dead-letter of things that are
 * genuinely stuck.
 */
@Injectable()
export class SendNotificationHandler implements JobHandler<SendNotificationPayload> {
  readonly queue = QueueName.NOTIFICATIONS;
  readonly jobName = NotificationJob.SEND_NOTIFICATION;

  constructor(private readonly delivery: NotificationDeliveryService) {}

  async handle(
    envelope: JobEnvelope<SendNotificationPayload>,
    context: JobContext,
  ): Promise<JobResult> {
    const outcome = await this.delivery.deliver(envelope.payload.notificationId, context.requestId);

    return {
      notificationId: outcome.notificationId,
      status: outcome.status,
      ...(outcome.skippedReason ? { skippedReason: outcome.skippedReason } : {}),
    };
  }
}
