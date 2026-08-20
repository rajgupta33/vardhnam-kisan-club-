import { Injectable } from '@nestjs/common';
import { systemActor } from '../../common/audit-actor';
import { FinanceService } from '../../finance/finance.service';
import type { JobEnvelope } from '../job-envelope';
import type { JobContext, JobHandler, JobResult } from '../job-handler';
import { MaintenanceJob, QueueName } from '../queue-names';

/**
 * Finalises commission entries whose return/dispute window has elapsed.
 *
 * Until this job existed the transition only happened when an operator manually
 * called `POST /finance/commission-entries/finalize`, which meant settlements
 * silently waited on someone remembering to press a button.
 *
 * Idempotent: the underlying query selects only `PROVISIONAL` entries with
 * `eligibleAt <= now`, so a second run finds nothing left to do.
 */
@Injectable()
export class FinalizeCommissionsHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.FINALIZE_ELIGIBLE_COMMISSIONS;

  constructor(private readonly financeService: FinanceService) {}

  async handle(
    _envelope: JobEnvelope<Record<string, never>>,
    context: JobContext,
  ): Promise<JobResult> {
    const result = await this.financeService.finalizeEligibleCommissionEntries(
      systemActor(`job:${this.jobName}`),
      context.requestId,
    );

    return { finalizedCount: result.finalizedCount };
  }
}
