import type { JobEnvelope } from './job-envelope';
import type { QueueName } from './queue-names';

export interface JobContext {
  jobId: string;
  jobName: string;
  queue: QueueName;
  attempt: number;
  /** Correlation ID of the enqueueing request, propagated for log tracing. */
  requestId?: string;
}

/**
 * A unit of background work. Handlers must be idempotent: BullMQ retries on
 * failure, and a repeatable job can fire twice around a restart, so running the
 * same handler twice must do no additional damage.
 */
export interface JobHandler<TPayload = unknown> {
  readonly queue: QueueName;
  readonly jobName: string;
  handle(envelope: JobEnvelope<TPayload>, context: JobContext): Promise<JobResult>;
}

/** Returned by a handler so the outcome is visible in logs and job history. */
export interface JobResult {
  [key: string]: unknown;
}
