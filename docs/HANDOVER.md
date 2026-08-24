# Vardhnam Agrotech Marketplace — Developer Handover

**Document status:** Current handover with a preserved historical snapshot
**Current through:** 2026-08-23
**Repository state:** branch `master`, committed through `c3c4ac6`, with later portal and documentation work still local
**Audience:** The developer(s) taking over this project

> Read this document first. Then read, in order:
>
> 1. `AGENTS.md` — permanent business truths and engineering rules. **These are not negotiable without a written product decision.**
> 2. `docs/PRODUCT_REQUIREMENTS.md` — the full product spec.
> 3. `docs/REMAINING_IMPLEMENTATION_PLAN.md` — the step-by-step build plan for everything that is left.
> 4. `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/BUSINESS_RULES.md`, `docs/ARCHITECTURE.md`.

## Current handover snapshot — 2026-08-23

This section supersedes the August 7 completion estimates and work ordering retained in sections 6–10. Use `docs/REMAINING_IMPLEMENTATION_PLAN.md` for package-level status and acceptance criteria; use this section for the concise operational picture.

| Area                                      | Current state                                                                                                                                                                                                                                                                                                        | Material remainder                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product marketplace backend               | Mature internal-test implementation covering identity/RBAC, catalogue, distributor offers and batch inventory, farmer commerce, distributor-split orders, fulfilment/delivery, finance ledger and settlements, returns/refunds/disputes, durable files, background jobs, GST snapshots and invoice/credit-note PDFs. | Real payment/refund provider, real communications providers, CA approval of GST classifications/templates, and the deferred distributor allocation engine.                                                    |
| Kisan Club                                | KC-01 through KC-12 are implemented across backend, farmer app, partner app and portal, including membership, farms/crops, promoter assignment, catalogue/benefits, assisted purchase, coordination, advisories and privacy-safe intelligence.                                                                       | Approved terms/privacy destinations, future provider-backed Crop Doctor flow, weather integration and selected test-state expansion.                                                                          |
| Business portal                           | Forty-seven page routes cover the permission-scoped dashboard and operational/admin workflows. Payouts, notifications, Tally, organisations, users, disputes, jobs and invoice/credit-note downloads are present. Navigation and theme consolidation continue as local WP-09r/WP-18 quality work.                    | Portal Hindi localisation, final visual/device review and remaining quality consolidation.                                                                                                                    |
| Farmer app                                | Functional bilingual internal-test app with OTP registration/login, profile/addresses, marketplace, cart/checkout/mock payment, orders/invoices, returns, support, notifications, farms/crops, Kisan Club and the approved Crop Doctor shell. Internal Android APK exists under `artifacts/internal-testing`.        | Real SMS/payment providers, real-device and iOS verification, approved legal destinations, reviews/service booking if kept in pilot scope, and future provider-backed features only after approved contracts. |
| Partner app                               | Functional bilingual internal-test app for promoter/sales-partner Club and field workflows plus delivery availability, assignments, QR pickup, OTP delivery, failure/retry, return pickup, earnings and payout account flows. Internal Android APK exists under `artifacts/internal-testing`.                        | Shared KYC submission, authorised photo proof, push registration, COD only if approved, and service-provider workflows after WP-14.                                                                           |
| Service marketplace                       | Not implemented beyond role/order-type enum foundations.                                                                                                                                                                                                                                                             | WP-14 remains a separate deferred domain; do not reuse product inventory or product-order models.                                                                                                             |
| Infrastructure                            | API/worker/migrator container builds, readiness, security hardening and Railway internal testing are available. The Railway environment is demo-only and currently has no deployed background worker.                                                                                                                | Hosting/registry/orchestration decision, cloud object storage, secret manager, TLS/ingress, shared rate-limit store, observability, backups and restore drill.                                                |
| Contracts and shared frontend foundations | Tally, dashboards and promoter visits are backfilled in `API_CONTRACTS.md`; OpenAPI and generated TypeScript path/schema types are committed and CI drift-checked; the portal Admin Jobs, Notifications, Tally, Dashboard, Support, Payout, Organisation list/detail and User list/detail workflows use the generated transport; the portal consumes the shared design-token package. | Incrementally migrate remaining TypeScript consumers, decide the Dart generation boundary, retire duplicated hand-written models, and split the oversized checkout service. |

The project is suitable for controlled internal testing with mock providers and demo data. It is **not production-ready**. The main non-code blockers are the payment merchant account, SMS/WhatsApp BSP, cloud/storage decision, chartered-accountant GST review, approved commercial values and pilot catalogue/participants.

Do not rerun demo seed data during a shared test session, deploy local changes, connect real providers, or process real personal/financial data without explicit approval. Follow `docs/INTERNAL_TESTING_GUIDE.md` for the three-platform test sequence.

### Progress after the original handover snapshot (2026-08-07)

This is a chronological delivery log. Later bullets and the current snapshot above supersede earlier “open” statements within the list.

