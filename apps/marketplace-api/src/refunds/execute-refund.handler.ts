import { Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobHandler, JobResult } from '../jobs/job-handler';
import { PaymentWebhookJob, QueueName } from '../jobs/queue-names';
import { RefundsService } from './refunds.service';

export interface ExecuteRefundPayload {
  refundEventId: string;
}

@Injectable()
export class ExecuteRefundHandler implements JobHandler<ExecuteRefundPayload> {
  readonly queue = QueueName.PAYMENT_WEBHOOKS;
  readonly jobName = PaymentWebhookJob.EXECUTE_REFUND;

  constructor(private readonly refundsService: RefundsService) {}

  handle(envelope: JobEnvelope<ExecuteRefundPayload>): Promise<JobResult> {
    return this.refundsService.executeQueuedMock(envelope.payload.refundEventId);
  }
}
