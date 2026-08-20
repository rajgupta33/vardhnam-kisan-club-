# ADR 0012: Notification Delivery

**Status:** Accepted

**Date:** 2026-08-18

## Decision

Notifications reach the outside world through a per-channel `NotificationProvider`, delivered by a worker on the `notifications` queue.

- **One `Notification` row per channel.** An event that goes out both in-app and by SMS creates two rows, so each transport carries its own status, attempt history and provider reference. A failed SMS must not make the in-app copy look undelivered.
- **In-app is delivered by existing.** It has no provider: the row plus `GET /notifications/me` *is* the delivery, so it is created already `SENT`. Every other channel is created `PENDING`.
- **Delivery never happens inside the producing request.** A slow SMS gateway must not slow down accepting an order, and a provider outage must not roll back one. Retry, exponential backoff and dead-lettering come from WP-04.
- **Providers do not retry internally.** `send` throws and the handler records the attempt; a provider-level retry loop would multiply attempts and defeat the dead-letter budget. A `PermanentDeliveryError` is recorded and *not* retried, so something undeliverable does not consume the whole budget before dead-lettering.
- **Mock delivery is permanently identifiable.** The mock provider stamps a `MOCK-` provider reference, so a mock-delivered notification is distinguishable in the database and the portal for ever after. An operator must never have to guess whether a "sent" notification went anywhere.
- **An unimplemented provider throws at resolution.** Falling back to the mock would mean the platform believes it sent an OTP that never left the process: the user simply never receives it, with nothing in the logs to explain why.

### Dispatch: a sweep, not a post-commit call

Domain events create their notification rows **inside** the transaction that makes the change they describe — that is what guarantees a rolled-back order never notifies anyone. But a job cannot be enqueued from inside that transaction: the worker could read the row before it commits, or send for a change that then rolls back.

The textbook fix is an explicit post-commit enqueue at every producer. There are **over thirty**, several inside `checkout.service.ts`, the largest and most correctness-critical file in the codebase — and a single forgotten call is a notification that silently never sends.

Instead, a `dispatch-pending-notifications` job runs every minute and queues any `PENDING` non-in-app row older than five seconds. **The row itself is the queue.** That is correct after a commit, after a crash and after a restart, and no producer can forget it. The five-second floor stops a sweep racing a still-open transaction.

The cost is up to a minute of latency. For the events that carry SMS that is acceptable, and anything genuinely time-critical bypasses this entirely — see OTPs below.

### OTPs do not use this pipeline

An OTP is **never** a `Notification` row. Such a row is readable through `GET /notifications/me`, so persisting the code would let anyone holding a session read a code sent to a phone they do not control — defeating the second factor entirely. The code is rendered and handed straight to the SMS provider; only its hash is stored, on `OtpChallenge`.

Delivery is synchronous, not queued: a user is staring at a code-entry screen, and a queue hop adds latency for nothing. A send failure propagates to the caller rather than being swallowed, because returning success for an OTP that was never transmitted leaves the user waiting for a message that is not coming.

`mockOtpCode` is returned **only** while SMS is mocked. Against a real provider the code exists solely on the recipient's phone.

### Which events carry SMS

Deliberately few: payment succeeded, out for delivery, delivered, order cancelled, refund succeeded. Every SMS costs money per message, and a farmer who gets one for each of a dozen status changes stops reading them. The list covers only the moments where not knowing has a real consequence — money moved, someone is about to arrive, an expected refund landed. Everything else stays in the app.

Push appears nowhere yet: device-token registration does not exist, so a `PUSH` row would only ever record a failure. It is added with the farmer app's push work in WP-10r.

### Preferences

`NotificationPreference` is per user, per category, per channel. Only categories classed `OPTIONAL` — advisory and marketing — can be disabled; the endpoint returns 400 listing the rejected categories otherwise.

**A category's class is re-evaluated at send time, not trusted from the stored preference.** Classes change as the domain grows, and a preference saved while something was optional must not silence it after it becomes transactional. An unclassified category defaults to transactional: failing to deliver an unknown event is worse than failing to suppress it.

Suppressed messages are recorded as a **failed** attempt with `SUPPRESSED_BY_PREFERENCE`, never as sent. Claiming delivery for something deliberately not sent would make the notification log untrustworthy.

### Templates live in code

Copy is authored per event in `notification-events.service.ts` and stored on the row in the recipient's language at creation. `notification-templates.ts` only reshapes it per channel — an SMS cannot carry an email's length, a push payload is shorter still.

Templates are not a database table. The copy is developer-authored, needs review, and benefits from being versioned alongside the events that emit it. A database-backed editor is a portal surface with its own approval workflow — worth building when marketing needs to change copy without a deploy, and tracked in WP-09r rather than assumed here.

**SMS segment limits are language-dependent and this matters commercially.** Devanagari encodes as UCS-2 at 70 characters per segment against GSM-7's 160. Hindi copy is truncated against the smaller budget; getting it wrong means either cut messages or a surprising bill.

## Consequences

- A farmer can be told about payment, dispatch, delivery and refunds outside the app — once a real SMS provider is configured.
- `POST /notifications/:id/dispatch` is the operational retry and the normal path; `POST /notifications/:id/attempt` is retained for manual correction only.
- Notification volume roughly doubles for the five SMS events, since each creates two rows. The `notifications` queue depth is visible at `/admin/jobs/queues`.
- **Nothing has actually been sent anywhere yet.** Every provider is still `mock`. WP-06 delivers the machinery; a BSP account makes it real, and WhatsApp templates need pre-registration with weeks of lead time.

## Deferred

- **Real providers.** Choosing a BSP is an open business decision (`docs/REMAINING_IMPLEMENTATION_PLAN.md` §9, decision 2). Each is a single file implementing `NotificationProvider`.
- **Push, including device-token registration** — with WP-10r.
- **The support SLA breach sweep**, inherited from WP-04. It still needs a `slaBreachedAt` column and a migration, and is worth building alongside the escalation notification it should trigger.
- **Non-farmer recipients.** Organisation approval, catalogue review and offer decisions still notify nobody; only farmer-facing lifecycles emit events today.
- **A database-backed template editor**, per above.