- The business portal now uses real password login and organisation selection. Access and rotating refresh tokens are stored in httpOnly, same-site cookies; browser storage and `BUSINESS_WEB_MOCK_*` identity variables are no longer used.
- Next.js middleware redirects unauthenticated requests, verifies access tokens with the backend, rotates near-expiry access tokens, and enforces permission-to-route mappings before rendering. Navigation is filtered server-side from the same permission claims; the API still repeats authoritative permission and ownership checks.
- Finance portal surfaces now cover commission rules, commission entries, eligible finalisation, explicit reversal, the append-only ledger, settlement creation and settlement detail. All amounts and settlement composition come from the backend.
- Support portal surfaces now cover the operational queue, ticket detail and the backend's assign/wait/resume/escalate/resolve/close/reopen state machine.
- Focused portal access-policy tests were added. The business portal passes its lint, type-check, test and production-build checks.
- WP-09 is now approximately 98% complete: the live dashboard, payouts, notification log, Tally, organisation/user administration, reusable pagination, disputes, jobs and document downloads are implemented. Portal Hindi and final quality consolidation remain open.
- The farmer app now uses Riverpod application state, named `go_router` routes and generated English/Hindi localisation with device-aware, persisted runtime language selection.
- Farmer discovery now has debounced search, authoritative pincode-scoped category/brand/crop filters, pull-to-refresh and duplicate-safe backend pagination. Each page uses an exact bounded cache key and is shown offline only after a failed live request with stale-data warnings. The public filter-options endpoint returns only discoverable approved products backed by sellable stock.
- Farmer OTP self-registration is implemented through dedicated request/verify endpoints and an isolated OTP purpose. Verified registration atomically creates the user/profile/active farmer membership in `vardhnam-farmer-context` and audits each security-sensitive creation. The farmer app provides bilingual OTP UI, farmer-only multiple-context selection, secure token persistence, serialized access-token refresh/retry, logout cleanup, public browsing and guarded private routes. Selection tokens are bounded to the exact eligible membership IDs and cannot be reused to select a hidden business membership. The authenticated farmer profile reads/writes the existing profile API, delivery addresses support farmer-owned list/create/edit/default selection, and structured farms/crops/acreage are implemented. Consent-based location assistance, real SMS and device/API testing remain open.
- Farmer Android release packaging no longer falls back to the debug signing key. Release tasks require an ignored local Play upload-key configuration and fail before compilation with actionable guidance when it or the keystore is missing; debug/internal builds remain available. No real key or production bundle is stored in the repository. Follow `docs/PLAY_STORE_RELEASE_CHECKLIST.md` for the remaining account, provider, legal, infrastructure, listing and staged-release gates.
- The Farmer Account screen now has bilingual Privacy Policy, Terms and account-deletion entries backed by validated build-time public HTTPS destinations. Missing, local, insecure and placeholder URLs fail closed with an honest message. Approved legal pages and the actual deletion-request/data-deletion workflow remain external release blockers; the app entry point alone does not satisfy them.
- Farmer checkout now uses the backend mock-payment intent/confirmation APIs and re-reads authoritative payment and checkout state. Success, deliberate failure/retry and eligible checkout cancellation are available with persisted operation-specific idempotency keys, disabled repeat taps and an explicit no-real-money development warning.
- Farmer cart lines are grouped by the backend-returned distributor organisation ID with an explicit separate-order/invoice boundary. Cart snapshots refresh on foreground resume, and checkout review performs another backend cart read before order creation; no seller totals are calculated on-device.
- Farmer order history now lists paginated seller-specific child orders with exact status filters. Detail screens show seller/address/item/batch snapshots, chronological status history, dispatch/delivery identifiers and generated distributor invoice data. Eligible per-child cancellation uses a persisted order-specific idempotency key. List/detail refresh on foreground resume; active detail polls conservatively every 30 seconds and terminal states stop polling. Invoice PDF download remains gated on an authorised backend endpoint.
- Farmer support now provides bilingual farmer-owned ticket list/create/detail screens, optional owned-order linking, status/SLA/resolution display, foreground refresh and owner-only reopen for resolved/closed tickets. The backend adds `support-tickets:reopen:own` plus a separate `/reopen-own` endpoint with service-level ownership enforcement. Attachments and conversation replies remain visibly unavailable until authorised upload and ticket-message contracts exist.
- Farmer returns now include backend-owned eligibility and configured-window validation, idempotent request creation/cancellation, item/quantity and paise snapshots, operational approval through inspection, original-batch inventory decisions and mock refund completion. The bilingual app provides request submission, paginated tracking, timeline refresh, approved amount, inspection note and refund status/reference. The HTTP MVP acceptance spec now passes against local PostgreSQL through original-batch restock, backend-priced refund, farmer-owned status, immutable ledger entries, commission reversal and localized notification assertions. Evidence storage, disputes, pickup assignments and a real refund provider remain open.
- Mock-payment outcomes plus farmer-visible seller-order fulfilment, farmer-raised support-ticket and return/refund lifecycle transitions now write audited, locale-aware English/Hindi in-app notifications inside the same transaction. Idempotent replays do not duplicate events, and the farmer app allowlists `ProductOrder`/`SupportTicket`/`ReturnRequest` links into owner-checked detail APIs. Checkout-level `ProductCheckout` payment events remain informational because one checkout can contain multiple seller child orders. Device tokens, FCM/APNs and event producers outside these lifecycles remain open.
- Farmer discovery, cart, checkout, order, support and notification screens now share transport-error presentation: connection failures and timeouts are classified centrally, shown in the selected English/Hindi locale and never expose unexpected runtime exception details. Discovery retains at most five exact pincode/filter results for 24 hours, uses them only after a failed live request and clearly labels their age and stale price/stock risk; product detail and commerce mutations remain live-only. Primary read flows use shared semantic list/detail skeletons. Automated accessibility checks cover 48dp Android targets, text contrast, explicit login keyboard traversal/live error announcements, and English/Hindi at 200% text across dashboard, login, discovery, orders, returns, support and notifications. The audit fixed narrow Hindi marketplace/status-filter dropdown overflow and misleading/duplicated semantics. Real-device TalkBack/VoiceOver and manual accessibility audits remain open because no Android device or AVD is available in the current environment.
- The return/refund vertical slice is implemented through a development provider: a farmer can request and track a return; authorised operations can approve, pick up, receive, inspect by original reservation and initiate/confirm a backend-priced mock refund. Inventory, refund ledger, commission reversal, histories and audit are transactional and append-only where required. Evidence, disputes, asynchronous execution and real-provider settlement remain open; submission and receipt never restock inventory.
- Kisan Club farm management in the farmer app now supports farmer-owned farm and active crop-cycle create/edit flows, activity diaries and explicit harvest completion. Harvested and abandoned crop cycles remain read-only historical records; the backend remains authoritative for ownership, validation and audit.
- KC-08 is complete: the bilingual farmer Club module covers membership/join and resumable profile completion, Club catalogue and existing seller-order commerce, farms/crops/diary/harvest, assigned-promoter visibility, advisories, one-time benefit-token issuance, and duplicate-safe paginated token history with exact backend status filtering.
- KC-10A is complete: the partner app gives promoters and sales partners a role-gated Kisan Club workspace using only backend-scoped assigned-farmer list/detail projections. It displays allowlisted locality/farm/crop data and redeems one-time benefit tokens with stable idempotency into backend-revalidated pending-payment assisted checkouts.
- KC-10B is complete: promoters and sales partners have an own-scope Club fulfilment inbox/detail/history with exact backend status filtering and duplicate-safe pagination. UI actions mirror promoter-valid backend transitions, decline/failure require reasons, operations-only cancel/reassign are absent, and every mutation is followed by an authoritative read. Seller-order and delivery states remain separate.
- KC-10C is complete: promoters and sales partners can record a farm-only or farm-plus-current-crop survey for an actively assigned farmer using controlled crop references and backend-aligned validation. The audited backend remains authoritative, farmer detail is refreshed after save, and the mobile payload omits precise coordinates until explicit farmer consent is supported.
- KC-10D completes the partner Club module: the app presents recipient-scoped earnings with exact status filters, duplicate-safe pagination and backend-provided provisional/final/reversed totals. The subsequent shared WP-12 flow makes the statement and own payout-account create/edit screen available to every supported partner role, requires full account-number re-entry, and renders only the API mask after submission. Provisional earnings remain clearly non-payable, no commission is calculated on-device, and the default promoter rate is still zero pending business approval.
- New Kisan Club members now enter a bilingual, resumable two-step farm-profile completion flow. Farm progress is re-read from the backend, the membership remains `PENDING_PROFILE` until its first crop cycle is created, and returning pending members can resume from the Club status action without losing access to permitted Club catalogue browsing.
- The KC-09 advisory vertical slice is complete: the business portal provides permission-filtered bilingual rule authoring and independent review; deterministic generation creates consent-gated, localised farmer events and in-app notifications; and the farmer app supports owner-scoped list/detail/read/dismiss flows. Focused HTTP/database acceptance coverage verifies approval separation, matching, deduplication, localisation, consent and farmer isolation against a dedicated PostgreSQL test database.
- KC-11 portal work has started with Kisan Club member operations. A server-permission-filtered queue supports member-number/name search, status filters and backend pagination; member detail shows locality, terms and independent consent timestamps; and authorised managers can suspend with explicit confirmation and a required audited reason. The API now has a staff-only UUID detail read, and focused integration coverage confirms farmers cannot access it.
- The KC-11 Club Network portal surface now lists, filters, creates and updates promoter territories and lists/configures Club promoter profiles, including assignment capacity and intake status. Server permissions for territory and profile management remain independent, and all eligibility decisions stay in the API. Dedicated-database coverage verifies filtered reads and prevents territory inactivation while active farmer assignments remain.
- The KC-11 Club Commercial portal surface now manages Vardhnam-only catalogue programmes and platform-funded benefit rules through separate programme/benefit permissions. Operational inputs are explicitly UTC, paise or basis points; activation and transition rules stay in the backend; and financial/eligibility fields become read-only in the portal after redemption while the API independently rejects mutations. Dedicated-database coverage verifies filtered programme/benefit reads, activation and third-party product rejection.
- KC-11 is complete with the Club Fulfilment portal queue and detail workspace. Assigned promoters are restricted to their own coordination records; read-any staff can filter the complete queue; manage-any operations can cancel or explicitly reassign eligible records. The UI links to the separate seller order and states that coordination completion is neither product delivery proof nor an order-state mutation. Dedicated-database HTTP coverage verifies own-scope isolation, transition guards, history creation and an unchanged distributor `ProductOrderStatus`.
- KC-12 is complete with permission-protected Club Intelligence APIs and a portal workspace. Crop reporting aggregates registered acreage by crop/district, season, lifecycle status and sowing month while excluding suspended/inactive/closed memberships and all farmer/precise-location identifiers. Promoter reporting uses live active assignment counts and labels fulfilment outcomes as current-holder operational snapshots, not commission or historical attribution. Dedicated-database coverage verifies filter behavior, exact acreage, privacy scope, basis-point completion rates and permission denial. Demand forecasting remains explicitly deferred.
- WP-12 delivery work now includes audited, organisation-scoped online/offline availability. Missing profiles are offline, only online partners in an active delivery organisation can receive new assignments, and the bilingual app exposes the backend-owned toggle. Delivery partners receive API-enforced own-assignment queues/details, explicitly accept or reason-reject pending delivery and return-pickup work, verify seller-issued package QR pickup, open navigation/calling handoffs, mark verified packages out-for-delivery and complete with the backend-verified farmer OTP. Completion records foreground, permission-aware location proof, or a durable denied/unavailable outcome without blocking OTP delivery. Operations can reassign rejected work to a different online partner with a fresh OTP. Assigned partners can record controlled failed-delivery reasons with a backend-validated retry time; due retries preserve the failure trail and issue a fresh hashed OTP. Return collection atomically advances the return and seller child order with histories, audit and farmer notification. Photo proof remains open.
- WP-13 has started with promoter farmer leads. Promoters and sales partners capture consent-noticed contacts in a bilingual own-scoped pipeline, while operations receives explicit any-scope permissions. Phone numbers are normalized, duplicate open own leads are rejected, audits mask phone values and generic updates allow only `NEW → CONTACTED → LOST`; conversion remains reserved for a future transactional farmer-onboarding flow.
- **WP-04 is complete (2026-08-17).** Background jobs run on BullMQ, consumed by a separate worker process (`npm run start:worker`); the API enqueues and never consumes, so request latency is independent of job load. Five queues are declared — `scheduled-maintenance` has handlers, while `notifications`, `payment-webhooks`, `tally-sync` and `documents` are reserved for WP-06/07/08 and appear empty in admin metrics. Payloads carry the enqueueing request's correlation ID. Exhausted jobs move to a `<queue>-dead-letter` queue retaining payload, reason, stack and attempt count, and only replay through an audited `ADMIN`-only endpoint. Commission finalisation, batch expiry, OTP cleanup and refresh-token pruning now run on schedule rather than waiting for a manual API call. Scheduled changes are audited with a **null actor** and the job named in `reason` rather than through a synthetic system user — any audit UI must render that as "system". See `docs/DECISIONS/0010-background-job-architecture.md`.
- **The integration suite is self-configuring as of 2026-08-17.** It needs only `TEST_DATABASE_URL`; it sets `AUTH_MODE` itself and refuses to run against a database whose name does not contain `test`. Two defects were fixed at the same time: the auth spec required the opposite `AUTH_MODE` to every other spec (so the suite could never pass in one run), and migration-seeded crop reference data was destroyed by the test reset and never restored. **Reference data added in a migration must also be added to `test/integration/helpers/seed-reference-data.ts`,** or the specs that read it will fail.

