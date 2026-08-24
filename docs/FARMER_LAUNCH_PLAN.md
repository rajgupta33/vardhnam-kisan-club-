# Farmer App Launch Plan — Real Registration and Vardhnam Orders

**Goal:** a real farmer installs the app from Play, registers with their own phone
number, browses Vardhnam products, places an order, pays, and receives it.

**Status of this document:** written 2026-08-25 against commit `1828951`. Every
claim below was checked against the code, not against the older planning docs.

**Scope:** the farmer app and everything behind it. The partner app, business
portal, service marketplace and iOS are out of scope except where the farmer
journey depends on them.

---

## 1. Where the farmer journey already works

This is not a greenfield build. Verified working today, with tests and green CI:

- **Registration backend.** `POST /api/v1/auth/farmer/otp/request` and
  `/auth/farmer/otp/verify` exist with an isolated OTP purpose, throttling
  decorators, and atomic user + profile + active farmer membership creation,
  each audited.
- **The app itself.** 31 screens, bilingual English/Hindi with persisted runtime
  language selection, Riverpod state, `go_router` routes, offline-aware
  discovery caching, shared transport-error presentation, and automated
  accessibility checks at 200% text.
- **Commerce.** Discovery with pincode-scoped filters, cart grouped by
  distributor, checkout, orders and status history, invoices, returns, support
  tickets, in-app notifications, farms and crops, Kisan Club.
- **Fulfilment.** Distributor accept through pack, invoice, dispatch, delivery
  assignment, pickup-code verification and OTP delivery completion.
- **Quality gates.** 174 farmer app tests, 131 + 8 API integration tests, 276 API
  unit tests, all four CI jobs green.

The gap is not features. It is that **every external provider is a mock**, the
**hosting is demo-grade**, and **two Play Store obligations have no code at all**.

---

## 2. The five things that actually block launch

Ordered by what blocks what. Nothing below is optional for a public release.

### B1 — Real SMS, or nobody can register

`SMS_PROVIDER` is declared as `z.literal('mock')` in
`apps/marketplace-api/src/config/env.schema.ts:67`. The config layer physically
cannot accept another value, and `mock-notification.provider.ts` is the only
implementation in `src/notifications/providers/`.

Registration is OTP-only. Until this is replaced, no real farmer can create an
account at all.

**Work:**

- Widen `SMS_PROVIDER` from a literal to an enum and add the provider branch in
  `notification-provider.registry.ts`.
- Implement the provider against a chosen Indian BSP behind the existing
  `NotificationProvider` interface — the interface and the OTP send path
  (`otp-sender.service.ts`) already exist and need no redesign.
- Handle send failures as retryable and surface them to the caller. OTP delivery
  is deliberately synchronous, so a provider timeout becomes a user-visible
  registration failure.

**Non-code dependency with the longest lead time:** Indian DLT registration.
Transactional SMS to Indian numbers requires a registered sender ID and
pre-approved message templates under TRAI rules. Start this before the code —
it is measured in weeks, not days, and the OTP template text must be registered
exactly as sent.

**Done when:** a real handset receives an OTP and completes registration against
the production API with `SMS_PROVIDER` set to the real provider, and
`mockOtpCode` is absent from every API response.

### B2 — Rate limiting is per-process, and real SMS costs money

`ThrottlerModule.forRootAsync` in `apps/marketplace-api/src/app.module.ts:59`
configures ttl and limit but **no storage adapter**, so it defaults to in-memory.

With mock SMS this is harmless. With a real paid provider it is an open cost and
abuse hole: counters reset on every restart or redeploy, and running two API
instances doubles the effective limit. The OTP endpoints are public and unauthenticated.

**Work:** back the throttler with the Redis instance the app already connects to
(`RedisModule` exists), and add a per-phone-number limit in addition to the
per-IP one — a single number should not be able to request unlimited codes from
rotating IPs.

**Done when:** OTP limits hold across a restart and across two concurrent API
instances, proven by test.

### B3 — Account deletion does not exist, and Play requires it

There is **no account deletion or anonymisation code anywhere in the API.** The
app only opens an external URL (`FARMER_ACCOUNT_DELETION_URL` in
`lib/src/legal/farmer_legal_links.dart`).

