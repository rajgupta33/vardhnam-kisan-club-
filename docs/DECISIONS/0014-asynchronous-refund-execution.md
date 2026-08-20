# ADR 0014: Asynchronous refund execution

**Status:** Accepted
**Date:** 2026-08-18

## Context

Refund confirmation previously called the payment provider during the HTTP request. Although the call was correctly outside the serializable finance transaction, request latency and availability still depended on the provider. A process or Redis failure between recording work and enqueueing it also needed a recoverable source of truth.

## Decision

The mock-only confirmation endpoint now validates authority and idempotency, moves the refund to `PROCESSING`, and appends an immutable `PROCESSING_STARTED` refund event before enqueueing `execute-refund` on the existing `payment-webhooks` queue. The event contains the validated mock outcome and original actor snapshot; the queue carries only the event ID. The HTTP response describes the committed `PROCESSING` state and never waits for provider execution.

The worker re-derives the refund amount and provider payment reference from PostgreSQL, calls the provider outside a transaction, then takes a row lock and commits the terminal refund event, ledger entries, commission reversals, order/return histories, notifications and audit in one serializable transaction. A stable job ID and the latest processing-event ID make delivery idempotent and prevent an older retry from overwriting a newer refund attempt.

A five-minute maintenance sweep re-enqueues processing events. This makes the database event a durable outbox for the narrow case where its transaction commits while Redis is unavailable. Provider exceptions remain retryable BullMQ failures and eventually enter the existing dead-letter workflow; an explicit provider rejection becomes `FAILED` and may be retried with a new idempotency key.

## Consequences

- API availability and latency no longer depend on the refund provider.
- No gateway call occurs while a database transaction or row lock is held.
- Redis loss does not lose the durable execution intent.
- The current endpoint and payload remain explicitly mock-only; a real provider still requires signed asynchronous refund-status webhooks and merchant sandbox approval.
- The API and worker must both run for refunds to progress promptly. Without a worker they remain visibly `PROCESSING` and are recoverable when the worker returns.
