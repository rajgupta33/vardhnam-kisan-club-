# Remaining Implementation Plan

**Companion to `docs/HANDOVER.md`. Read that first.**
**Date:** 2026-08-06

This document breaks everything that is left into **16 work packages (WP-01 … WP-16)**. Each work package states:

- **Why** — the requirement it satisfies
- **Depends on** — what must exist first
- **Build** — concrete schema, endpoints, files and logic
- **Acceptance criteria** — how you know it is done
- **Tests** — what to write
- **Estimate** — for one experienced developer

Work packages inside a stage can be parallelised across people. Stages should be done in order.

Before starting **any** work package, re-read `docs/HANDOVER.md` §11 — the Definition of Done applies to every single one.

---

## Contents

**Stage 1 — Stabilise**

- [WP-01 — Repository hygiene, branching and CI](#wp-01--repository-hygiene-branching-and-ci)
- [WP-02 — Verify and fix the Flutter apps](#wp-02--verify-and-fix-the-flutter-apps)
- [WP-03 — Generated API client and documentation backfill](#wp-03--generated-api-client-and-documentation-backfill)

**Stage 2 — Close MVP functional holes**

- [WP-04 — Background jobs with BullMQ](#wp-04--background-jobs-with-bullmq)
- [WP-05 — Returns, refunds and disputes](#wp-05--returns-refunds-and-disputes)
- [WP-06 — Real notification providers](#wp-06--real-notification-providers)
- [WP-07 — Sandbox payment provider and webhooks](#wp-07--sandbox-payment-provider-and-webhooks)
- [WP-08 — File and document storage](#wp-08--file-and-document-storage)

**Stage 3 — Portal and farmer app**

- [WP-09 — Business portal: remaining surfaces](#wp-09--business-portal-remaining-surfaces)
- [WP-10 — Farmer mobile app completion](#wp-10--farmer-mobile-app-completion)
- [WP-11 — Internationalisation (English + Hindi)](#wp-11--internationalisation-english--hindi)

**Stage 4 — Partner app and services**

- [WP-12 — Partner app shell and delivery-partner workflow](#wp-12--partner-app-shell-and-delivery-partner-workflow)
- [WP-13 — Promoter field operations](#wp-13--promoter-field-operations)
- [WP-14 — Service marketplace](#wp-14--service-marketplace)

**Stage 5 — Production readiness**

- [WP-15 — GST, invoice PDFs and the allocation engine](#wp-15--gst-invoice-pdfs-and-the-allocation-engine)
- [WP-16 — Infrastructure, observability and go-live](#wp-16--infrastructure-observability-and-go-live)

---

---

# STAGE 1 — STABILISE

Goal: make the repository honest and workable before adding features. Nothing here is glamorous; all of it prevents weeks of pain later.

---

## WP-01 — Repository hygiene, branching and CI

**Why:** The repo is one commit on `master` with stray log files, root-level binaries and no PR workflow. Mobile apps are not in CI at all.
**Depends on:** nothing.
**Estimate:** 2–3 days.

### Build

1. **Clean the tree.**
   - Delete `business-web.dev.err.log`, `business-web.dev.out.log`, `business-web.phase1b.err.log`, `business-web.phase1b.out.log`.
   - Add `*.log` to `.gitignore`.
   - Move `Vardhnam_Agrotech_Codex_Development_Blueprint.docx` and `progress till date.pdf` into `docs/reference/` (or out of the repo into shared drive — they are large binaries).
   - Confirm `.env` is gitignored and **rotate `JWT_ACCESS_SECRET`** and every other secret. Generate per-environment secrets; never reuse the `.env.example` placeholder.

2. **Branching model.** Create `main` from `master`, make it the default, protect it: require PR, require CI green, no direct pushes. Feature branches named `feat/wp-05-returns`, `fix/...`, `chore/...`. Squash-merge with a conventional commit title.

3. **Extend CI** (`.github/workflows/ci.yml`):
   - Existing Node job: keep `lint`, `typecheck`, `test`, `build`.
   - Add a **service container** job for Postgres + Redis that runs `prisma migrate deploy` then `npm --workspace @vardhnam/marketplace-api run test:integration`. Integration tests are currently never run by CI — this is the highest-value CI change available.
   - Add a **Flutter job**: `flutter pub get`, `flutter analyze`, `flutter test` for both `apps/farmer-mobile` and `apps/partner-mobile`.
   - Add `npm run format` (Prettier check).

4. **Pre-commit hook** (optional but recommended): lint-staged running Prettier + ESLint on changed files.

5. **Environment matrix.** Document and create `.env` templates for `local`, `staging`, `production` in `docs/` (values redacted), listing which of the mock provider flags flip in each.

### Acceptance criteria

- `main` is protected; a PR with a failing test cannot merge.
- CI runs unit **and** integration tests, plus Flutter analyze/test.
- `git status` is clean on a fresh clone after `npm install`.
- No secret material in the repository history going forward (if a real secret was ever committed, rotate it — do not rely on deleting the file).

---

## WP-02 — Verify and fix the Flutter apps

**Why:** The Flutter SDK was never installed in the environment where the backend was built. **Neither mobile app has ever been compiled or run.** Everything about them is unverified.
**Depends on:** WP-01 (CI job to keep them honest).
**Estimate:** 3–5 days, could be more if the skeletons have drifted.

### Build

1. Install the Flutter SDK. Pin a version in each `pubspec.yaml` (`environment.sdk` / `flutter`) and record it in `README.md`.
2. For **each** of `apps/farmer-mobile` and `apps/partner-mobile`:
   ```bash
   flutter pub get
   ```
   ```bash
   flutter analyze
   ```
   ```bash
   flutter test
   ```
   ```bash
   flutter run
   ```
   Fix everything that fails. Expect: missing/incompatible dependency versions, null-safety issues, `widget_test.dart` referencing a widget that changed, and lint failures.
3. Point the farmer app at the local API. `lib/src/marketplace/marketplace_api.dart` needs a configurable base URL — use `--dart-define=API_BASE_URL=http://10.0.2.2:3001` (Android emulator loopback) rather than a hardcoded host. Add a `--dart-define` documentation block to `README.md`.
4. Run `npm run seed:demo`, start the API, and confirm on a device/emulator that the product browse screen shows the demo product for pincode `302001`. This is the first real end-to-end proof the mobile layer works.
5. Add a `flutter analyze --fatal-infos` gate and fix the resulting warnings.
6. Establish the app architecture **now**, before more screens are written. Recommended and consistent with what already exists: `riverpod` (or `provider`) for state, `go_router` for navigation, `dio` for HTTP with an auth interceptor, `flutter_secure_storage` for tokens, `intl` + ARB for strings (see WP-11). Record the choice in `docs/DECISIONS/0003-flutter-app-architecture.md` — `AGENTS.md` requires an ADR for architectural decisions.

### Acceptance criteria

- Both apps build and run on Android and iOS simulators.
- `flutter analyze` is clean; `flutter test` passes; both run in CI.
- Farmer app lists real demo products from the local API on a physical/emulated device.
- ADR written for the chosen state/navigation/HTTP stack.

---

## WP-03 — Generated API client and documentation backfill

**Why:** Request/response types are duplicated in three places (`packages/api-client`, `business-web/src/lib/marketplace-api.ts`, `farmer-mobile/lib/src/marketplace/marketplace_api.dart`) and the shared client has already drifted. `AGENTS.md` §5 requires generated or maintained OpenAPI clients. `docs/API_CONTRACTS.md` stops at Phase 4E.
**Depends on:** WP-01.
**Estimate:** 4–6 days.

### Build

1. **Emit the OpenAPI spec to a file.** The API already builds a Swagger document in `main.ts`. Add a script that writes `openapi.json` to disk without starting the server:

   ```
   npm --workspace @vardhnam/marketplace-api run openapi:generate
   ```

   Commit the generated `openapi.json` so drift is visible in PR diffs, and add a CI step that regenerates it and fails if it differs from the committed copy.

2. **Audit the Swagger decorators first.** Newer modules (`finance`, `payouts`, `promoters`, `support`, `tally`, `notifications`, `dashboards`) must have `@ApiTags`, `@ApiOperation`, `@ApiResponse` and typed response DTOs. Generation is only as good as the decorators. Budget most of this WP here.

3. **Generate the TypeScript client** into `packages/api-client` using `openapi-typescript` + a thin fetch wrapper, or `orval`. Keep the existing hand-written `ApiClientError` and envelope helpers; replace the hand-written type unions with generated ones. Delete the drifted manual types.

4. **Migrate `business-web`** to consume `@vardhnam/api-client` instead of its own type definitions. `marketplace-api.ts` keeps the server-side auth-header injection but uses generated types.

5. **Generate the Dart client** with `openapi-generator` (`dart-dio` generator) into `apps/farmer-mobile/lib/src/api/generated/`, or — if the generated Dart is unwieldy — hand-maintain but generate the **models** only. Record whichever choice you make in an ADR.

6. **Backfill `docs/API_CONTRACTS.md`** with the sections that are missing entirely: Authentication (`/auth/*`), Finance (`/finance/*`), Payouts (`/payouts/*`), Promoter attribution (`/promoters/*`), Support (`/support/*`), Tally (`/tally/*`), Notifications (`/notifications/*`), Dashboards (`/dashboards/*`). Match the existing format in that file exactly.

7. Update `docs/DATA_MODEL.md` for every model added since Phase 4 (commission, ledger, settlement, attribution, payout account, support ticket, Tally sync, notification).

### Acceptance criteria

- `openapi.json` is committed and CI fails on drift.
- `packages/api-client` types are generated, not hand-written, and include every current endpoint.
- `business-web` compiles against the generated client with zero local type duplication.
- `API_CONTRACTS.md` documents 100% of live endpoints.

---

---

# STAGE 2 — CLOSE MVP FUNCTIONAL HOLES

---

## WP-04 — Background jobs with BullMQ

**Why:** `AGENTS.md` §5 and `PRODUCT_REQUIREMENTS.md` §24 require background jobs with retry and dead-letter handling. `bullmq` is installed but **completely unused**. Every subsequent work package (notifications, webhooks, Tally sync, commission finalisation, expiry sweeps) needs this. Build it before them.
**Depends on:** WP-01.
**Estimate:** 5–7 days.

### Build

1. **`src/jobs/` module.**
   - `jobs.module.ts` registering BullMQ with the existing `RedisModule` connection.
   - `queue-names.ts` — a const enum of queue names. Start with: `notifications`, `payment-webhooks`, `tally-sync`, `scheduled-maintenance`.
   - A base `JobProcessor` pattern with structured logging that propagates the originating `requestId`/correlation ID into the job payload and logs it on every attempt.

2. **Retry and dead-letter policy.** Exponential backoff, capped attempts (start with 5), `removeOnComplete` with a retention window, and a **dead-letter queue** per queue. Failed-after-max jobs move to DLQ with the full error and payload retained.

3. **Operational visibility.** An admin-only endpoint set under `/admin/jobs`:
   - `GET /admin/jobs/queues` — depth, active, failed, delayed counts per queue.
   - `GET /admin/jobs/dead-letter` — paginated DLQ entries.
   - `POST /admin/jobs/dead-letter/:id/retry` — requeue, audited.
     Guard with a new `JOBS_READ` / `JOBS_MANAGE` permission for `ADMIN`/`SUPER_ADMIN` only.

4. **Scheduled (repeatable) jobs.** Register these on boot:

   | Job                             | Schedule | What it does                                                                                                                                  |
   | ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
   | `finalize-eligible-commissions` | daily    | Calls the existing `financeService.finalizeEligibleCommissionEntries` logic — today this only runs if someone POSTs to the endpoint manually. |
   | `expire-batches`                | daily    | Marks `InventoryBatch` rows past expiry as `EXPIRED` so they drop out of derived availability.                                                |
   | `expire-otp-challenges`         | hourly   | Cleans up spent/expired `OtpChallenge` rows.                                                                                                  |
   | `prune-refresh-tokens`          | daily    | Removes revoked/expired `RefreshToken` rows.                                                                                                  |
   | `support-sla-breach-sweep`      | hourly   | Flags tickets past `SUPPORT_TICKET_DEFAULT_SLA_HOURS` and (after WP-06) notifies.                                                             |

5. **Worker process.** Add `npm run start:worker` running the same Nest app in worker-only mode (queues consumed, HTTP not served) so API and workers can scale independently per `PRODUCT_REQUIREMENTS.md` §24. Document running both locally.

6. **Health.** Extend `/health/ready` to report Redis and queue connectivity.

### Acceptance criteria

- A job can be enqueued, processed, retried with backoff, and lands in the DLQ after max attempts.
- DLQ retry works and writes an audit record.
- All five scheduled jobs run on schedule and are idempotent (running twice does no damage).
- Worker runs as a separate process; API still works with the worker stopped (jobs simply queue up).
- Integration test: `test/integration/jobs.spec.ts` covering enqueue → process → fail → DLQ → retry.

---

## WP-05 — Returns, refunds and disputes

**Current implementation status (2026-08-12):** return request, operational transitions, explicit per-original-reservation inspection, idempotent refund initiation, farmer/operations reads, mock success/failure confirmation, immutable linked refund ledger entries and commission reversal are implemented. The HTTP MVP acceptance scenario passes against local PostgreSQL through the complete delivery-to-return-to-refund tail with idempotent replay, original-batch restock provenance, farmer refund ownership, immutable refund ledger, commission-reversal and localized notification assertions. Evidence upload, pickup assignments, disputes, asynchronous queue execution and real-provider execution remain open.

**Why:** `PRODUCT_REQUIREMENTS.md` §18 and §25 (MVP scope includes "return request"). The `ProductOrderStatus` enum already declares nine return/refund/dispute statuses that **no code can currently produce**. This is the largest functional gap in the product.
**Depends on:** WP-04 (for async refund processing). Refund _execution_ against a real provider needs WP-07, but model the refund now and let the mock provider handle it, exactly as payments were built.
**Estimate:** 3–4 weeks. This is the biggest backend package left.

### Business rules that must hold (from `AGENTS.md` §2 and `PRODUCT_REQUIREMENTS.md` §18)

- Returns and refunds must be fully auditable.
- **Returned goods must never automatically re-enter sellable inventory.** They go to a quarantined state and only an explicit, audited inspection decision can restock them.
- Refunds and commission reversals must be represented as **financial ledger entries** — never by mutating an existing entry.
- The distributor is the seller of record, so the return is against the distributor's child order, not the parent checkout.
- Commission that was already finalised must be reversed through `financeService.reverseCommissionEntry` (this already exists — reuse it).

### Build

**1. Schema** — new migration `2026xxxx_add_returns_refunds_disputes`.

```prisma
enum ReturnRequestStatus {
  REQUESTED
  APPROVED
  REJECTED
  IN_TRANSIT
  RECEIVED
  INSPECTED
  COMPLETED
  CANCELLED
}

enum ReturnReasonCode {
  DAMAGED_IN_TRANSIT
  WRONG_ITEM
  EXPIRED_OR_NEAR_EXPIRY
  QUALITY_ISSUE
  NOT_AS_DESCRIBED
  ORDERED_BY_MISTAKE
  OTHER
}

enum ReturnInspectionOutcome {
  RESTOCKABLE
  DAMAGED_WRITE_OFF
  QUARANTINED
  REJECTED_RETURN
}

enum RefundStatus {
  PENDING
  PROCESSING
  SUCCEEDED
  FAILED
  CANCELLED
}

enum RefundMethod {
  ORIGINAL_PAYMENT_METHOD
  MANUAL_BANK_TRANSFER
  ADJUSTMENT
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  AWAITING_FARMER
  AWAITING_DISTRIBUTOR
  RESOLVED_FOR_FARMER
  RESOLVED_FOR_DISTRIBUTOR
  RESOLVED_SPLIT
  CLOSED
}

model ReturnRequest {
  id                  String   @id @default(uuid())
  productOrderId      String
  farmerUserId        String
  distributorOrgId    String
  status              ReturnRequestStatus @default(REQUESTED)
  reasonCode          ReturnReasonCode
  reasonNote          String?
  requestedAt         DateTime @default(now())
  windowExpiresAt     DateTime          // computed from delivery + RETURN_WINDOW_DAYS
  reviewedByUserId    String?
  reviewedAt          DateTime?
  reviewNote          String?
  pickupAssignmentId  String?           // links to a delivery-partner return pickup
  receivedAt          DateTime?
  inspectedByUserId   String?
  inspectedAt         DateTime?
  inspectionOutcome   ReturnInspectionOutcome?
  inspectionNote      String?
  refundableAmountPaise Int?            // backend-calculated, never client-supplied
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  items               ReturnRequestItem[]
  evidence            ReturnRequestEvidence[]
  statusHistory       ReturnRequestStatusHistory[]
  refunds             Refund[]
}

model ReturnRequestItem {
  id                  String @id @default(uuid())
  returnRequestId     String
  productOrderItemId  String
  quantity            Int
  unitPricePaise      Int              // snapshot from the order item
  lineRefundPaise     Int              // backend-calculated
  reservationId       String?          // ProductOrderItemReservation, for batch traceability
}

model ReturnRequestEvidence { /* mirror SupportTicketEvidence exactly */ }
model ReturnRequestStatusHistory { /* mirror ProductOrderStatusHistory exactly */ }

model Refund {
  id                  String @id @default(uuid())
  productOrderId      String
  returnRequestId     String?          // null for cancellation-driven refunds
  paymentIntentId     String?
  farmerUserId        String
  amountPaise         Int
  method              RefundMethod
  status              RefundStatus @default(PENDING)
  providerRefundRef   String?
  providerMode        PaymentProviderMode   // reuse the existing enum: MOCK / SANDBOX / LIVE
  failureReason       String?
  idempotencyKey      String @unique
  initiatedByUserId   String
  initiatedAt         DateTime @default(now())
  completedAt         DateTime?
  events              RefundEvent[]
}

model RefundEvent { /* mirror PaymentEvent exactly */ }

model Dispute {
  id                  String @id @default(uuid())
  productOrderId      String?
  serviceBookingId    String?          // nullable now; populated after WP-14
  returnRequestId     String?
  raisedByUserId      String
  againstOrganisationId String?
  status              DisputeStatus @default(OPEN)
  category            String
  description         String
  assignedToUserId    String?
  resolutionNote      String?
  resolvedAt          DateTime?
  resolutionAmountPaise Int?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  events              DisputeEvent[]
}

model DisputeEvent { /* actor, action, note, timestamp */ }
```

Also add two `InventoryMovementType` values: `RETURN_QUARANTINED` and `RETURN_RESTOCKED`. **Do not** reuse `STOCK_RECEIVED` for returns — provenance must be distinguishable in the ledger forever.

Add `FinancialLedgerEntryType` values if not already present: `REFUND`, `RETURN_ADJUSTMENT`.

**2. `src/returns/` module.**

| Method | Endpoint                | Actor                      | Notes                                                                                                                                                   |
| ------ | ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/returns`              | Farmer                     | Requires `Idempotency-Key`. Order must be `DELIVERED` and inside the return window. Creates `ReturnRequest` + items, moves order to `RETURN_REQUESTED`. |
| GET    | `/returns/me`           | Farmer                     | Own requests.                                                                                                                                           |
| GET    | `/returns/:id`          | Farmer / distributor / ops | Ownership-scoped.                                                                                                                                       |
| POST   | `/returns/:id/evidence` | Farmer                     | Mirrors support ticket evidence.                                                                                                                        |
| GET    | `/returns`              | Ops / distributor          | Filterable queue.                                                                                                                                       |
| POST   | `/returns/:id/approve`  | Distributor / ops          | → `APPROVED`, order → `RETURN_APPROVED`.                                                                                                                |
| POST   | `/returns/:id/reject`   | Distributor / ops          | → `REJECTED`, order → `RETURN_REJECTED`. Requires a reason.                                                                                             |
| POST   | `/returns/:id/pickup`   | Delivery partner / ops     | → `IN_TRANSIT`, order → `RETURN_IN_TRANSIT`.                                                                                                            |
| POST   | `/returns/:id/receive`  | Distributor                | → `RECEIVED`.                                                                                                                                           |
| POST   | `/returns/:id/inspect`  | Distributor / ops          | Records `inspectionOutcome`. **This is where inventory moves.**                                                                                         |
| POST   | `/returns/:id/cancel`   | Farmer                     | Only before `IN_TRANSIT`.                                                                                                                               |

**Inspection logic — the critical piece:**

- `RESTOCKABLE` → append a `RETURN_RESTOCKED` movement against the original batch. Requires an explicit inspector decision; never automatic.
- `DAMAGED_WRITE_OFF` → append `DAMAGE_WRITE_OFF`. Stock does **not** become sellable.
- `QUARANTINED` → append `RETURN_QUARANTINED`. Not sellable. Requires a later separate decision.
- `REJECTED_RETURN` → no inventory movement; no refund; order returns to `DELIVERED`.

**3. `src/refunds/` module.** (May live inside `src/payments/` — decide and be consistent.)

| Method | Endpoint               | Actor                                                                      |
| ------ | ---------------------- | -------------------------------------------------------------------------- |
| POST   | `/refunds`             | Ops / finance — requires `Idempotency-Key`                                 |
| GET    | `/refunds`             | Ops / finance                                                              |
| GET    | `/refunds/me`          | Farmer                                                                     |
| GET    | `/refunds/:id`         | Scoped                                                                     |
| POST   | `/refunds/:id/confirm` | **Mock provider only** — mirrors `POST /payments/mock-intents/:id/confirm` |

Refund processing runs on the `payment-webhooks` queue (WP-04). On `SUCCEEDED`, inside one transaction:

1. Set `Refund.status = SUCCEEDED`, write a `RefundEvent`.
2. Post a `REFUND` `FinancialLedgerEntry` (negative to the farmer-payment side, offsetting the distributor payable).
3. Call the **existing** `financeService.reverseCommissionEntry` for the affected commission entries — marketplace commission and promoter commission both reverse.
4. Move the order to `REFUNDED` (or `CLOSED` after full settlement) and write status history.
5. Write audit records.

**4. `src/disputes/` module.** Model it on `src/support/` — it has the closest lifecycle shape. Endpoints: create, list, list mine, detail, assign, add event/note, request info from farmer/distributor, resolve (with resolution amount and direction), close. A resolution that awards money raises a `Refund` or an `adjustment` ledger entry — never a direct balance edit.

**5. Wire the return window.** `RETURN_WINDOW_DAYS` (currently `7`, marked "pending approval") already gates commission finalisation. It must now also gate return eligibility. Get the real number signed off by the business before pilot.

**6. Notifications.** After WP-06, emit events on: return requested, approved, rejected, picked up, inspected, refund initiated, refund completed, dispute raised, dispute resolved.

### Acceptance criteria

- A farmer can request a return on a `DELIVERED` order within the window and **cannot** outside it.
- Approve → pickup → receive → inspect flows through every status with full history and audit.
- `RESTOCKABLE` inspection is the **only** path that makes stock sellable again, and it produces a distinguishable `RETURN_RESTOCKED` movement.
- A completed refund posts a `REFUND` ledger entry **and** reverses both marketplace and promoter commission entries.
- Refund creation is idempotent — the same `Idempotency-Key` never double-refunds.
- No financial row is ever updated in place in a way that loses history.
- Dispute resolution awarding money creates a refund or adjustment entry, never a silent balance change.

### Tests

- `test/returns.service.spec.ts`, `test/refunds.service.spec.ts` (unit).
- `test/integration/returns-refunds.spec.ts` — full happy path plus: outside-window rejection, double-refund idempotency, commission reversal assertions, restock vs write-off inventory assertions, cross-distributor isolation, farmer cannot act on another farmer's return.
- **Extend `mvp-acceptance.spec.ts`** with a return/refund tail so the flagship test covers the complete lifecycle.

---

## WP-06 — Real notification providers

**Why:** `PRODUCT_REQUIREMENTS.md` §20. The abstraction exists, and mock-payment outcomes plus farmer-visible seller-order fulfilment, support-ticket and return/refund transitions now write transactional, localised `IN_APP` notifications automatically. External channels are not sent; a human must still POST to `/notifications/:id/attempt` for the recorded/manual mock delivery path.
**Depends on:** WP-04.
**Estimate:** 2 weeks.

### Build

1. **Provider interface.** `src/notifications/providers/notification-provider.interface.ts`:

   ```ts
   interface NotificationProvider {
     readonly channel: NotificationChannel;
     send(notification: Notification): Promise<{ providerRef: string }>;
   }
   ```

   Implement per channel, selected by the existing env flags (`SMS_PROVIDER`, `WHATSAPP_PROVIDER`, `EMAIL_PROVIDER`, plus new `PUSH_PROVIDER`):
   - `MockSmsProvider` / `MockWhatsappProvider` / `MockEmailProvider` / `MockPushProvider` — keep these; they are what dev and CI use. **Keep them clearly labelled as mock.**
   - Real: SMS + WhatsApp via an Indian BSP (MSG91, Gupshup, Karix or Twilio); push via FCM (Android + iOS); email via SES/SendGrid.
   - In-app needs no provider — it is already satisfied by the `Notification` row plus `GET /notifications/me`.

2. **Worker.** A `notifications` queue processor replaces the manual attempt endpoint as the normal path. Keep the manual endpoint for ops replay, guarded. Retry with backoff; exhausted retries → DLQ, notification → `FAILED`.

3. **Templates.** `NotificationTemplate` keyed by `(category, channel, locale)`, with variable interpolation from `payloadSnapshot`. **Both `en` and `hi` are required from MVP** (`PRODUCT_REQUIREMENTS.md` §24). WhatsApp templates must be pre-registered with the BSP — allow lead time for approval.

4. **User preferences.** `NotificationPreference` per user per category per channel, with sensible defaults. Transactional notifications (OTP, order status, refund) should not be opt-out-able; marketing ones must be.

5. **Wire domain events — this is the point of the whole package.** Emit notifications from the services that already exist:

   | Event                                           | Recipient             | Channels                     |
   | ----------------------------------------------- | --------------------- | ---------------------------- |
   | OTP requested                                   | User                  | SMS (replaces `mockOtpCode`) |
   | Organisation approved / rejected                | Org owner             | Email + in-app               |
   | Catalogue product approved / rejected           | Company               | Email + in-app               |
   | Offer approved / rejected / paused              | Distributor           | In-app                       |
   | Order confirmed (payment success)               | Farmer + distributor  | Push + SMS + in-app          |
   | Order accepted / rejected by distributor        | Farmer                | Push + in-app                |
   | Order packed / invoiced / ready for pickup      | Farmer                | Push                         |
   | Delivery assigned                               | Delivery partner      | Push                         |
   | Out for delivery (**+ delivery OTP**)           | Farmer                | Push + SMS                   |
   | Delivered                                       | Farmer                | Push + in-app                |
   | Order cancelled                                 | Farmer + distributor  | Push + in-app                |
   | Return requested / approved / rejected          | Farmer + distributor  | Push + in-app                |
   | Refund initiated / completed                    | Farmer                | Push + SMS                   |
   | Support ticket assigned / resolved / SLA breach | Requester + agent     | In-app + email               |
   | Commission finalised, settlement created        | Partner / distributor | In-app + email               |
   | Low stock / expiring batch                      | Distributor           | In-app + email               |

   Use a Nest `EventEmitter` (or direct service calls inside the existing transactions) → enqueue on the `notifications` queue. **Enqueue after the transaction commits**, so a rolled-back order never notifies anyone.

6. **Delivery OTP must move to SMS.** Today the mock OTP is returned in the assignment API response. Once SMS is live, the OTP goes to the farmer's phone and the response stops exposing it outside mock mode.

### Acceptance criteria

- With all providers set to `mock`, everything works exactly as today and CI is unaffected.
- With a real SMS provider configured in staging, an OTP arrives on a real phone and `mockOtpCode` is absent from the response.
- Every event in the table above produces a `Notification` row automatically, with no manual API call.
- Failed sends retry with backoff and land in the DLQ; the notification shows `FAILED` with the provider error.
- Users can opt out of non-transactional categories.
- Hindi templates render correctly.

---

## WP-07 — Sandbox payment provider and webhooks

**Why:** `PRODUCT_REQUIREMENTS.md` §13, Phase 7. The mock flow is complete and correct in shape; it now needs a real sandbox behind the same interface.
**Depends on:** WP-04, and WP-05 for refunds.
**Estimate:** 2 weeks.

### Build

1. **Provider abstraction.** `src/payments/providers/payment-provider.interface.ts` with `createIntent`, `verifyWebhookSignature`, `fetchIntentStatus`, `createRefund`. Implementations: `MockPaymentProvider` (existing behaviour, kept for dev/CI) and `RazorpayProvider` (or PayU/Cashfree — pick based on the business's merchant account). Selected by `PAYMENT_PROVIDER`. The existing `PaymentProviderMode` enum (`MOCK` / `SANDBOX` / `LIVE`) already models this — use it.

2. **Webhook endpoint** `POST /payments/webhooks/:provider`:
   - **Verify the signature before anything else.** `AGENTS.md` requires authenticated webhook signatures. Reject with 401 on mismatch and log it as a security event.
   - Persist the **raw** payload immediately (`WebhookEvent` model: provider, event id, signature, raw body, received at, processing status).
   - Deduplicate on the provider event id — **webhooks must be idempotent** and providers do redeliver.
   - Return 200 fast; process asynchronously on the `payment-webhooks` queue.
   - **A frontend redirect is never proof of payment** (`PRODUCT_REQUIREMENTS.md` §13). Only a server-verified webhook or an explicit server-side status fetch may mark a payment successful.

3. **Reconciliation.** A scheduled job that fetches provider status for any intent stuck in `PROCESSING` beyond a threshold, and a `GET /payments/reconciliation` report for finance showing intents whose local status disagrees with the provider.

4. **Refund execution** against the real provider, replacing the mock confirm path from WP-05.

5. **Ledger integration.** A successful capture must post the farmer-payment ledger entry. Verify the amount from the **provider payload**, not the client, and reject mismatches loudly.

6. **Security.** Never log full payment payloads with card/UPI identifiers. Store provider keys in secret management, not `.env` in production.

### Acceptance criteria

- Sandbox payment completes end to end and the order reaches `CONFIRMED` **only** after webhook verification.
- A tampered signature is rejected and logged.
- The same webhook delivered five times produces exactly one state change.
- A refund issued through the provider reaches `SUCCEEDED` and posts the ledger entry and commission reversal.
- The reconciliation report flags a deliberately desynchronised intent.
- Switching `PAYMENT_PROVIDER=mock` restores the current behaviour so CI never touches the network.

---

## WP-08 — File and document storage

**Why:** KYC documents, product images, product labels, delivery proof photos, return evidence and support evidence are **all metadata-only today**. There is no file storage anywhere in the repo. Every one of those features is unusable in the real world without it.
**Depends on:** WP-01.
**Estimate:** 1 week.

### Build

1. **Storage abstraction.** `src/storage/storage.provider.interface.ts` with `getUploadUrl`, `getDownloadUrl`, `delete`, `getMetadata`. Implementations: `LocalDiskProvider` (dev/CI) and `S3Provider` (or GCS). Selected by `STORAGE_PROVIDER`.

2. **Direct-to-storage uploads.** The API issues a **presigned upload URL**; the client uploads directly; the client then confirms with the API, which records the object key. Do not proxy file bytes through the API.

3. **`StoredFile` model:** id, ownerUserId, organisationId, purpose (`KYC_DOCUMENT` / `PRODUCT_IMAGE` / `PRODUCT_DOCUMENT` / `DELIVERY_PROOF` / `RETURN_EVIDENCE` / `SUPPORT_EVIDENCE` / `SERVICE_EVIDENCE`), object key, content type, size, checksum, virus-scan status, created at. Existing metadata models (`KycDocument`, `ProductDocument`, `SupportTicketEvidence`, and the new return/service evidence models) get a nullable `storedFileId` FK.

4. **Validation:** allowed MIME types and max size per purpose, enforced when the presigned URL is issued **and** re-verified on confirm (a client can upload anything to a presigned URL).

5. **Access control:** downloads go through the API, which checks permission and then returns a short-lived signed URL. **Never expose a public bucket.** KYC documents contain PII — log every download as an audit record (`AGENTS.md`: high-risk exports must be logged).

6. **Virus scanning** (ClamAV or the cloud provider's scanner) as a queue job; files stay `PENDING_SCAN` and undownloadable until clean.

7. **Retention policy** documented in `docs/SECURITY_AND_COMPLIANCE.md`.

### Acceptance criteria

- A distributor uploads a KYC PDF and a reviewer downloads it; both actions are audited.
- Oversized or wrong-MIME uploads are rejected.
- A user from another organisation gets 403 on download.
- Signed URLs expire.
- `STORAGE_PROVIDER=local` keeps dev and CI free of cloud dependencies.

---

---

# STAGE 3 — PORTAL AND FARMER APP

---

## WP-09 — Business portal: remaining surfaces

**Why:** Substantial backend capability has no UI. Operations, finance and support teams cannot do their jobs. `PRODUCT_REQUIREMENTS.md` §22: operational action lists matter more than decorative charts.
**Depends on:** WP-03 (generated client). WP-05 for the returns screens.
**Estimate:** 4–5 weeks.

**Status (2026-08-14): PARTIAL.** The shared Flutter shell is implemented and
verified: Android/iOS runners, OTP login, supported-partner membership filtering,
explicit multi-organisation selection, platform-secure session persistence,
serialized refresh with one retry, role-forced routing for all four partner roles,
and persisted English/Hindi localisation. The shared KYC/payout screens and the
delivery-partner workflow below remain open; no placeholder UI is represented as a
working integration.

### Build

**First, replace the fake home page.** `src/components/role-dashboard.tsx` renders hardcoded metrics from `portal-copy.ts` while a working `GET /dashboards/summary` sits unused. Wire it up: render the permission-scoped items the API returns, each linking to its filtered work queue. Add the audited export using `GET /dashboards/summary/export`. This is the highest-impact single change in the portal.

**New route groups** (follow the existing `app/<area>/page.tsx` + `actions.ts` server-action pattern exactly):

| Route                                                | Contents                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/finance/commission-rules`                          | List, create, activate/deactivate rules.                                                                                                                |
| `/finance/commission-entries`                        | Filterable list; finalise-eligible action; reverse action with reason.                                                                                  |
| `/finance/ledger`                                    | Filterable ledger with running totals; CSV export (audited).                                                                                            |
| `/finance/settlements` + `/finance/settlements/[id]` | List, detail with line items, create settlement.                                                                                                        |
| `/payouts/accounts`                                  | Partner payout accounts, verification queue, verify/reject action.                                                                                      |
| `/payouts/statements`                                | Per-partner statements.                                                                                                                                 |
| `/support` + `/support/[ticketId]`                   | Ticket queue with SLA indicators; detail with the full lifecycle actions (assign, mark-waiting, resume, escalate, resolve, close, reopen) and evidence. |
| `/returns` + `/returns/[id]`                         | Return queue; approve/reject/receive/inspect actions with the inspection-outcome selector. **(after WP-05)**                                            |
| `/refunds`                                           | Refund queue and status. **(after WP-05)**                                                                                                              |
| `/disputes` + `/disputes/[id]`                       | Dispute queue and resolution. **(after WP-05)**                                                                                                         |
| `/notifications`                                     | Delivery log, failed notifications, retry action.                                                                                                       |
| `/tally`                                             | Sync record list, status, attempt history, retry, reconciliation report.                                                                                |
| `/admin/jobs`                                        | Queue depths and DLQ retry. **(after WP-04)**                                                                                                           |
| `/organisations`                                     | Directory with status, membership management, suspend/reactivate.                                                                                       |
| `/users`                                             | User admin: search, role assignment, status.                                                                                                            |

**Cross-cutting portal work:**

- Extend the nav in `business-shell.tsx` and **filter nav items by the current user's permissions** — a distributor must never see finance links.
- **Replace the mock-auth env headers with the real auth flow.** The portal currently authenticates every request as a single hardcoded mock user from `BUSINESS_WEB_MOCK_*` env vars. Build real login (`/auth/login`), organisation selection (`/auth/select-organisation`), httpOnly session cookies, refresh-token rotation, and logout. **The portal cannot go to production until this is done** — treat it as the top priority within this WP.
- Server-side permission validation on every page (`AGENTS.md` §5) — never rely on hiding a button.
- Pagination, filtering and sorting as reusable components; several existing pages currently render unbounded lists.
- Empty states, loading states and error states for every new page.
- Move every new string into `portal-copy.ts`.

### Acceptance criteria

- Portal home shows live, permission-scoped counts from the API.
- A `FINANCE_MANAGER` sees finance routes; a `DISTRIBUTOR_OWNER` gets 403 on them, both in the nav and by direct URL.
- Real login works; no `BUSINESS_WEB_MOCK_*` variable is required to run the portal.
- Every backend module built to date has at least one portal surface.
- CSV exports write audit records.

---

## WP-10 — Farmer mobile app completion

**Why:** `PRODUCT_REQUIREMENTS.md` §4.1. The app covers API-backed browse → detail → cart → idempotent checkout and child-order review. The rest of the farmer journey does not exist.
**Depends on:** WP-02, WP-03, WP-08 (invoice/evidence files), WP-05 (returns), WP-06 (push).
**Estimate:** 6–8 weeks.

### Build, in this order

1. **Auth.** **Foundation complete:** phone/OTP self-registration, secure token storage, serialized silent refresh with one retry, guarded routes and logout are implemented. Remaining: real approved SMS, multiple-farmer-membership selection and device/API verification.
2. **Farmer profile + farm/crop profile.** **Existing profile fields connected:** authenticated name, language, village/district/state, pincode and crop-interest read/write are implemented. Remaining: structured farms, crops, acreage and first-login completion; these need approved backend models and a migration.
3. **Address management.** **Manual flow connected:** farmer-owned list, add, edit and set-default operations use the existing audited backend endpoints. Remaining: optional consent-based pincode/location assistance; manual entry remains available.
4. **Discovery upgrades.** Crop-wise and problem-wise browsing (§9) in addition to the existing category/brand/search. Check whether the marketplace API exposes crop and problem filters — if not, extend it.
5. **Product detail.** **Core API-backed flow complete:** variants, seller/distributor legal identity, GSTIN, fulfilment mode, delivery SLA, availability, warehouse, batch metadata, public document metadata and offer selection are shown for the active pincode; the selected offer can be added to the farmer-owned cart. Remaining: actual product images after WP-08 file delivery exists.
6. **Cart → checkout → payment.** **Cart and checkout complete:** authenticated cart operations, pincode-matched owned-address selection, persisted idempotency, inventory-reserving checkout and child-order review are connected. Remaining: API-backed mock-payment UI first, then the real provider (WP-07), with a proper payment-pending/success/failure state machine that **never trusts the client redirect**.
7. **Order list and tracking.** Full status timeline mirroring `ProductOrderStatusHistory`, per child order, showing the distributor as seller.
8. **Invoice download** (needs the PDF from WP-15).
9. **Cancellation** — promote the existing preview screen to the real flow.
10. **Return request** — reason selection, item selection, photo evidence upload, status tracking (WP-05, WP-08).
11. **Refund tracking.**
12. **Support tickets** — create with category and evidence, view thread, reopen.
13. **Product reviews** — see WP-15 note; needs a new backend model.
14. **Push notifications** — FCM registration, token upload, deep links into the relevant order/return/ticket.
15. **WhatsApp and phone support access** (§4.1) — simple launcher links to the support number.
16. **Slow-network handling** (§24) — request timeouts, retry, cached last-good product list, clear offline state.
17. **Accessibility** (§24) — tap targets ≥ 48dp, semantic labels, readable type scale, simple inline form errors.

### Acceptance criteria

- A farmer registers with a real OTP, sets an address, browses by pincode, orders, pays in sandbox, tracks to delivery, downloads the invoice, requests a return, tracks the refund and raises a support ticket — entirely on the device.
- No hardcoded strings; app runs fully in Hindi (WP-11).
- No financial amount is computed on the device — every total comes from the API.
- The app behaves sanely on a throttled 2G connection.

---

## WP-11 — Internationalisation (English + Hindi)

**Why:** `PRODUCT_REQUIREMENTS.md` §24 requires English and Hindi from MVP, and no user-facing string hardcoded in a component. Today there are `en`/`hi` string maps in Flutter with no locale machinery, and an English-only portal.
**Depends on:** WP-02.
**Estimate:** 1.5 weeks (plus translation turnaround).

### Build

1. **Flutter:** migrate `app_strings.dart` to `flutter_localizations` + `intl` with ARB files (`app_en.arb`, `app_hi.arb`). Add device-locale detection, an in-app language switcher, and persistence of the choice. Handle Devanagari text metrics — check line heights and truncation on small screens.
2. **Business portal:** `next-intl` (or equivalent) with `en`/`hi` message catalogues; migrate `portal-copy.ts`. Portal Hindi is lower priority than app Hindi — distributors and ops are more likely to work in English — but the machinery should exist.
3. **Backend:** user-facing message strings in notifications must be template-driven per locale (WP-06). API **error codes** stay locale-independent — clients map codes to localised messages. Do not translate `ApiErrorCode` values.
4. **Locale on the user record:** persist a preferred locale per user and use it for notification template selection.
5. **Process:** a script that lists untranslated keys; CI fails if `app_hi.arb` is missing keys present in `app_en.arb`.
6. Get real Hindi translations from a human familiar with agricultural terminology. Machine-translated agri-input terminology will be wrong in ways farmers notice — pesticide, seed and fertiliser terms are highly regional.

### Acceptance criteria

- Both apps run fully in Hindi with no English leakage in user-facing text.
- Language switch persists across restarts.
- CI catches a missing translation key.
- Notifications arrive in the recipient's preferred language.

---

---

# STAGE 4 — PARTNER APP AND SERVICE MARKETPLACE

---

## WP-12 — Partner app shell and delivery-partner workflow

**Why:** `PRODUCT_REQUIREMENTS.md` §4.2. The partner app is a static screen with three role tiles. Start with the delivery partner because **the backend already supports it** — assignment, out-for-delivery and OTP completion all exist and are test-covered.
**Depends on:** WP-02, WP-03, WP-06, WP-08.
**Estimate:** 4–5 weeks.
**Status (2026-08-14): PARTIAL.** The shared authenticated, localised and
role-routed Flutter shell is complete. Delivery partners now have an own-scoped,
paginated assignment inbox and detail workflow, can manage backend-owned
online/offline availability, can explicitly accept or reason-reject pending work,
verify package pickup by QR scan or manual fallback, open navigation/calling
handoffs, and can move a verified package to out-for-delivery and complete it
with backend-verified OTP. Operations can reassign rejected work to a different
online partner with a fresh OTP. Permission-aware geotag proof and structured
failed-delivery scheduling/retry are connected. Shared earnings and payout-account
read/create/edit are connected for all partner roles. KYC, photo proof and push
remain open. Return pickup assignment, partner
accept/reject and collection are complete.

### Build

**Shell (do this once, all three roles depend on it):**

- Auth reusing the same OTP flow as the farmer app.
- **Role-based routing after login.** One app, interfaces determined by the logged-in role (`AGENTS.md` §5). A user with multiple partner roles picks a context, mirroring `/auth/select-organisation`.
- Shared KYC submission flow (documents via WP-08). **Payout and earnings complete:** all supported partner roles can read the masked own account, create or resubmit full bank details through `PUT /payouts/accounts/me`, and read backend-owned statements through `GET /payouts/statements/me`. Resubmission visibly resets verification to pending and the app never treats the returned mask as an editable account number.
- Push registration, i18n, offline-tolerant HTTP.

**Delivery partner:**

1. **Availability toggle (online/offline) — complete:** organisation-scoped `DeliveryPartnerProfile`, own read/update endpoints, audit and assignment eligibility enforcement are connected to the bilingual app.
2. **Assignment inbox and accept/reject — complete:** own-scoped list/detail, audited partner response, acceptance-before-pickup enforcement and operations-only rejected-work reassignment with a fresh OTP.
3. **Pickup proof + package QR scan — complete:** seller-scoped label issuance stores only a hash; assigned-partner scanning/manual fallback verifies pickup with actor/time and failed-attempt audit before delivery can start.
4. **Navigation handoff — complete:** the app sends the backend delivery-address snapshot to an external maps app without collecting partner location.
5. **Farmer calling pilot — complete:** plain `tel:` handoff is available. Call masking remains a production-provider decision.
6. **Delivery OTP entry** — hits the existing `POST /fulfilment/orders/:orderId/deliver`.
7. **Geotagged proof of delivery — location complete, photo pending WP-08.** The app requests foreground location only during OTP completion. The backend stores latitude, longitude, device accuracy and capture time when permission is granted, or a durable `DENIED`/`UNAVAILABLE` outcome without blocking completion. Photo evidence and `proofStoredFileId` remain deferred until authorised private storage exists.
8. **Failed delivery — complete:** controlled reason codes, a durable failure count and actor metadata, backend-validated retry scheduling, audited `DELIVERY_FAILED` transitions and due-only retry with a fresh OTP are connected to the bilingual app.
9. **Return pickup — complete:** operations assigns an approved return to an online delivery partner; the own-scoped bilingual app supports accept, reason-reject, navigation/calling and collection. Collection atomically advances the return and child order to `IN_TRANSIT` with history, audit and farmer notification.
10. **COD ledger** where enabled — cash collected, remittance tracking, reconciliation against settlements. Confirm with the business whether COD is in pilot scope before building this; it is significant work.
11. **Earnings and payout statements — complete:** the shared role-accessible screen uses backend totals and exact status filters; payout-account creation/editing submits to the own-scoped API and returns the masked pending-verification view.

### Acceptance criteria

- One binary; a promoter and a delivery partner logging in see different interfaces.
- A delivery partner completes a delivery: accept → scan → navigate → OTP → permission-aware location proof → `DELIVERED`. Real-device location verification remains required before pilot sign-off.
- Failed delivery produces `DELIVERY_FAILED` with a reason and a retry path.
- Location-permission denial degrades gracefully rather than blocking delivery.
- KYC, payout account and earnings screens work for all three partner roles.

---

## WP-13 — Promoter field operations

**Why:** `PRODUCT_REQUIREMENTS.md` §4.2 and §16. Only promoter _attribution_ exists. Field operations — the actual daily job of a promoter — do not.
**Depends on:** WP-12 (shell).
**Estimate:** 3–4 weeks.
**Status (2026-08-16): PARTIAL.** The own-scoped lead pipeline and secure conversion slice are complete. Promoters and sales partners have bilingual pagination, controlled source capture, duplicate-open-phone protection and audited `NEW → CONTACTED → LOST` transitions. A contacted lead can be registered in the partner app only after the present farmer supplies a backend-verified OTP; the backend derives identity fields from the owned lead, returns no farmer session tokens, and completes the existing single-primary attribution conversion. Already registered farmers can also be linked through the standalone conversion action. General territory assignment is complete: operations can assign an active shared territory without enabling Club operations, changes are audited and blocked while active Club farmers would be disrupted, and the bilingual partner app shows only the current organisation-scoped assignment. General farm/crop surveys are also complete for actively attributed converted farmers, with no Club dependency or precise-location collection. Visit logging is complete for owned leads and actively attributed farmers: records are append-only, organisation scoped and auditable, use controlled purposes, and support explicit one-time permission-aware location capture without background tracking. Evidence remains deferred to WP-08. Consented attendance, targets and training remain open.

### Build

**Schema:** `Territory` (pincodes/districts, assigned promoters), **`FarmerLead` foundation complete** (contact, controlled source, explicit status/timestamps/reason and assigned promoter/organisation), `CropSurvey` (farmer, crops, acreage, season, notes), **`PromoterVisit` complete except WP-08 evidence** (promoter organisation, exactly one farmer/lead target, controlled purpose, notes, timestamp and permission-aware location outcome), `AttendanceRecord` (promoter, check-in/out with geolocation — **only where authorised**), `PromoterTarget` (period, metric, target, achieved), `TrainingMaterial` (title, category, file, locale).

**Endpoints:** CRUD + list under `/promoters/territories`, `/promoters/leads`, `/promoters/surveys`, `/promoters/visits`, `/promoters/attendance`, `/promoters/targets`, `/promoters/training-materials`. All scoped to the promoter's own records except for ops/admin roles.

**App screens:** territory view, lead capture and pipeline, farmer onboarding (create a farmer user + profile on the farmer's behalf), crop/acreage survey, **assisted ordering** (place an order for a farmer with the promoter's attribution code attached — reuses the existing attribution API), visit logging with geotag, attendance check-in/out, daily targets dashboard, commission statement (existing finance APIs), payout statement (existing payouts API), training material library, complaint escalation (existing support API).

**Privacy note:** geotagged attendance is employee location tracking. `PRODUCT_REQUIREMENTS.md` says "where authorised" — get explicit written consent, make it opt-in, capture location only during an active check-in, and document it in `docs/SECURITY_AND_COMPLIANCE.md`. Do not track continuously in the background.

### Acceptance criteria

- A promoter captures a lead, converts it to a registered farmer, records a crop survey, places an assisted order that carries their attribution, and sees the resulting commission in their statement.
- Attribution rules from `AGENTS.md` §2.14 hold: only one primary attribution earns standard commission.
- Attendance is opt-in and only captured during check-in.

---

## WP-14 — Service marketplace

**Why:** `PRODUCT_REQUIREMENTS.md` §19, Phase 6. Entirely unbuilt. `OrderType.SERVICE_ORDER` and the `SERVICE_PROVIDER` role/org type exist as enum values with no implementation behind them.
**Depends on:** WP-12 (shell), WP-07 (payments), WP-08 (evidence files).
**Estimate:** 6–8 weeks. This is effectively a second marketplace.

### Critical constraint

`AGENTS.md` §3: **do not combine product inventory and service availability into the same database model.** Services use separate availability, pricing and lifecycle models. Do not try to reuse `DistributorOffer` or `ProductOrder`.

### Build

**Schema:**

```prisma
model ServiceProviderProfile   // org-linked; licences, equipment, experience, ratings aggregate
model ServiceCategory          // DRONE_SPRAYING, SOIL_TESTING, FARM_MACHINERY,
                               // SEED_TREATMENT, AGRONOMY_VISIT, HARVESTING, TRANSPORTATION
model ServiceListing           // provider's offering: category, description, pricing model
                               // (per acre / per hour / flat), price paise, min charge,
                               // status lifecycle mirroring DistributorOffer approval
model ServiceArea              // listing ↔ serviceable pincodes
model ServiceAvailabilitySlot  // date, start, end, capacity, booked count
model ServiceBooking           // farmer, listing, provider, address/farm location,
                               // scheduled slot, acreage, quoted/final amount paise,
                               // status (the §19 lifecycle), completion OTP hash+salt,
                               // idempotency key
model ServiceBookingEvidence   // BEFORE / AFTER / DOCUMENT, via StoredFile
model ServiceBookingStatusHistory
model ServiceReview            // farmer rating + comment, moderated
```

**Booking lifecycle** — exactly as specified in §19, no shortcuts:
`REQUESTED` → `QUOTED` → `ACCEPTED` → `SCHEDULED` → `PROVIDER_EN_ROUTE` → `IN_PROGRESS` → `COMPLETED` → `FARMER_CONFIRMED` → `CLOSED`, with `CANCELLED`, `DISPUTED` and `REFUNDED` as exits. Every transition writes status history and an audit record — same discipline as the product order state machine, which is a good template to copy.

**Endpoints:** provider profile and listing CRUD + approval review (mirror the offer review pattern), availability calendar management, public service discovery by pincode + category, farmer booking create (idempotent) / list / detail / cancel, provider accept/reject/quote/schedule/en-route/start/complete-with-OTP, farmer confirm, review submission.

**Finance:** service bookings need their own commission treatment. Extend `CommissionRule` with an applicability dimension for service categories, and add `SERVICE_COMMISSION` / `SERVICE_PROVIDER_PAYABLE` to `FinancialLedgerEntryType`. **Do not** reuse product commission rules blindly — service margins differ. Payouts flow through the existing `PayoutAccount` machinery.

**Partner app (service provider role):** profile, licences, equipment, service catalogue, pricing, serviceable areas, availability calendar, booking inbox with accept/reject, farmer contact + farm location, before-service evidence, completion evidence, acreage confirmation, completion OTP entry, ratings, earnings.

**Farmer app:** service browsing by category and pincode, provider detail with ratings, slot selection, booking request, quote acceptance, tracking, completion confirmation, review.

### Acceptance criteria

- A service provider is onboarded and approved, publishes an approved listing with availability, a farmer books a slot, the provider accepts and quotes, the farmer pays, the provider completes with evidence and OTP, the farmer confirms, commission and payable are calculated, and the farmer reviews — end to end.
- No product inventory model is touched by any service code path.
- Service commission is calculated by a service-specific rule.
- Full status history and audit on every transition.
- Integration test `test/integration/service-marketplace.spec.ts` covering the whole lifecycle plus cancellation and dispute paths.

---

---

# STAGE 5 — PRODUCTION READINESS

---

## WP-15 — GST, invoice PDFs and the allocation engine

**Why:** Three specific product gaps that block real commercial operation.
**Depends on:** WP-08 (storage for PDFs).
**Estimate:** 3–4 weeks.

### 15A — GST and tax modelling

`PRODUCT_REQUIREMENTS.md` §14 defers GST breakup, but **no invoice can legally issue in India without it.** Agricultural inputs span multiple GST slabs (many fertilisers 5%, pesticides 18%, some seeds exempt) — this is not a single-rate problem.

- Add to `ProductVariant`: `hsnCode`, `gstRateBps`.
- Add to `Organisation`/`DistributorProfile`: verified `gstin`, registered state code.
- Add to `FarmerAddress`: state code for place-of-supply determination.
- Invoice generation computes CGST + SGST (intra-state) or IGST (inter-state) **per line**, in paise, rounding per GST rules (round each line, then total — confirm with the accountant, not with intuition).
- Extend the `ProductInvoice` snapshot with the tax breakup and an official sequential invoice number **per distributor per financial year** (GST requires an unbroken series — use a DB sequence per distributor, not a random string; the current `generateSettlementNumber`-style approach is not compliant for invoices).
- Show tax-inclusive pricing to farmers and the breakup on the invoice.
- **Have a chartered accountant review this before go-live.** Do not ship a tax implementation on developer judgement alone.

### 15B — Invoice PDF generation

- A queue job (WP-04) renders the invoice snapshot to PDF and stores it via WP-08.
- Template with distributor legal name, GSTIN, address, farmer details, line items with HSN and tax breakup, totals in words, invoice number and date.
- `GET /orders/:orderId/invoice/pdf` returns a short-lived signed URL, permission-checked and audited.
- Farmer app download; portal download.
- Credit notes for refunds/returns follow the same pipeline (GST requires a credit note, not a deleted invoice).

### 15C — Distributor allocation engine

`PRODUCT_REQUIREMENTS.md` §10 specifies a ranked allocation that does not exist. Today checkout simply groups by the distributor of the offer the farmer picked, and **no allocation reason is recorded anywhere.**

Implement `src/checkout/allocation.service.ts`:

1. Exclude ineligible offers (unapproved, paused, archived, out of stock, non-serviceable pincode, suspended distributor).
2. Prefer available local inventory.
3. Prefer fewer child orders where commercially reasonable.
4. Consider delivery SLA.
5. Consider total payable amount.
6. Consider distributor operating status.
7. **Record the allocation reason** — add `allocationReason` (structured JSON: candidates considered, scores, chosen offer, rule version) to `ProductOrder`. This is explicitly required and is what makes allocation auditable and tunable.

Make the strategy pluggable and version it, so the ranking can change without rewriting checkout. Keep the current "farmer explicitly chose this offer" path as an override — respect an explicit farmer choice and record that as the reason.

### Acceptance criteria

- An invoice shows correct CGST/SGST or IGST per line for a mixed-slab cart, with correct place-of-supply.
- Invoice numbers are sequential and unbroken per distributor per financial year.
- A farmer downloads a correctly formatted PDF invoice from the app.
- A refund produces a credit note.
- Allocation records a structured, inspectable reason for every child order.
- CA sign-off on the tax calculation is documented.

---

## WP-16 — Infrastructure, observability and go-live

**Why:** `infrastructure/` contains three README placeholders. There is no deployment path at all.
**Depends on:** everything.
**Estimate:** 3–4 weeks, run partly in parallel with Stage 4.

### Build

1. **Containerisation.** Multi-stage `Dockerfile` for the API (build → prune → slim runtime, non-root user), one for the worker (same image, different command), one for `business-web`. Health checks in the image.
2. **Environments.** `local`, `staging`, `production`. Managed Postgres with automated backups and PITR; managed Redis; object storage. Pick a host the team can actually operate (AWS/GCP or a simpler PaaS — for a pilot, simpler is better).
3. **Deployment pipeline.** GitHub Actions: on merge to `main` → build images → run `prisma migrate deploy` → deploy API + worker + web → smoke test → automatic rollback on failure. **Migrations must run as a separate, gated step** — never on app boot.
4. **Secrets management.** AWS Secrets Manager / GCP Secret Manager / Doppler. No secrets in env files in production. Document rotation.
5. **Observability.**
   - Error tracking: Sentry on API, worker, web and both Flutter apps.
   - Metrics: request rate, p50/p95/p99 latency per route, error rate, queue depth, job failure rate, DB pool saturation.
   - Structured logs shipped to a searchable store, with the existing correlation/request IDs preserved end to end.
   - Alerts: API 5xx rate, p95 latency breaching the §24 targets, queue depth, DLQ non-empty, failed payment webhooks, DB connections, disk.
   - Uptime checks on `/health` and `/health/ready`.
6. **Performance validation** against `PRODUCT_REQUIREMENTS.md` §24: reads < 500 ms at pilot load, search < 2 s. Load-test discovery, cart and checkout. Add DB indexes where the query plans demand them — pay particular attention to the marketplace discovery query (pincode + status + availability joins) and the derived-availability computation over `InventoryMovement`, which grows unbounded and will be the first thing to slow down. Consider a materialised availability projection if profiling justifies it.
7. **Security review.** Dependency audit in CI; rate limiting beyond the auth endpoints (`ThrottlerGuard` currently only covers OTP); CORS lockdown; security headers; SQL-injection review (Prisma covers most, check any raw queries); PII inventory and encryption at rest; penetration test before pilot; verify no secret is in git history.
8. **Data protection.** Retention policy, farmer data export/deletion process (DPDP Act 2023 applies to Indian personal data), consent capture, privacy policy and terms.
9. **Backups.** Automated, and a **restore drill actually performed** — an untested backup is not a backup.
10. **Runbooks** in `docs/`: deploy, rollback, restore, incident response, on-call, common failure modes.
11. **Pilot seed data.** Real pilot district pincodes, real distributors, real approved catalogue — separate from `seed-demo.ts`, which must stay dev-only (it already refuses to run with `NODE_ENV=production` — keep that).
12. **Accessibility audit** (§24) on both apps and the portal.
13. **Go-live checklist:** all mock provider flags flipped and verified (`SMS_PROVIDER`, `WHATSAPP_PROVIDER`, `EMAIL_PROVIDER`, `PAYMENT_PROVIDER`, `TALLY_PROVIDER`, `STORAGE_PROVIDER`, `AUTH_MODE`); `mockOtpCode` confirmed absent from responses; the delivery-OTP mock exposure confirmed removed; `BUSINESS_WEB_MOCK_*` no longer used; the placeholder business values in `.env.example` (`RETURN_WINDOW_DAYS`, `DEFAULT_MARKETPLACE_COMMISSION_BPS`, `DEFAULT_PROMOTER_COMMISSION_BPS`, `SUPPORT_TICKET_DEFAULT_SLA_HOURS`) replaced with business-approved numbers.

### Acceptance criteria

- A merge to `main` deploys to staging automatically with migrations gated and rollback tested.
- Production secrets live in a secret manager.
- Alerts fire on a deliberately induced failure.
- Load test meets the §24 latency targets.
- A database restore has been performed successfully in a drill.
- The go-live checklist is complete and signed off, with **zero mock providers active in production**.

---

---

# Summary of remaining effort

| Stage                      | Work packages | Estimate (1 developer) |
| -------------------------- | ------------- | ---------------------- |
| 1 — Stabilise              | WP-01 … WP-03 | 2–3 weeks              |
| 2 — MVP holes              | WP-04 … WP-08 | 8–10 weeks             |
| 3 — Portal + farmer app    | WP-09 … WP-11 | 11–14 weeks            |
| 4 — Partner app + services | WP-12 … WP-14 | 13–17 weeks            |
| 5 — Production readiness   | WP-15, WP-16  | 6–8 weeks              |
| **Total**                  |               | **≈ 40–52 weeks solo** |

With a team of three (backend, frontend/mobile, shared) running stages 3 and 4 in parallel: **≈ 4–5 months** to a pilot-ready product.

## If the budget only allows a subset

Ship a **product-only pilot** and defer the service marketplace. Minimum viable path:

**WP-01, WP-02, WP-03, WP-04, WP-05, WP-06, WP-07, WP-08, WP-09, WP-10, WP-11, WP-15, WP-16** — skip WP-12, WP-13, WP-14.

That gives farmers a complete product purchase → delivery → return → refund journey, gives ops and finance a working portal, and is deployable. Delivery partners would be operated through the business portal instead of a dedicated app (the backend fully supports this today), and promoters through assisted ordering in the portal. Roughly **26–34 weeks solo**, or **3 months with a team of three**.
