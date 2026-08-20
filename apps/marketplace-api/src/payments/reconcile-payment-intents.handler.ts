import { Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { MaintenanceJob, QueueName } from '../jobs/queue-names';
import { PaymentReconciliationService } from './payment-reconciliation.service';

/**
 * Asks the gateway about payments that have been open too long.
 *
 * Idempotent by construction: it reads state, records what it found, and
 * changes no payment. Running it twice produces a second set of identical
 * observations, which is noise but never damage.
 */
@Injectable()
export class ReconcilePaymentIntentsHandler implements JobHandler {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.RECONCILE_PAYMENT_INTENTS;

  constructor(private readonly reconciliationService: PaymentReconciliationService) {}

  async handle(_envelope: JobEnvelope, context: JobContext): Promise<JobResult> {
    const result = await this.reconciliationService.sweepStaleIntents(context.requestId);
    return { ...result };
  }
}
