import { Injectable } from '@nestjs/common';
import { systemActor } from '../common/audit-actor';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { MaintenanceJob, QueueName } from '../jobs/queue-names';
import { AdvisoryService } from './advisory.service';

/**
 * Publishes Kisan Club advisories that have come due.
 *
 * ADR 0009 recorded the manual `POST /advisory/generate` endpoint as "an
 * explicitly temporary scheduler boundary until the queue/worker package is
 * implemented". WP-04 built that, so this closes the gap: a farmer's crop
 * reaching a rule's day window now produces an advisory on its own, rather than
 * waiting for someone in operations to remember to press a button.
 *
 * The manual endpoint stays, both for a deliberate off-cycle run and because it
 * is how the portal proves a newly approved rule behaves as expected.
 *
 * Idempotent: advisory event uniqueness includes crop cycle, rule and version,
 * so running twice on the same day publishes nothing the second time. The
 * generator is also date-bounded, so a missed day is not silently back-filled --
 * a farmer should not receive last week's irrigation reminder today.
 */
@Injectable()
export class GenerateAdvisoriesHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.GENERATE_ADVISORIES;

  constructor(private readonly advisoryService: AdvisoryService) {}

  async handle(_envelope: unknown, context: JobContext): Promise<JobResult> {
    const result = await this.advisoryService.generate(
      systemActor(`job:${this.jobName}`),
      context.requestId,
    );

    return {
      generated: result.generated,
      evaluatedCropCycles: result.evaluatedCropCycles,
      approvedRules: result.approvedRules,
    };
  }
}
