import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createJobEnvelope } from './job-envelope';
import { MaintenanceJob, QueueName } from './queue-names';
import { QueueService } from './queue.service';

export interface ScheduledJobDefinition {
  jobName: MaintenanceJob;
  /** Standard cron expression, evaluated in `SCHEDULER_TIMEZONE`. */
  pattern: string;
  description: string;
}

/**
 * Registers the repeatable maintenance jobs.
 *
 * Scheduling runs only in worker mode, so a horizontally scaled API tier cannot
 * register duplicate schedulers. BullMQ deduplicates repeatable jobs by
 * name + pattern, so several workers registering the same definition is safe.
 *
 * Times are staggered and sit outside Indian business hours -- these sweeps
 * touch inventory and finance rows that operators read during the day.
 */
const scheduledJobs: ReadonlyArray<ScheduledJobDefinition> = [
  {
    jobName: MaintenanceJob.FINALIZE_ELIGIBLE_COMMISSIONS,
    pattern: '15 1 * * *',
    description: 'Finalise commission entries whose return window has elapsed',
  },
  {
    jobName: MaintenanceJob.EXPIRE_BATCHES,
    pattern: '30 1 * * *',
    description: 'Expire inventory batches past their expiry date',
  },
  {
    jobName: MaintenanceJob.PRUNE_REFRESH_TOKENS,
    pattern: '45 1 * * *',
    description: 'Delete expired and long-revoked refresh tokens',
  },
  {
    jobName: MaintenanceJob.EXPIRE_OTP_CHALLENGES,
    pattern: '10 * * * *',
    description: 'Delete expired and consumed OTP challenges',
  },
  {
    // Runs every minute rather than overnight: this one is not housekeeping, it
    // is the path by which SMS notifications actually leave the platform, and
    // the interval is the delay a farmer experiences.
    jobName: MaintenanceJob.DISPATCH_PENDING_NOTIFICATIONS,
    pattern: '* * * * *',
    description: 'Queue notifications awaiting outbound delivery',
  },
  {
    // Early morning, so an irrigation or spraying advisory reaches a farmer
    // before the working day rather than after it.
    jobName: MaintenanceJob.GENERATE_ADVISORIES,
    pattern: '30 5 * * *',
    description: 'Publish Kisan Club advisories whose crop stage has come due',
  },
  {
    // Every fifteen minutes, not overnight: a payment the gateway captured and
    // the platform missed is a farmer whose order is stuck, and the cost of
    // finding that out the next morning is a support call.
    jobName: MaintenanceJob.RECONCILE_PAYMENT_INTENTS,
    pattern: '*/15 * * * *',
    description: 'Compare long-open payment intents against the gateway',
  },
  {
    // Refund events are the durable outbox. This sweep repairs the narrow gap
    // where the database committed but Redis was unavailable before enqueue.
    jobName: MaintenanceJob.RECOVER_PROCESSING_REFUNDS,
    pattern: '*/5 * * * *',
    description: 'Re-enqueue durable refund executions left in processing',
  },
  {
    jobName: MaintenanceJob.RECOVER_INVOICE_PDF_JOBS,
    pattern: '*/5 * * * *',
    description: 'Re-enqueue queued or interrupted invoice PDF generation',
  },
  {
    jobName: MaintenanceJob.RECOVER_CREDIT_NOTE_PDF_JOBS,
    pattern: '*/5 * * * *',
    description: 'Re-enqueue queued or interrupted credit note PDF generation',
  },
];

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('WORKER_MODE')) {
      return;
    }

    const timezone = this.configService.get<string>('SCHEDULER_TIMEZONE') ?? 'Asia/Kolkata';
    const queue = this.queueService.getQueue(QueueName.SCHEDULED_MAINTENANCE);

    for (const definition of scheduledJobs) {
      await queue.add(definition.jobName, createJobEnvelope({}), {
        repeat: { pattern: definition.pattern, tz: timezone },
        // A stable id keeps restarts from stacking duplicate schedules.
        jobId: `repeat:${definition.jobName}`,
      });
    }

    this.logger.log(
      JSON.stringify({
        message: 'Scheduled maintenance jobs registered',
        timezone,
        jobs: scheduledJobs.map((job) => ({ name: job.jobName, pattern: job.pattern })),
      }),
    );
  }

  /** Exposed for the admin surface and tests; describes what is scheduled. */
  static definitions(): ReadonlyArray<ScheduledJobDefinition> {
    return scheduledJobs;
  }
}
