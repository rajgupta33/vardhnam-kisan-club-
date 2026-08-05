# Vardhnam Agrotech Marketplace — Developer Handover

**Document status:** Authoritative handover snapshot
**Date:** 2026-08-06
**Repository state:** branch `master`, single commit `8e4ade2`, working tree clean
**Audience:** The developer(s) taking over this project

> Read this document first. Then read, in order:
> 1. `AGENTS.md` — permanent business truths and engineering rules. **These are not negotiable without a written product decision.**
> 2. `docs/PRODUCT_REQUIREMENTS.md` — the full product spec.
> 3. `docs/REMAINING_IMPLEMENTATION_PLAN.md` — the step-by-step build plan for everything that is left.
> 4. `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/BUSINESS_RULES.md`, `docs/ARCHITECTURE.md`.

---

## Table of Contents

1. [What this product is](#1-what-this-product-is)
2. [Repository map](#2-repository-map)
3. [Getting it running in 15 minutes](#3-getting-it-running-in-15-minutes)
4. [How the code is organised (patterns you must follow)](#4-how-the-code-is-organised-patterns-you-must-follow)
5. [What is COMPLETE](#5-what-is-complete)
6. [What is PARTIAL (works, but not production)](#6-what-is-partial-works-but-not-production)
7. [What is NOT STARTED](#7-what-is-not-started)
8. [Known gaps, traps and stale artefacts](#8-known-gaps-traps-and-stale-artefacts)
9. [Overall completion estimate](#9-overall-completion-estimate)
10. [Recommended order of work](#10-recommended-order-of-work)
11. [Definition of Done for every task](#11-definition-of-done-for-every-task)

---

## 1. What this product is

Vardhnam Agrotech is a **multi-sided B2B2C managed agriculture marketplace**. It is *not* a single-seller e-commerce app. Get this model wrong and every downstream decision will be wrong:

| Party | Role |
|---|---|
| **Farmer** | The buyer. Uses the farmer mobile app. |
| **Agriculture company** | Brand owner. Owns the **master catalogue**. Is *not* the seller. |
| **Distributor** | **Seller of record.** Owns stock, warehouses, batches, offers, prices, serviceable pincodes. Issues the invoice to the farmer. |
| **Promoter / sales partner** | Assists farmers, earns attribution-based commission. The order is still farmer↔distributor. |
| **Service provider** | Sells *services* (drone spraying, soil testing, etc.) — a **separate order type**, not a product order. |
| **Delivery partner** | Executes deliveries, earns delivery payouts. |
| **Vardhnam** | Marketplace operator: approvals, allocation, commission, settlement, support, ops. |

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
│   ├── farmer-mobile/          Flutter  ← ~20% built (browse/cart/checkout preview)
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

| Concern | Rule | Where to look |
|---|---|---|
| Auth | `AUTH_MODE=mock` uses header-based mock identity; real mode uses JWT bearer. Both flow through `CurrentUser`. | `src/auth/mock-auth.guard.ts`, `src/auth/jwt-token.service.ts` |
| Authorisation | Permission codes in `src/access/permission-codes.ts` mapped per `PlatformRole`. Guards enforce; services re-check ownership (`:own` vs `:any`). | `src/access/`, `test/permissions.guard.spec.ts` |
| Response shape | Every success is `{ data, requestId }`; every error is `{ error: { code, message, statusCode, requestId, timestamp, details? } }`. | `src/common/errors/`, `src/common/filters/` |
| Error codes | Machine-readable enum. Never throw a bare string. | `src/common/errors/api-error-codes.ts` |
| Money | Integer **paise** only. Never float. Never compute on a client. | `src/finance/`, `src/checkout/` |
| Time | UTC everywhere. |
| Audit | Every state change calls `AuditService.record(...)` **inside the same Prisma transaction**. | `src/audit/audit.service.ts` |
| Idempotency | Checkout, payment and cancellation require an `Idempotency-Key` header backed by the `IdempotencyRecord` model. | `src/checkout/`, `src/payments/` |
| Inventory | **Append-only** `InventoryMovement` rows. Availability is *derived*, never a mutable counter. | `src/inventory/` |
| Transactions | Inventory reservation, order creation and any financial ledger write must be in `prisma.$transaction`. | `src/checkout/checkout.service.ts` |
| Deletes | Financial/invoice/settlement/audit rows are never hard-deleted. Use status transitions. |
| Types | Strict TypeScript. `any` is banned. |

**Business-web pattern:** Next.js App Router server components fetch through `src/lib/marketplace-api.ts` (server-side only, injects mock-auth headers from env). Mutations are server actions in `actions.ts` next to the page. UI copy lives in `src/content/portal-copy.ts` — do not hardcode user-facing strings in components.

**Flutter pattern:** `lib/src/marketplace/marketplace_api.dart` is the HTTP layer; screens live in `lib/src/screens/`; all strings go through `lib/src/strings/app_strings.dart` which already has `en` and `hi` maps.

---

## 5. What is COMPLETE

Everything in this section is implemented on the backend, covered by tests, and exercised by the demo seed. "Complete" here means *complete for the pilot MVP*, still with mock external providers.

### Phase 0 — Foundation ✅
Monorepo + npm workspaces, NestJS skeleton, Next.js skeleton, two Flutter skeletons, Prisma, Docker Compose (Postgres + Redis), env validation with a Zod schema, structured logging with correlation/request IDs, global validation pipe, standard success/error envelopes, OpenAPI, Jest unit + integration setup, ESLint + Prettier + strict tsconfig, GitHub Actions CI, `.env.example`, seed framework, audit-log infrastructure.

### Phase 1 — Identity, Organisations, Access, Onboarding ✅
- Users, organisations, memberships; a user may belong to several organisations with different roles.
- 15 platform roles (`FARMER` … `SUPER_ADMIN`), permission table, role→permission mapping, role guard + permission guard, resource-level ownership checks.
- Company and distributor onboarding profiles; KYC **document metadata** lifecycle with reviewer decisions and audit trail.
- Derived approval queue API; organisation approve/reject with audit.
- Business portal: onboarding queue, company/distributor detail views, KYC review actions, organisation approve/reject, audit log viewer.
- **Phase 1D authentication (this is real, not mock):** `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/login`, `/auth/select-organisation`, `/auth/refresh`, `/auth/logout`. OTP challenges are hashed and expiring, refresh tokens are persisted and rotatable, access tokens are JWT, rate limiting via `ThrottlerGuard` on the OTP endpoints. **The OTP *delivery channel* is still mock** — see §6.

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
`CONFIRMED` → accept/reject → `DISTRIBUTOR_ACCEPTED` → `READY_TO_PACK` → `PACKED` → **invoice snapshot generated** → `READY_FOR_PICKUP` → delivery assignment → `OUT_FOR_DELIVERY` → **OTP verification** → `DELIVERED`.
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

## 6. What is PARTIAL (works, but not production)

These are implemented as **deliberately labelled mocks or abstractions**. The shape is right; the outside world is not connected. Do not mistake any of these for production-ready.

| Area | What exists | What is missing |
|---|---|---|
| **Payments** | Backend mock intent + confirm, idempotent, event history, audit. `PAYMENT_PROVIDER=mock`. | Real sandbox provider (Razorpay/PayU/Cashfree), signed webhooks, webhook idempotency, refund API, reconciliation against provider settlement reports. |
| **Notifications** | Records + manual `POST /notifications/:id/attempt` to mark sent/failed. | Any real transport (FCM/APNs push, SMS, WhatsApp BSP, email), a background worker, templates, per-user preferences, retries with backoff, dead-letter handling. **Nothing is auto-triggered by domain events today.** |
| **OTP delivery** | OTP is generated, hashed, expiring, attempt-limited, rate-limited. When `SMS_PROVIDER=mock`, the code is returned in the API response as `mockOtpCode`. | Real SMS/WhatsApp sending. **`mockOtpCode` must never be returned in production** — it is gated on `SMS_PROVIDER`, so setting a real provider removes it. Verify this before go-live. |
| **Tally** | Sync record + attempt model, statuses, retry counter, reconciliation endpoint, `TALLY_PROVIDER=mock`. | A real Tally connector, party/item mapping, voucher/invoice/credit-note/receipt payload builders, scheduled sync, write-back (explicitly out of MVP scope per `PRODUCT_REQUIREMENTS.md` §26). |
| **Documents / KYC / product images** | **Metadata only** — filename, type, status, reviewer decision. | Actual file upload, object storage (S3/GCS), virus scanning, signed download URLs, retention. There is no file storage layer anywhere in this repo. |
| **Delivery proof** | OTP hash/salt verification and status transitions. | Geotagged proof capture, photo proof, package QR scan, failed-delivery reasons and retry, return pickup, COD ledger. |
| **Business web portal** | Onboarding, catalogue review, inventory + ageing, warehouses, offers + review, orders + full fulfilment actions, audit log. | Finance, settlements, payouts, support desk, notifications, Tally, and a real dashboard. **The portal home page is static placeholder copy** (`role-dashboard.tsx` renders hardcoded metrics from `portal-copy.ts`) even though `GET /dashboards/summary` exists and works. |
| **Farmer mobile app** | API-backed product browse (pincode/category/search), cart, checkout review, mock-payment preview, cancellation preview. `en` + `hi` string maps exist. | Real OTP login screens, farmer/farm/crop profile, address management, location detection, order tracking, invoice download, returns, refunds, support, reviews, service booking, runtime locale switching, offline/slow-network handling. |
| **Partner mobile app** | A single static dashboard listing three role tiles. | Everything. See §7. |
| **Background jobs** | `bullmq` and `ioredis` are installed; Redis runs; a `RedisModule` exists. | **No queue, no worker, no scheduler is actually implemented.** `bullmq` is currently an unused dependency. Every "async" operation today is synchronous inside the request. |
| **Distributor allocation** | Checkout groups cart items by the distributor of the offer the farmer explicitly chose, then splits into child orders. | The ranked allocation engine described in `PRODUCT_REQUIREMENTS.md` §10 (exclude ineligible → prefer local stock → fewer child orders → SLA → payable → distributor status → **record the allocation reason**). No `allocationReason` is recorded anywhere. |
| **Infrastructure** | `docker-compose.yml` for local Postgres + Redis; CI runs lint/typecheck/test/build. | `infrastructure/database`, `infrastructure/docker`, `infrastructure/github` contain **README placeholders only**. No Dockerfile for the API, no deployment manifests, no staging/production environments, no migration deployment pipeline, no secrets management, no monitoring/alerting/error tracking, no backups. |

---

## 7. What is NOT STARTED

Nothing exists for these — no models, no migrations, no services, no endpoints, no UI.

### 7.1 Returns, refunds and disputes (`PRODUCT_REQUIREMENTS.md` §18)
The `ProductOrderStatus` enum already declares `RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `RETURN_IN_TRANSIT`, `RETURNED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`, `CLOSED` — **but no code can ever produce those statuses.** There is no `ReturnRequest` model, no `Refund` model, no `Dispute` model, no inspection workflow, no commission-reversal trigger on refund. This is an MVP-scope item (§25 lists "return request") and it is the biggest functional hole in the product.

### 7.2 Service marketplace (`PRODUCT_REQUIREMENTS.md` §19, Phase 6)
No `ServiceProviderProfile`, no service catalogue, no pricing, no serviceable areas, no availability calendar, no `ServiceBooking`, no booking lifecycle (`REQUESTED` → `QUOTED` → `ACCEPTED` → `SCHEDULED` → `PROVIDER_EN_ROUTE` → `IN_PROGRESS` → `COMPLETED` → `FARMER_CONFIRMED` → `CANCELLED`/`DISPUTED`/`REFUNDED`/`CLOSED`), no service evidence capture, no completion OTP, no service ratings, no service earnings. The `SERVICE_PROVIDER` role and org type exist as enum values only. `OrderType` has `SERVICE_ORDER` declared but unused.

### 7.3 Partner mobile application (Phase 6)
The whole app. Per `PRODUCT_REQUIREMENTS.md` §4.2:
- **Promoter / sales partner:** KYC, territory, farmer lead creation, farmer onboarding, crop & acreage survey, assisted ordering, referral/attribution code entry, visit records, geotagged attendance, daily targets, order attribution view, commission statement, payout statement, training material, complaint escalation.
- **Service provider:** KYC, profile, licences, equipment, service catalogue, pricing, serviceable locations, availability calendar, booking accept/reject, farmer contact & farm location, before/after evidence, acreage confirmation, completion OTP, ratings, earnings.
- **Delivery partner:** KYC, bank/payout details, vehicle details, service zone, availability toggle, assignment inbox, pickup acceptance, package QR scan, pickup proof, navigation, farmer calling, delivery OTP, geotagged POD, failed-delivery reason, return pickup, COD ledger, earnings.

### 7.4 Product reviews and ratings
Listed in `PRODUCT_REQUIREMENTS.md` §4.1. No model, no moderation, no aggregate rating on products or offers.

### 7.5 Promoter field operations
Leads, territory assignment, visit records, geotagged attendance, daily targets, training material. Only *attribution* exists today.

### 7.6 Real internationalisation
Both Flutter apps hold `en` and `hi` string maps but there is no locale detection, no runtime switcher, no persisted preference, no `intl`/ARB pipeline. The business portal is English-only via `portal-copy.ts`. `PRODUCT_REQUIREMENTS.md` §24 requires English **and** Hindi from MVP.

### 7.7 Generated API client
`packages/api-client` is a **hand-written** typed client, not generated from OpenAPI, and it has already drifted (e.g. its `OrganisationType` union is missing `DELIVERY_PARTNER`, and it has no Phase 5/6/7 types). `AGENTS.md` §5 requires generated or maintained clients from OpenAPI. Nothing consumes it today — `business-web` has its own `marketplace-api.ts` and the Flutter app has its own `marketplace_api.dart`, so request/response types are duplicated in three places.

### 7.8 Company-facing portal surfaces
Companies can create catalogue data via the API, but the portal has no company-scoped views and no demand reports (`PRODUCT_REQUIREMENTS.md` §4.3, Phase 7).

### 7.9 Production hardening
Load/performance validation against the §24 targets (reads < 500 ms, search < 2 s), security review, penetration test, PII handling review, data retention policy, accessibility audit, backup/restore drill.

---

## 8. Known gaps, traps and stale artefacts

Read this section before you trust any other document in the repo.

1. **`docs/DEVELOPMENT_ROADMAP.md` is out of date.** It lists Phase 5, 6 and 7 as bare bullet lists as if unstarted. In reality Phase 5, most of Phase 6's finance side, support, Tally and notifications are built. It has now been corrected — but treat *this* handover and `REMAINING_IMPLEMENTATION_PLAN.md` as authoritative.
2. **`docs/API_CONTRACTS.md` stops at Phase 4E.** None of the `/finance`, `/payouts`, `/promoters`, `/support`, `/tally`, `/notifications`, `/dashboards` or `/auth` endpoints are documented there. Use Swagger at `/api/docs` as the live source of truth, and backfill the doc as you go (`AGENTS.md` requires docs to be updated with contract changes).
3. **`packages/api-client` has drifted** — see §7.7. Do not build new frontends on it until it is regenerated.
4. **`bullmq` is installed but unused.** Anyone grepping dependencies will assume there is a queue. There is not.
5. **The portal home page is fake.** `role-dashboard.tsx` renders hardcoded metrics. A real dashboards API exists and is unused. This is the single most misleading thing in the repo for a demo.
6. **`mockOtpCode` in the auth response.** Gated on `SMS_PROVIDER=mock`. Confirm it is gone in any deployed environment.
7. **Loose log files are committed at the repo root** (`business-web.dev.err.log`, `business-web.dev.out.log`, `business-web.phase1b.err.log`, `business-web.phase1b.out.log`). Delete them and add `*.log` to `.gitignore`.
8. **`Vardhnam_Agrotech_Codex_Development_Blueprint.docx` and `progress till date.pdf` sit at the repo root.** Move them to `docs/` or out of the repo.
9. **Everything is on `master` in a single commit.** There is no branch protection, no PR history, no release tagging. Set up a real branching model (`main` + feature branches + PRs) on day one.
10. **`.env` is present in the working directory.** Confirm it is gitignored (it is) and rotate every secret before any deployment. `JWT_ACCESS_SECRET` in `.env.example` is a placeholder — it must be a real random ≥32-char secret per environment.
11. **Placeholder business values need real approval.** `RETURN_WINDOW_DAYS=7`, `DEFAULT_MARKETPLACE_COMMISSION_BPS=500`, `DEFAULT_PROMOTER_COMMISSION_BPS=0`, `SUPPORT_TICKET_DEFAULT_SLA_HOURS=48` are all marked "pending real approval" in `.env.example`. Get signed-off numbers from the business before pilot.
12. **Flutter has never been verified in this environment** — the SDK was not installed on the machine where the backend was built. Both mobile apps compile-check only in theory. **Your first mobile task is to run `flutter pub get && flutter analyze && flutter test` in both apps and fix whatever falls out.**
13. **Mobile apps are not in the npm workspace or CI.** `.github/workflows/ci.yml` never touches Flutter. Add Flutter jobs.
14. **GST is not modelled.** Invoices compute paise totals but there is no GST breakup, HSN codes, CGST/SGST/IGST split or place-of-supply logic. Agri-input invoicing in India will require this before real money moves. `PRODUCT_REQUIREMENTS.md` §14 explicitly defers it — but it is required before go-live, not optional.
15. **No PDF invoice generation.** Invoices are JSON snapshots. Farmers need a downloadable PDF (§4.1).

---

## 9. Overall completion estimate

| Area | Complete |
|---|---|
| Backend domain model & business logic (product side) | ~85% |
| Backend — returns/refunds/disputes | 0% |
| Backend — service marketplace | 0% |
| Backend — real external integrations (payment, SMS, WhatsApp, push, storage, Tally) | ~15% (abstractions only) |
| Business web portal | ~40% |
| Farmer mobile app | ~20% |
| Partner mobile app | ~2% |
| Infrastructure / deployment / observability | ~5% |
| Documentation | ~70% (good specs, stale contracts) |
| **Overall product** | **~45–50%** |

The backend for the *product* purchase flow is genuinely strong and well-tested. The remaining work is concentrated in: returns/refunds, the entire service marketplace, both mobile apps, portal breadth, real integrations, and deployment.

---

## 10. Recommended order of work

Detailed specs for each of these are in **`docs/REMAINING_IMPLEMENTATION_PLAN.md`**, which breaks the work into numbered work packages (WP-01 … WP-16) with schema changes, endpoints, acceptance criteria and tests.

**Stage 1 — Stabilise and make honest (1–2 weeks).** Verify Flutter builds, clean stale artefacts, set up branching/PRs, regenerate the API client from OpenAPI, wire the real dashboards API into the portal home, backfill `API_CONTRACTS.md`. *(WP-01, WP-02, WP-03)*

**Stage 2 — Close the MVP functional holes (4–6 weeks).** Returns/refunds/disputes; background job infrastructure with BullMQ; real notification providers wired to domain events; sandbox payment provider with signed webhooks; file/document storage. *(WP-04 … WP-08)*

**Stage 3 — Complete the portal and the farmer app (4–6 weeks).** Finance/settlement/payout/support/notification/Tally portal surfaces; farmer app auth, profile, order tracking, invoice PDF download, returns, support, reviews; real i18n. *(WP-09 … WP-11)*

**Stage 4 — Partner app and service marketplace (6–8 weeks).** Partner app shell with role routing; delivery partner workflow first (the backend already supports it), then promoter workflow, then the service marketplace backend + service provider workflow. *(WP-12 … WP-14)*

**Stage 5 — Production readiness (3–4 weeks).** GST modelling and invoice PDFs, allocation engine with recorded reasons, infrastructure and deployment, observability, security review, performance validation against §24, accessibility, pilot seed data. *(WP-15, WP-16)*

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
