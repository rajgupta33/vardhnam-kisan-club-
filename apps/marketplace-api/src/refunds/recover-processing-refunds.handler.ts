import { Injectable } from '@nestjs/common';
import { RefundEventType, RefundStatus } from '@prisma/client';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { MaintenanceJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { refundExecutionJobId } from './refunds.service';

@Injectable()
export class RecoverProcessingRefundsHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.RECOVER_PROCESSING_REFUNDS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async handle(
    _envelope: JobEnvelope<Record<string, never>>,
    context: JobContext,
  ): Promise<JobResult> {
    const refunds = await this.prisma.refund.findMany({
      where: { status: RefundStatus.PROCESSING },
      select: {
        events: {
          where: { eventType: RefundEventType.PROCESSING_STARTED },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, requestId: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });

    let enqueued = 0;
    for (const refund of refunds) {
      const event = refund.events[0];
      if (!event) continue;
      await this.queueService.enqueue(
        QueueName.PAYMENT_WEBHOOKS,
        'execute-refund',
        { refundEventId: event.id },
        {
          ...(event.requestId ?? context.requestId
            ? { requestId: event.requestId ?? context.requestId }
            : {}),
          jobId: refundExecutionJobId(event.id),
        },
      );
      enqueued += 1;
    }

    return { scanned: refunds.length, enqueued };
  }
}
