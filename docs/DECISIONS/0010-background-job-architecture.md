# ADR 0010: Background Job Architecture

**Status:** Accepted

**Date:** 2026-08-17

## Decision

Background work runs on BullMQ queues consumed by a **separate worker process**. The API enqueues and never consumes.

- `WORKER_MODE` gates both worker startup and repeatable-job registration. It is forced on by the dedicated `src/worker.ts` entrypoint (`npm run start:worker`) and is false everywhere else, so an API process cannot silently become a consumer and a horizontally scaled API tier cannot register duplicate schedulers.
- BullMQ is used **directly**, not through `@nestjs/bullmq`. The wrapper adds a decorator layer and a version coupling for behaviour this codebase needs very little of; `QueueService` and `JobRunnerService` are together smaller than the configuration the wrapper would require.
- Queues get their **own Redis connection**, separate from `RedisService`. BullMQ requires `maxRetriesPerRequest: null`, while the health-check client is deliberately configured to fail fast. `/health/ready` reports `queues` as a check distinct from `redis` for the same reason.
- Every payload is wrapped in a `JobEnvelope` carrying the enqueueing request's correlation ID, so a job failure can be traced back to the HTTP request that caused it.
- **Dead-letter queues are ordinary queues** named `<queue>-dead-letter`, so they get the same inspection tooling for free. A job that exhausts its attempts is copied there with its payload, failure reason, stack and attempt count. Dead-lettered jobs never retry on their own — they wait for an audited operator decision through `POST /admin/jobs/dead-letter/:jobId/retry`.
- Queue names use a hyphen separator rather than a colon: BullMQ builds Redis keys as `prefix:queue:...` and rejects a colon in a queue name.
- `QUEUE_PREFIX` namespaces all keys so environments sharing a Redis instance cannot consume each other's jobs.

### System actors

Scheduled jobs change state with no human behind them. Rather than inventing a synthetic "system user" row to satisfy the `AuditLog.actorUserId` foreign key, a `SystemActor` records the change with **actor identity left null** and the triggering job named in `reason` (`job:expire-batches`). `AuditLog.actorUserId` and `actorRole` are already nullable, so this is representable without schema change.

A synthetic user would be a worse lie: it could hold memberships, be assigned work, and appear in operator-facing lists as though a person had acted.

## Consequences

- Jobs accumulate harmlessly in Redis when no worker runs; the API is unaffected.
- API and worker scale independently, as `PRODUCT_REQUIREMENTS.md` §24 requires.
- WP-06 (notifications), WP-07 (payment webhooks) and WP-08 (virus scanning, PDF rendering) plug in by registering a `JobHandler` — no queue infrastructure work remains for them. Their queues are already declared and visible in `/admin/jobs/queues`, empty until their producers exist.
- Commission finalisation, batch expiry, OTP cleanup and refresh-token pruning now happen on schedule instead of waiting for someone to call an endpoint.
- Every handler must be **idempotent**. BullMQ retries on failure and a repeatable job can fire twice around a restart. Each shipped handler achieves this by selecting only rows still in the pre-transition state.
- Audit rows written by scheduled jobs have no actor user. Any operator-facing audit view must render that as "system", not as a blank or an error.

## Deferred

- **`support-sla-breach-sweep`** was specified in the original WP-04 plan but is not implemented. `SupportTicket` has `slaDueAt` but no breach flag, so "flagging" a breach would need a schema change, and the notification it is supposed to trigger does not exist until WP-06. It is deferred to WP-06 rather than shipped as a job that computes something and discards it.
- **`return-window-sweep`** was dropped as redundant. The return window already sets `CommissionEntry.eligibleAt`, which `finalize-eligible-commissions` consumes; a second sweep would have nothing of its own to do.