Google Play requires apps that let users create an account to provide both an
in-app deletion path and a publicly reachable web deletion request. A link to a
page that does not perform a deletion does not satisfy the policy, and this is a
common rejection reason.

**Work:**

- Backend deletion endpoint. This cannot be a hard delete: invoices, the finance
  ledger and audit records are append-only by design and carry statutory
  retention. Implement **anonymisation** — clear name, phone, addresses and
  farm/crop personal data; retain financial rows with the identity fields
  scrubbed and a tombstone on the user.
- Decide and document the retention window and what survives deletion, because
  the Data safety declaration and the privacy policy must both state it.
- In-app flow in the farmer Account screen: explain what is deleted and what is
  retained, require re-authentication, confirm, then sign out.
- A public web form for the same request, for users who have uninstalled.

**Done when:** a farmer can delete their account from inside the app, the data
is provably anonymised, and the public URL performs the same request.

### B4 — No worker is deployed, so payments never confirm

There are **12 queued job handlers**, and `docs/HANDOVER.md` records that the
Railway environment has no deployed worker. The API enqueues; nothing consumes.

This is not only slow invoice PDFs. The list includes:

| Handler | What silently never happens |
| --- | --- |
| `process-payment-webhook.handler.ts` | **Provider payment confirmations are never processed** |
| `reconcile-payment-intents.handler.ts` | Stuck payments are never reconciled |
| `execute-refund.handler.ts` | Refunds never execute |
| `generate-invoice-pdf.handler.ts` | Invoice PDFs stay queued forever |
| `generate-credit-note-pdf.handler.ts` | Credit notes never produced |
| `send-notification.handler.ts`, `dispatch-pending-notifications.handler.ts` | Notifications stay PENDING |
| `scan-stored-file.handler.ts` | Uploads are never virus-scanned |
| `generate-advisories.handler.ts` | Kisan Club advisories never generated |

The worker entry point (`src/worker.ts`) and its container target already exist —
this is a deployment task, not a build task, but it gates real payments.

**Done when:** the worker runs as its own always-on service against the same
Redis, a payment webhook moves an order to paid end to end, and an invoice PDF
completes.

### B5 — Real payments

`PAYMENT_PROVIDER` is `z.literal('mock')` (`env.schema.ts:76`) with only
`mock-payment.provider.ts` implemented. The data model is already prepared:
`PaymentProviderMode` has `MOCK | SANDBOX | LIVE`, and a webhook controller,
webhook service and reconciliation service all exist.

**Work:** implement the provider behind `payment-provider.interface.ts`, verify
webhook signatures for real, exercise sandbox before live, and confirm refunds
settle through the real provider.

**Consider COD as a launch shortcut.** Cash on delivery is **not implemented at
all** — no enum, no flow. Adding it is real work, but it removes the payment
gateway, merchant account and settlement reconciliation from the critical path
and suits first-time rural buyers. This is a commercial decision worth making
deliberately rather than by default.

---

## 3. Catalogue and commercial setup

Mostly configuration rather than code, but the farmer sees an empty app without
it, so it belongs on the launch path.

**How the model works — this shapes how you register Vardhnam:**

- Products (`MasterProduct`) are owned by **COMPANY** organisations
  (`catalogue.service.ts:847`).
- Only **DISTRIBUTOR** organisations may hold inventory
  (`inventory.service.ts:907`) or create offers (`offers.service.ts:678`).
- `type` is a single enum, so one organisation cannot be both.

To sell Vardhnam's own products you therefore need **two organisations**: a
COMPANY that owns the catalogue, and a DISTRIBUTOR that stocks and prices it.
The demo seed already models exactly this shape. When other companies join later,
they onboard as additional COMPANY organisations against the same distributors —
no code change required, which is the outcome you wanted.

**Work:** onboard both organisations with real KYC, load real products with
variants, HSN codes and GST rates, create warehouses with real serviceable
pincodes, stock real batches, publish approved offers, and replace the
placeholder return-window, commission and support-SLA values with approved ones.

**Also required before invoices go to real farmers:** chartered-accountant
sign-off on GST classification, rounding and the invoice and credit-note
templates. This is a hard prerequisite for issuing tax documents, not a polish
item.

---

## 4. Hosting