- **WP-08 is complete (2026-08-17).** Files now have somewhere real to live. A `StoredFile` row is the authoritative record of what an object is, who owns it and whether it may be read; bytes go directly between client and storage and never through the API. Uploads are validated **twice** — at URL issue and again against the object storage actually holds, because a presigned URL can be used to write anything. A file is `PENDING_SCAN` and undownloadable until a scan clears it, enforced by a database `CHECK` constraint as well as by code. Downloads are authorised in the API against a never-public bucket, and `KYC_DOCUMENT`/`INVOICE_PDF` audit every download URL issued. Only the `local` provider exists — it faithfully mimics presigned-URL semantics, so switching to a cloud bucket cannot change client behaviour — and the factory throws rather than falling back, so it cannot be deployed by accident. `VIRUS_SCANNER=mock` recognises only the EICAR test string and **is not virus scanning**. See `docs/DECISIONS/0011-file-and-document-storage.md`.
- **Extension point for WP-07:** job handlers are contributed through `JobHandlerRegistry` — a feature module registers its handler during `onModuleInit` and `JobRunnerService` collects them at bootstrap. Register a handler for the already-declared `payment-webhooks` queue; do not modify `JobsModule`.
- **WP-06 is complete (2026-08-18).** Notifications can now leave the platform. Each channel has a `NotificationProvider`; delivery runs on the `notifications` queue with WP-04 retry and dead-lettering. An event that goes out on two channels creates two `Notification` rows, so a failed SMS cannot make the in-app copy look undelivered. Dispatch is a **sweep**, not a post-commit call at each producer: rows are created inside the event's transaction, and a job every minute queues `PENDING` rows older than five seconds — correct after a commit, a crash or a restart, with none of the thirty-plus producers able to forget. **OTPs deliberately bypass all of this** and are never `Notification` rows, because such a row is readable through `GET /notifications/me` and persisting the code would defeat the second factor; they are sent synchronously through the SMS transport and only their hash is stored. Recipients can disable advisory and marketing categories per channel but never transactional ones, and the class is re-evaluated at send time so a stale preference cannot silence a reclassified category. **Every provider is still `mock`, identifiable by a `MOCK-` provider reference.** See `docs/DECISIONS/0012-notification-delivery.md`.
- **WP-07 is partial (2026-08-18).** The provider-neutral payment foundation now verifies raw-body HMAC webhooks, stores and deduplicates verified provider events, settles them asynchronously, requires an exact provider-reported paise amount, reports reconciliation mismatches and routes refunds through a provider interface. A real gateway adapter and asynchronous real-refund lifecycle remain blocked on the merchant-provider decision and sandbox credentials.

