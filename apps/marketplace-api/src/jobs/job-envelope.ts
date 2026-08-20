/**
 * Every job payload is wrapped so the originating request can be traced through
 * the queue. `AGENTS.md` requires correlation IDs to survive across process
 * boundaries -- without this, a job failure cannot be tied back to the HTTP
 * request that caused it.
 */
export interface JobEnvelope<TPayload = unknown> {
  payload: TPayload;
  /** Correlation ID of the request that enqueued this job, when there was one. */
  requestId?: string;
  enqueuedAt: string;
}

export function createJobEnvelope<TPayload>(
  payload: TPayload,
  requestId?: string,
): JobEnvelope<TPayload> {
  return {
    payload,
    ...(requestId ? { requestId } : {}),
    enqueuedAt: new Date().toISOString(),
  };
}

/** What a dead-lettered job retains so it can be diagnosed and replayed. */
export interface DeadLetterRecord {
  originalQueue: string;
  originalJobName: string;
  envelope: JobEnvelope;
  failedReason: string;
  stack?: string;
  attemptsMade: number;
  failedAt: string;
}