| Item | State today | Needed |
| --- | --- | --- |
| Object storage | `STORAGE_PROVIDER: z.literal('local')` writes to container disk | S3-compatible provider; container disks are ephemeral, so invoice PDFs are lost on every redeploy |
| Worker | Not deployed | Always-on service (see B4) |
| Database | Railway demo instance | Managed Postgres with automated backups **and a tested restore** |
| Redis | Railway demo instance | Managed, persistent, shared by API, worker and throttler |
| Secrets | Environment variables | Secret manager; the JWT secret, provider keys and DB URL should not live in plain env config |
| TLS and ingress | Railway defaults | Deliberate domain, certificate and ingress decision |
| Observability | None | Error tracking, uptime alerting, queue-depth and payment-reconciliation alerts |

The storage decision blocks the invoice PDF path, which a real farmer will hit on
their first order. Treat it as launch-blocking rather than infrastructure polish.

---

## 5. Play Store submission

- **Legal pages must be live first.** The app validates the three URLs at build
  time and fails closed on missing, local, insecure or placeholder values. Publish
  privacy policy, terms and the account-deletion page at stable public HTTPS URLs
  and pass them as `--dart-define` values.
- **Signing.** Create the upload key outside the repository, enrol in Play App
  Signing, and back up the recovery material. `key.properties.example` and the
  Gradle wiring already exist and already refuse to fall back to the debug key.
- **Version.** `pubspec.yaml` still reads `0.1.0+1`. Set an approved version name
  and a monotonically increasing version code.
- **App access declaration.** Login is OTP-gated, so a reviewer cannot get in
  unaided. Provide working reviewer credentials or a documented test number, or
  the review will be rejected as unreviewable. This is the single most likely
  avoidable rejection for this app.
- **Declarations.** Data safety (must match what B3 actually does), content
  rating, target audience, ads declaration.
- **Listing.** Name, short and full descriptions, icon, feature graphic and phone
  screenshots, in both English and Hindi.
- **Closed testing.** New developer accounts face a mandatory closed-testing
  period with a minimum tester count and duration before production access.
  Confirm the current requirement against Play Console for your account type and
  start it early — it is elapsed time you cannot compress.

---

## 6. App-side code still to write

| Item | Why | Blocking? |
| --- | --- | --- |
| In-app account deletion UI | Pairs with B3; Play requires the in-app path | **Yes** |
| Push notifications | No device-token, FCM or APNs code exists anywhere. Order updates are in-app only, so a farmer learns their order shipped only by opening the app | No, but expected |
| Phone number change and recovery | Not implemented. A farmer who loses their number loses the account and its order history permanently | No, but it will generate support load from day one |
| Real-device testing | Low-end handsets, slow and intermittent networks, real TalkBack | **Yes** |
| iOS | Scaffold and bundle IDs exist; never built, signed or tested. Needs a Mac | No — Android only |

---

## 7. Suggested order

Dependency order is real here; this is not an arbitrary numbering.

1. **Start DLT sender-ID and template registration.** Longest external lead time,
   blocks B1, and nothing else waits on it.
2. **Decide payments: gateway or COD.** This determines whether B5 is a merchant
   account plus integration or an in-app flow to build.
3. **Hosting decisions** — storage, managed database, secret manager — because
   B4 and the storage provider both depend on them.
4. **Deploy the worker (B4).** Cheapest high-impact fix; unblocks invoices,
   notifications, refunds and payment webhooks at once.
5. **Redis-backed throttling (B2)** before real SMS is switched on, not after.
6. **Real SMS provider (B1)** once DLT clears.
7. **Account deletion, backend and app (B3).**
8. **Payment provider (B5)** in sandbox, then live.
9. **Catalogue and commercial data**, with CA sign-off on GST.
10. **Legal pages live**, then build the signed release with real `--dart-define`
    values.
11. **Real-device test pass**, then closed testing, then staged rollout.

Items 1, 2 and 3 are decisions rather than code, and everything else waits on
them. Making those three this week is worth more than any amount of coding.

---

## 8. What this plan deliberately excludes

Real but not on the path to a farmer registering and ordering Vardhnam products:

- The service marketplace (WP-14) — unimplemented beyond enum foundations, and a
  separate domain.
- iOS.
- Portal Hindi localisation.
- Partner app KYC submission and photo proof of delivery.
- The deferred distributor allocation engine.
- Provider-backed Crop Doctor and weather integration.