> **Note on §9 below:** the completion table in that section is a 2026-08-07 snapshot and is now substantially out of date. `docs/REMAINING_IMPLEMENTATION_PLAN.md` §6 carries the current, verified figures.

---

## Table of Contents

1. [Current handover snapshot](#current-handover-snapshot--2026-08-23)
2. [What this product is](#1-what-this-product-is)
3. [Repository map](#2-repository-map)
4. [Getting it running in 15 minutes](#3-getting-it-running-in-15-minutes)
5. [How the code is organised](#4-how-the-code-is-organised-patterns-you-must-follow)
6. [Completed foundations](#5-what-is-complete)
7. [Historical August 7 snapshot](#6-historical-partial-state-snapshot-2026-08-07-superseded)
8. [Definition of Done](#11-definition-of-done-for-every-task)

---

## 1. What this product is

Vardhnam Agrotech is a **multi-sided B2B2C managed agriculture marketplace**. It is _not_ a single-seller e-commerce app. Get this model wrong and every downstream decision will be wrong:

| Party                        | Role                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Farmer**                   | The buyer. Uses the farmer mobile app.                                                                                         |
| **Agriculture company**      | Brand owner. Owns the **master catalogue**. Is _not_ the seller.                                                               |
| **Distributor**              | **Seller of record.** Owns stock, warehouses, batches, offers, prices, serviceable pincodes. Issues the invoice to the farmer. |
| **Promoter / sales partner** | Assists farmers, earns attribution-based commission. The order is still farmer↔distributor.                                    |
| **Service provider**         | Sells _services_ (drone spraying, soil testing, etc.) — a **separate order type**, not a product order.                        |
| **Delivery partner**         | Executes deliveries, earns delivery payouts.                                                                                   |
| **Vardhnam**                 | Marketplace operator: approvals, allocation, commission, settlement, support, ops.                                             |

**The 20 permanent business truths are in `AGENTS.md` section 2.** The five that break things most often if ignored:

- The **distributor** is the seller of record and issues the invoice — not Vardhnam, not the company.
- One farmer checkout can create **multiple child product orders**, one per distributor, each with its own invoice and its own fulfilment lifecycle.
- **All money is calculated on the backend, in integer paise.** Never on the frontend. Never floating point.
- Commission is **finalised only after delivery + the return/dispute window closes**.
- Financial records, invoices, settlements and audit logs are **never physically deleted**.

---

## 2. Repository map

```
vardhnam agro app/
├── apps/
│   ├── marketplace-api/        NestJS + Prisma + PostgreSQL + Redis  ← ~95% of the value is here
│   │   ├── prisma/
│   │   │   ├── schema.prisma           1,488 lines, 60+ models/enums
│   │   │   ├── migrations/             22 migrations, all applied in order
│   │   │   ├── seed.ts                 permissions + one mock SUPER_ADMIN
│   │   │   └── seed-demo.ts            full idempotent demo dataset (use this!)
│   │   ├── src/
│   │   │   ├── access/     RBAC permission codes + role→permission map
│   │   │   ├── audit/      append-only audit log service
│   │   │   ├── auth/       OTP challenge, JWT access+refresh, guards
│   │   │   ├── cart/ catalogue/ checkout/ farmers/ inventory/ marketplace/
│   │   │   ├── offers/ onboarding/ organisations/ identity/ payments/
│   │   │   ├── finance/    commission rules, entries, ledger, settlements
│   │   │   ├── payouts/    payout accounts + partner statements
│   │   │   ├── promoters/  promoter attribution
│   │   │   ├── support/    support ticket lifecycle
│   │   │   ├── tally/      accounting sync abstraction (mock)
│   │   │   ├── notifications/ notification abstraction (mock)
│   │   │   ├── dashboards/ permission-scoped operational counts
│   │   │   └── common/     error envelope, filters, interceptors, logger
│   │   └── test/
│   │       ├── *.spec.ts               unit tests (no DB)
│   │       └── integration/*.spec.ts   HTTP+DB tests (need Postgres+Redis)
│   ├── business-web/           Next.js App Router portal  ← ~40% built
│   ├── farmer-mobile/          Flutter  ← ~35% built (browse/detail/cart/checkout/profile/addresses)
│   └── partner-mobile/         Flutter  ← ~2% built (static role tiles only)
├── packages/
│   ├── shared-types/           shared enums/types
│   ├── validation/             shared validation constants
│   ├── api-client/             HAND-WRITTEN typed client (stale — see §8)
│   └── design-tokens/          UI tokens
├── docs/                       specs + this handover + the plan
├── infrastructure/             README placeholders ONLY — no real IaC yet
├── scripts/phase0.test.mjs     scaffold smoke test
├── .github/workflows/ci.yml    lint + typecheck + test + build
└── docker-compose.yml          postgres + redis for local dev
```

---

## 3. Getting it running in 15 minutes

**Prerequisites:** Node.js ≥ 22.13, npm ≥ 10, Docker Desktop, Flutter SDK (mobile only).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d postgres redis
```

```bash
npm run prisma:generate && npm run prisma:migrate && npm run seed && npm run seed:demo
```

`npm run seed:demo` is the single most useful command in this repo. It creates, idempotently: an approved company + distributor with onboarding profiles and approved KYC, a brand, an approved product with two variants, a warehouse, two stocked batches, two approved offers, a farmer with a default address, an operations manager, a promoter and a delivery partner. **It prints the mock-auth headers for every demo role when it finishes.** Demo pincode is `302001`. It refuses to run with `NODE_ENV=production`.

Run the API and the portal:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

- API: `http://localhost:3001/api/v1/health` and `/health/ready`
- OpenAPI/Swagger: `http://localhost:3001/api/docs`
- Portal: `http://localhost:3000`

Quality gates (all must pass before any commit):

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Integration tests (need Postgres + Redis up and `DATABASE_URL`/`REDIS_URL` set):

```bash
npm --workspace @vardhnam/marketplace-api run test:integration
```

**The single best regression check** is `test/integration/mvp-acceptance.spec.ts` — it drives the entire acceptance scenario from `PRODUCT_REQUIREMENTS.md` §28 through the real HTTP API: approve company → approve distributor → submit & approve product → warehouse & batches → offer → farmer discovery → cart → checkout → mock payment → reservation → distributor accept/pack → invoice → dispatch → delivery OTP → delivered → commission + settlement. If you break something structural, this test tells you.

---

## 4. How the code is organised (patterns you must follow)

Copy an existing module rather than inventing a new shape. `src/support/` and `src/notifications/` are the newest and cleanest examples of the full pattern.

**Module layout**

```
src/<domain>/
  <domain>.module.ts       imports PrismaModule, AuditModule, AccessModule
  <domain>.controller.ts   routing + DTO binding ONLY, no business logic
  <domain>.service.ts      all business logic, all Prisma access
  dto/*.dto.ts             class-validator DTOs, one file per request shape
```

**Non-negotiable conventions already established in the codebase:**

| Concern        | Rule                                                                                                                                            | Where to look                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Auth           | `AUTH_MODE=mock` uses header-based mock identity; real mode uses JWT bearer. Both flow through `CurrentUser`.                                   | `src/auth/mock-auth.guard.ts`, `src/auth/jwt-token.service.ts` |
| Authorisation  | Permission codes in `src/access/permission-codes.ts` mapped per `PlatformRole`. Guards enforce; services re-check ownership (`:own` vs `:any`). | `src/access/`, `test/permissions.guard.spec.ts`                |
| Response shape | Every success is `{ data, requestId }`; every error is `{ error: { code, message, statusCode, requestId, timestamp, details? } }`.              | `src/common/errors/`, `src/common/filters/`                    |
| Error codes    | Machine-readable enum. Never throw a bare string.                                                                                               | `src/common/errors/api-error-codes.ts`                         |
| Money          | Integer **paise** only. Never float. Never compute on a client.                                                                                 | `src/finance/`, `src/checkout/`                                |
| Time           | UTC everywhere.                                                                                                                                 |
| Audit          | Every state change calls `AuditService.record(...)` **inside the same Prisma transaction**.                                                     | `src/audit/audit.service.ts`                                   |
| Idempotency    | Checkout, payment and cancellation require an `Idempotency-Key` header backed by the `IdempotencyRecord` model.                                 | `src/checkout/`, `src/payments/`                               |
| Inventory      | **Append-only** `InventoryMovement` rows. Availability is _derived_, never a mutable counter.                                                   | `src/inventory/`                                               |
| Transactions   | Inventory reservation, order creation and any financial ledger write must be in `prisma.$transaction`.                                          | `src/checkout/checkout.service.ts`                             |
| Deletes        | Financial/invoice/settlement/audit rows are never hard-deleted. Use status transitions.                                                         |
| Types          | Strict TypeScript. `any` is banned.                                                                                                             |

**Business-web pattern:** Next.js App Router server components fetch through `src/lib/marketplace-api.ts` (server-side only, injects mock-auth headers from env). Mutations are server actions in `actions.ts` next to the page. UI copy lives in `src/content/portal-copy.ts` — do not hardcode user-facing strings in components.

**Flutter pattern:** public marketplace calls live in `lib/src/marketplace/marketplace_api.dart`; protected calls use `lib/src/network/authenticated_api_client.dart`; screens live in `lib/src/screens/`; and user-facing strings use generated English/Hindi ARB localisation under `lib/l10n/`.

---

## 5. What is COMPLETE

Everything in this section is implemented on the backend, covered by tests, and exercised by the demo seed. "Complete" here means _complete for the pilot MVP_, still with mock external providers.

### Phase 0 — Foundation ✅

Monorepo + npm workspaces, NestJS skeleton, Next.js skeleton, two Flutter skeletons, Prisma, Docker Compose (Postgres + Redis), env validation with a Zod schema, structured logging with correlation/request IDs, global validation pipe, standard success/error envelopes, OpenAPI, Jest unit + integration setup, ESLint + Prettier + strict tsconfig, GitHub Actions CI, `.env.example`, seed framework, audit-log infrastructure.

### Phase 1 — Identity, Organisations, Access, Onboarding ✅

- Users, organisations, memberships; a user may belong to several organisations with different roles.
- 15 platform roles (`FARMER` … `SUPER_ADMIN`), permission table, role→permission mapping, role guard + permission guard, resource-level ownership checks.
- Company and distributor onboarding profiles; KYC **document metadata** lifecycle with reviewer decisions and audit trail.
- Derived approval queue API; organisation approve/reject with audit.
- Business portal: onboarding queue, company/distributor detail views, KYC review actions, organisation approve/reject, audit log viewer.
- **Phase 1D authentication (this is real, not mock):** `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/login`, `/auth/select-organisation`, `/auth/refresh`, `/auth/logout`. OTP challenges are hashed and expiring, refresh tokens are persisted and rotatable, access tokens are JWT, rate limiting via `ThrottlerGuard` on the OTP endpoints. **The OTP _delivery channel_ is still mock** — see §6.

### Phase 2 — Catalogue, Inventory, Offers, Discovery ✅

- Company-owned brands, master products, variants (pack size, unit, compliance fields), product document metadata.
- Catalogue submit → review → approve/reject with full audit; reviewer queues and portal review screens.
- Distributor warehouses; batches with manufacturing/expiry/germination data and blocked/expired status.
- **Append-only inventory movements** (`OPENING_STOCK`, `STOCK_RECEIVED`, `MANUAL_INCREASE`, `MANUAL_DECREASE`, `DAMAGE_WRITE_OFF`, `RESERVED_FOR_ORDER`, `RELEASED_FROM_ORDER`) with audited adjustments. Sellable availability is derived from movements, reservations, expiry and blocked status.
- Distributor offers: price in paise, quantity, batch, warehouse, serviceable pincodes, delivery SLA, fulfilment mode; submit/review; pause/reactivate/archive with audit and immediate effect on farmer-visible discovery.
- Public read-only marketplace discovery filtered by pincode, category, brand and search, over approved catalogue + approved offers + derived availability.
- Operational reports: low-stock, expiring-batches, inventory ageing. Portal has the ageing view and offer operation controls.

### Phase 3 — Farmer Commerce ✅

- Farmer profile, multiple addresses with a default.
- One active cart per farmer; cart items validated against approved offers, serviceable pincode and derived availability; backend-generated price and availability snapshots. Cart never reserves stock.
- **Idempotent checkout** from cart: creates one parent `ProductCheckout` + one child `ProductOrder` per distributor, backend-calculated totals, order status history, and batch-level reservation movements — all inside one transaction.
- Mock payment: idempotent intent creation, backend confirmation, payment event history. Success ⇒ checkout `PAID` + child orders `CONFIRMED`. Failure ⇒ `PAYMENT_FAILED`.
- Farmer-owned cancellation for eligible unpaid/failed checkouts and orders, releasing reservations through positive `RELEASED_FROM_ORDER` movements, with idempotency and audit.

### Phase 4 — Distributor Fulfilment ✅

Full state machine, each step audited, each with a business-portal action:
`CONFIRMED` → accept/reject → `DISTRIBUTOR_ACCEPTED` → `READY_TO_PACK` → `PACKED` → **invoice snapshot generated** → `READY_FOR_PICKUP` → delivery assignment → partner accept (or reason-reject + operations reassign) → `OUT_FOR_DELIVERY` → **OTP verification** → `DELIVERED`.

- Invoice snapshot contains distributor seller details, farmer name, delivery address, item lines, batch references and backend-calculated paise totals.
- Delivery assignment stores only OTP **hash + salt**; a transient mock OTP is returned in the response for development only.
- Cross-distributor isolation, delivery-partner RBAC and OTP-failure paths are all test-covered.
- `DELIVERY_PARTNER` organisation type added (see `docs/DECISIONS/0002-organisation-type-naming.md`).

### Phase 5 — Finance ✅

- `CommissionRule` with status lifecycle and rule resolution by applicability.
- `CommissionEntry` — **auto-created on delivery** (`checkout.service.ts` calls `financeService.recordDeliveryCommission`), with `PROVISIONAL` → finalise-after-return-window → `FINAL`, plus explicit reversal.
- `FinancialLedgerEntry` separating farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, refund and adjustment.
- `Settlement` creation with generated settlement numbers, status lifecycle and audit.
- Endpoints: `GET/POST /finance/commission-rules`, `GET /finance/commission-entries`, `POST /finance/commission-entries/finalize-eligible`, `POST /finance/commission-entries/:id/reverse`, `GET /finance/ledger`, `GET/POST /finance/settlements`, `GET /finance/settlements/:id`.

### Phase 6 (partial) — Attribution and Payouts ✅

- `PromoterAttribution`: create, revoke, list all, list mine — with the "one primary attribution per order" rule enforced, plus a promoter commission ledger entry type.
- `PayoutAccount`: self-service upsert, admin verify, list, read; `GET /payouts/statements/me` produces a partner earnings statement. Delivery fee support added.

### Cross-cutting modules ✅

- **Support tickets** — full lifecycle: create, list all / list mine / detail, attach evidence, assign, mark-waiting, resume, escalate, resolve, close, reopen. Default SLA hours are config-driven.
- **Tally sync abstraction** — `TallySyncRecord` + `TallySyncAttempt` with record types, status, retry attempts, error capture and a reconciliation endpoint. **Deliberately mock: it does not write to real Tally.**
- **Notification abstraction** — `Notification` + `NotificationAttempt` with channel (push/SMS/WhatsApp/email/in-app), category, payload snapshot, related resource, status, attempt count, read receipts. **Deliberately mock: nothing is actually sent.**
- **Dashboards** — `GET /dashboards/summary` returns permission-scoped, role-scoped operational counts (`PLATFORM` / `ORGANISATION` / `SELF`); `GET /dashboards/summary/export` does the same and writes an audit record for the export.

### Test coverage that exists today

Unit: `api-exception.filter`, `cart.service`, `catalogue.service`, `checkout.service`, `env.schema`, `farmers.service`, `health.controller`, `inventory.service`, `marketplace.service`, `mock-auth.guard`, `offers.service`, `onboarding.service`, `organisations.service`, `payments.service`, `permissions.guard`, `roles.guard`, `crypto.util`.
Integration: `foundation`, `phase1c-onboarding`, `phase1d-authentication`, `phase2a`…`phase2e`, `phase3a`…`phase3d`, `phase4-fulfilment`, `phase5-finance`, `phase6-payouts`, `phase6-promoter-attribution`, `support-tickets`, `tally-sync`, `notifications`, `dashboards`, and **`mvp-acceptance`**.

---

## 6. Historical partial-state snapshot (2026-08-07; superseded)

These are implemented as **deliberately labelled mocks or abstractions**. The shape is right; the outside world is not connected. Do not mistake any of these for production-ready.

| Area                                 | What exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | What is missing                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payments**                         | Backend mock intent + confirm, idempotent, event history, audit. `PAYMENT_PROVIDER=mock`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Real sandbox provider (Razorpay/PayU/Cashfree), signed webhooks, webhook idempotency, refund API, reconciliation against provider settlement reports.                                                                                                                                                                                                 |
| **Notifications**                    | Records + manual `POST /notifications/:id/attempt` to mark sent/failed; mock-payment outcomes and farmer-visible order fulfilment, support-ticket and return/refund transitions automatically write audited English/Hindi `IN_APP` rows in the same transaction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Any real transport (FCM/APNs push, SMS, WhatsApp BSP, email), a background worker, reusable templates beyond the current payment/order/support/return/refund slices, other domain producers, per-user preferences, retries with backoff and dead-letter handling.                                                                                     |
| **OTP delivery**                     | OTP is generated, hashed, expiring, attempt-limited, rate-limited. When `SMS_PROVIDER=mock`, the code is returned in the API response as `mockOtpCode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Real SMS/WhatsApp sending. **`mockOtpCode` must never be returned in production** — it is gated on `SMS_PROVIDER`, so setting a real provider removes it. Verify this before go-live.                                                                                                                                                                 |
| **Tally**                            | Sync record + attempt model, statuses, retry counter, reconciliation endpoint, `TALLY_PROVIDER=mock`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | A real Tally connector, party/item mapping, voucher/invoice/credit-note/receipt payload builders, scheduled sync, write-back (explicitly out of MVP scope per `PRODUCT_REQUIREMENTS.md` §26).                                                                                                                                                         |
| **Documents / KYC / product images** | **Metadata only** — filename, type, status, reviewer decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Actual file upload, object storage (S3/GCS), virus scanning, signed download URLs, retention. There is no file storage layer anywhere in this repo.                                                                                                                                                                                                   |
| **Delivery proof**                   | Hashed seller-issued package QR verification with pickup actor/time, followed by OTP hash/salt verification, permission-aware foreground location outcome, failed-delivery/retry transitions and assigned return collection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Photo proof and COD ledger.                                                                                                                                                                                                                                                                                                                           |
| **Business web portal**              | Role-scoped dashboard, onboarding, catalogue review, inventory + ageing, warehouses, offers + review, orders + fulfilment actions, returns/refunds/disputes, payouts, notifications, Tally, organisation/user administration, audit, secure JWT login, finance/commission/ledger/settlement views and support desk. | Remaining shared-component retrofits, company-facing demand-report surfaces and production UX/accessibility validation. |
| **Farmer mobile app**                | API-backed browse/detail/cart with pincode-scoped category/brand/crop filters, recoverable withdrawn/out-of-stock offer revalidation, explicit changed-price review and backend-bounded cart quantity controls; pincode-matched address selection; persisted-idempotency checkout creating seller-specific child orders and inventory reservations; backend mock payment success/failure and eligible checkout cancellation; paginated order history, child-order timeline, invoice snapshot, per-child cancellation and lifecycle-aware active-order refresh; farmer-owned return/refund tracking; farmer-owned support list/create/detail/order-link/reopen plus configured phone/WhatsApp launchers; farmer-owned in-app notification inbox with unread filtering, audited mark-read, allowlisted order/ticket/return links and informational checkout-level payment outcomes; farmer profile/address management; bilingual OTP self-registration and farmer-only multiple-context selection; secure session restore/refresh/logout; guarded routes; first-launch language choice; and persisted runtime locale. | Product image delivery, structured farms/crops/acreage, consent-based location assistance, authorised invoice PDF download, support conversations/evidence uploads, notification producers beyond payment/order/support/return/refund, push delivery, return evidence, reviews, service booking, real SMS, and broader offline/slow-network handling. |
| **Partner mobile app**               | Android/iOS Flutter shell with partner OTP login, supported-role context selection, secure session persistence/refresh, English/Hindi localisation, strict role routing, authenticated HTTP retry, shared backend-owned earnings and masked payout-account setup/editing, completed KC-10 Club promoter workflows, delivery availability, own delivery and return-pickup assignment flows, package QR verification, maps/phone handoffs, OTP completion, permission-aware geotag outcome and failed-delivery retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Shared KYC document workflow, photo proof, service-provider workflows, push registration, real SMS and device verification.                                                                                                                                                                                                                           |
| **Background jobs**                  | `bullmq` and `ioredis` are installed; Redis runs; a `RedisModule` exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **No queue, no worker, no scheduler is actually implemented.** `bullmq` is currently an unused dependency. Every "async" operation today is synchronous inside the request.                                                                                                                                                                           |
| **Distributor allocation**           | Checkout groups cart items by the distributor of the offer the farmer explicitly chose, then splits into child orders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The ranked allocation engine described in `PRODUCT_REQUIREMENTS.md` §10 (exclude ineligible → prefer local stock → fewer child orders → SLA → payable → distributor status → **record the allocation reason**). No `allocationReason` is recorded anywhere.                                                                                           |
| **Infrastructure**                   | `docker-compose.yml` for local Postgres + Redis; CI runs lint/typecheck/test/build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `infrastructure/database`, `infrastructure/docker`, `infrastructure/github` contain **README placeholders only**. No Dockerfile for the API, no deployment manifests, no staging/production environments, no migration deployment pipeline, no secrets management, no monitoring/alerting/error tracking, no backups.                                 |

---

## 7. Historical not-started snapshot (2026-08-07; superseded)

At the August 7 snapshot, the following areas were described as not started. The current snapshot at the top of this document records which have since shipped.

### 7.1 Returns, refunds and disputes (`PRODUCT_REQUIREMENTS.md` §18)

The return workflow now covers farmer submission/tracking/cancellation, an operational portal queue, explicit inspection and mock refund completion. Inspection allocates every returned unit to its original reservation and records restock, quarantine, damage/write-off or rejected disposition with append-only audit and inventory provenance. Operations/finance can initiate an idempotent backend-priced refund and complete the explicitly development-only mock flow. Success appends linked refund and commission-reversal ledger entries and updates return/order histories atomically; farmers see the refund status and reference. Evidence upload, disputes, pickup-assignment records, queues/workers and a real refund provider remain absent.

### 7.2 Service marketplace (`PRODUCT_REQUIREMENTS.md` §19, Phase 6)

No `ServiceProviderProfile`, no service catalogue, no pricing, no serviceable areas, no availability calendar, no `ServiceBooking`, no booking lifecycle (`REQUESTED` → `QUOTED` → `ACCEPTED` → `SCHEDULED` → `PROVIDER_EN_ROUTE` → `IN_PROGRESS` → `COMPLETED` → `FARMER_CONFIRMED` → `CANCELLED`/`DISPUTED`/`REFUNDED`/`CLOSED`), no service evidence capture, no completion OTP, no service ratings, no service earnings. The `SERVICE_PROVIDER` role and org type exist as enum values only. `OrderType` has `SERVICE_ORDER` declared but unused.

### 7.3 Partner mobile workflows (Phase 6)

The shared app shell is implemented with Android/iOS runners, OTP authentication,
partner-only context selection, secure session restoration/refresh, strict role
routing and English/Hindi runtime localisation. The following workflows remain:

- **Promoter / sales partner:** KYC, territory, farmer lead creation, farmer onboarding, crop & acreage survey, assisted ordering, referral/attribution code entry, visit records, geotagged attendance, daily targets, order attribution view, commission statement, payout statement, training material, complaint escalation.
- **Service provider:** KYC, profile, licences, equipment, service catalogue, pricing, serviceable locations, availability calendar, booking accept/reject, farmer contact & farm location, before/after evidence, acreage confirmation, completion OTP, ratings, earnings.
- **Delivery partner:** KYC, bank/payout details, vehicle details, service zone, availability toggle, assignment inbox, pickup acceptance, package QR scan, pickup proof, navigation, farmer calling, delivery OTP, geotagged POD, failed-delivery reason, return pickup, COD ledger, earnings.

### 7.4 Product reviews and ratings

Listed in `PRODUCT_REQUIREMENTS.md` §4.1. No model, no moderation, no aggregate rating on products or offers.

### 7.5 Promoter field operations

Farmer lead capture, present-farmer OTP registration, lead conversion, general organisation-scoped territory assignment, non-Club farm/crop surveys and append-only visit logging are implemented. Visits may target an owned lead or actively attributed farmer and use explicit one-time permission-aware foreground location capture; raw coordinates are excluded from audit JSON and no background tracking exists. WP-08 visit evidence, consented attendance, targets and training remain open.

Leads, territory assignment, visit records, geotagged attendance, daily targets, training material. Only _attribution_ exists today.

### 7.6 Real internationalisation

The farmer and partner Flutter apps have generated `en`/`hi` ARB catalogues, device-locale fallback, runtime switchers and persisted preferences. The business portal remains English-only via `portal-copy.ts`. `PRODUCT_REQUIREMENTS.md` §24 requires English **and** Hindi from MVP.

### 7.7 Generated API client

This historical gap is now partially resolved. `packages/api-client` still contains its older hand-written domain client, but it also commits OpenAPI-generated path/schema types, exposes an authenticated typed transport, and is protected by a CI drift gate. The business portal already consumed the older package and now uses the generated transport for the Admin Jobs, Notifications, Tally, Dashboard, Support, Payout, Organisation list/detail and User list/detail workflows. Organisation and User responses now use explicit safe projections so reviewer, membership and top-level user records cannot expose `passwordHash`. Remaining portal domains and both Flutter transports still need deliberate migration; Dart generation has not been selected.

### 7.8 Company-facing portal surfaces

Companies can create catalogue data via the API, but the portal has no company-scoped views and no demand reports (`PRODUCT_REQUIREMENTS.md` §4.3, Phase 7).

### 7.9 Production hardening

Load/performance validation against the §24 targets (reads < 500 ms, search < 2 s), security review, penetration test, PII handling review, data retention policy, accessibility audit, backup/restore drill.

---

## 8. Historical gaps and traps (2026-08-07; superseded where resolved)

Read this section before you trust any other document in the repo.

1. **`docs/DEVELOPMENT_ROADMAP.md` is out of date.** It lists Phase 5, 6 and 7 as bare bullet lists as if unstarted. In reality Phase 5, most of Phase 6's finance side, support, Tally and notifications are built. It has now been corrected — but treat _this_ handover and `REMAINING_IMPLEMENTATION_PLAN.md` as authoritative.
2. **Resolved:** `docs/API_CONTRACTS.md` now covers auth, finance, payouts, promoters, support, Tally, notifications, dashboards, returns/refunds, files and Kisan Club. Runtime Swagger, committed OpenAPI and generated TypeScript types now have sequential CI drift gates.
3. **Partially resolved:** generated TypeScript types and transport are available, with the Admin Jobs, Notifications, Tally, Dashboard, Support, Payout, Organisation list/detail and User list/detail workflows migrated. Continue the incremental migration before deleting the older domain client; see §7.7 and ADR 0019.
4. **Resolved:** BullMQ queues, a separate worker, scheduled maintenance, retry/dead-letter handling and audited replay are implemented. The Railway internal environment still needs a deployed worker service.
5. **Resolved:** the portal home consumes the permission-scoped dashboards API; the obsolete hardcoded role dashboard is gone.
6. **`mockOtpCode` in the auth response.** Gated on `SMS_PROVIDER=mock`. Confirm it is gone in any deployed environment.
7. **Loose log files are committed at the repo root** (`business-web.dev.err.log`, `business-web.dev.out.log`, `business-web.phase1b.err.log`, `business-web.phase1b.out.log`). Delete them and add `*.log` to `.gitignore`.
8. **`Vardhnam_Agrotech_Codex_Development_Blueprint.docx` and `progress till date.pdf` sit at the repo root.** Move them to `docs/` or out of the repo.
9. **Everything is on `master` in a single commit.** There is no branch protection, no PR history, no release tagging. Set up a real branching model (`main` + feature branches + PRs) on day one.
10. **`.env` is present in the working directory.** Confirm it is gitignored (it is) and rotate every secret before any deployment. `JWT_ACCESS_SECRET` in `.env.example` is a placeholder — it must be a real random ≥32-char secret per environment.
11. **Placeholder business values need real approval.** `RETURN_WINDOW_DAYS=7`, `DEFAULT_MARKETPLACE_COMMISSION_BPS=500`, `DEFAULT_PROMOTER_COMMISSION_BPS=0`, `SUPPORT_TICKET_DEFAULT_SLA_HOURS=48` are all marked "pending real approval" in `.env.example`. Get signed-off numbers from the business before pilot.
12. **Both Flutter apps are verified locally.** On 2026-08-14 the farmer app passed fatal-info analysis, all 106 tests and an Android debug APK build. The partner app resolved dependencies on the same Flutter 3.44.9/Dart 3.12.2 toolchain, passed fatal-info analysis and all 19 tests after KC-10D, and built its Android debug APK. Device launches and iOS compilation remain environment gates.
13. **Both Flutter CI jobs are reproducibly pinned.** Farmer and partner jobs use Flutter 3.44.9 with dependency resolution, explicit localisation generation, formatting enforcement, `--fatal-infos` analysis and tests. The partner dependency conflict is fixed with `intl 0.20.2`.
14. **Engineering delivered; legal review open:** GST/HSN snapshots, place-of-supply, CGST/SGST/IGST calculations and reconciliation are implemented. A chartered accountant must approve classifications, rounding and templates before production.
15. **Resolved in engineering:** durable private invoice and successful-refund credit-note PDFs are generated by the worker and exposed through audited signed downloads. Cloud storage and legal template approval remain open.

---

## 9. Original completion estimate (2026-08-07; superseded)

| Area                                                                                | Complete                           |
| ----------------------------------------------------------------------------------- | ---------------------------------- |
| Backend domain model & business logic (product side)                                | ~85%                               |
| Backend — returns/refunds/disputes                                                  | 0%                                 |
| Backend — service marketplace                                                       | 0%                                 |
| Backend — real external integrations (payment, SMS, WhatsApp, push, storage, Tally) | ~15% (abstractions only)           |
| Business web portal                                                                 | ~50%                               |
| Farmer mobile app                                                                   | ~35%                               |
| Partner mobile app                                                                  | ~10%                               |
| Infrastructure / deployment / observability                                         | ~5%                                |
| Documentation                                                                       | ~70% (good specs, stale contracts) |
| **Overall product**                                                                 | **~45–50%**                        |

The backend for the _product_ purchase flow is genuinely strong and well-tested. The remaining work is concentrated in: returns/refunds, the entire service marketplace, both mobile apps, portal breadth, real integrations, and deployment.

---

## 10. Original recommended order (2026-08-07; superseded)

Detailed specs for each of these are in **`docs/REMAINING_IMPLEMENTATION_PLAN.md`**, which breaks the work into numbered work packages (WP-01 … WP-16) with schema changes, endpoints, acceptance criteria and tests.

**Stage 1 — Stabilise and make honest (1–2 weeks).** Flutter build verification, the committed OpenAPI/generated TypeScript pipeline, dashboard portal wiring and API-contract backfill are complete. Stale artefact cleanup and a branching/PR model remain repository-governance tasks. _(WP-01, WP-02, WP-03)_

**Stage 2 — Close the MVP functional holes (4–6 weeks).** Returns/refunds/disputes; background job infrastructure with BullMQ; real notification providers wired to domain events; sandbox payment provider with signed webhooks; file/document storage. _(WP-04 … WP-08)_

**Stage 3 — Complete the portal and the farmer app (4–6 weeks).** Finance/settlement/payout/support/notification/Tally portal surfaces; farmer app auth, profile, order tracking, invoice PDF download, returns, support, reviews; real i18n. _(WP-09 … WP-11)_

**Stage 4 — Partner app and service marketplace (6–8 weeks).** Partner app shell with role routing; delivery partner workflow first (the backend already supports it), then promoter workflow, then the service marketplace backend + service provider workflow. _(WP-12 … WP-14)_

**Stage 5 — Production readiness (3–4 weeks).** GST modelling and invoice PDFs, allocation engine with recorded reasons, infrastructure and deployment, observability, security review, performance validation against §24, accessibility, pilot seed data. _(WP-15, WP-16)_

Rough total for one experienced full-stack developer with Flutter capability: **5–7 months.** With a small team (1 backend, 1 frontend/mobile, 1 shared): **3–4 months.**

---

## 11. Definition of Done for every task

A change is not done until all of the following are true. This is how the existing code was built and it is why the acceptance test still passes.

- [ ] Business rules honoured — re-read `AGENTS.md` §2 if the change touches money, sellers, invoices or commission.
- [ ] All money is integer paise, calculated on the backend, inside a transaction where it touches inventory or the ledger.
- [ ] Every state change writes an `AuditLog` row **in the same transaction**.
- [ ] Mutating endpoints that can be retried accept and honour an `Idempotency-Key`.
- [ ] Permissions declared in `permission-codes.ts`, enforced by guards, and ownership (`:own`) re-checked in the service.
- [ ] Request DTOs validated with `class-validator`; no unvalidated external input reaches a service.
- [ ] Errors use the standard envelope and a machine-readable `ApiErrorCode`.
- [ ] Strict TypeScript, no `any`.
- [ ] A Prisma migration is committed (never edit an applied migration — add a new one).
- [ ] Unit tests for service logic **and** an integration test driving the real HTTP endpoint.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all pass.
- [ ] `test/integration/mvp-acceptance.spec.ts` still passes.
- [ ] `docs/API_CONTRACTS.md` and `docs/DATA_MODEL.md` updated if a contract or model changed.
- [ ] Any new mock/sandbox integration is **clearly labelled as mock** in code, config and docs — `AGENTS.md` forbids fake integrations that look production-ready.
- [ ] A `docs/DECISIONS/000N-*.md` ADR written if an architectural decision was made.
- [ ] No user-facing string hardcoded in a component.
