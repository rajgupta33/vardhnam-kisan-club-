# Vardhnam Agrotech Marketplace

Managed agriculture marketplace for Vardhnam Agrotech.

> ## 📖 New to this project? Start here.
>
> 1. **[docs/HANDOVER.md](docs/HANDOVER.md)** — what is built, what is partial, what is missing, and every known trap in the repository.
> 2. **[docs/REMAINING_IMPLEMENTATION_PLAN.md](docs/REMAINING_IMPLEMENTATION_PLAN.md)** — the remaining work as 16 numbered work packages with schema, endpoints, acceptance criteria and tests.
> 3. **[AGENTS.md](AGENTS.md)** — permanent business truths and engineering rules. Non-negotiable.
>
> Backend is complete through Phase 5 finance and Phase 6 attribution/payouts, plus
> support tickets, Tally sync abstraction, notification abstraction and dashboards.
> All external providers are still mock. Returns/refunds, the service marketplace and
> the partner mobile app are not started.

## Applications

- `apps/marketplace-api`: NestJS API with users, organisations, access, audit, onboarding, catalogue approval, inventory, distributor offer, farmer-safe marketplace discovery, operational reporting, farmer profile, cart, checkout, product order, mock payment, cancellation, distributor fulfilment accept/reject/pick/pack, invoice generation, dispatch readiness and delivery assignment/OTP completion foundations.
- `apps/business-web`: Next.js business portal for onboarding queues, catalogue review queues, distributor inventory, inventory ageing, offer operations and review views, distributor order fulfilment, KYC metadata review and audit views.
- `apps/farmer-mobile`: Flutter farmer app skeleton with API-backed marketplace product browsing, cart preview, checkout review, mock payment and cancellation preview screens.
- `apps/partner-mobile`: Flutter partner app skeleton.

## Packages

- `packages/shared-types`: shared role, status and API types.
- `packages/validation`: shared validation constants and schemas.
- `packages/api-client`: future generated OpenAPI client destination.
- `packages/design-tokens`: shared UI tokens.

## Local Prerequisites

- Node.js 22.13 or newer
- npm 10 or newer
- Docker Desktop for PostgreSQL and Redis
- Flutter SDK for mobile apps

## First Setup

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run seed:demo
```

`npm run seed` creates the permission table and one deterministic admin. The
business portal now uses JWT authentication through `/login`; it no longer reads
mock identity headers from `BUSINESS_WEB_MOCK_*` variables.

`npm run seed:demo` creates password-login users for the portal. For example:

- Email: `finance@example.local`
- Password: `Demo@12345` (development data only)

`npm run seed:demo` adds the participants and catalogue needed to walk the MVP
acceptance scenario end to end: an approved company and distributor with
onboarding profiles and approved mock KYC, a brand, an approved product with two
variants, a warehouse, two stocked batches, two approved offers, a farmer with a
default address, an operations manager, a promoter and a delivery partner. It is
idempotent and prints development identities for every demo role when it finishes.

Demo marketplace pincode: `302001`. The demo seed is development data only and
refuses to run with `NODE_ENV=production`.

## Development

```bash
npm run dev:api
npm run dev:web
```

Set `AUTH_MODE=production` when using the portal so protected API calls accept its
Bearer access token. Access and refresh tokens are stored only in httpOnly cookies;
middleware rotates an expiring refresh token and applies permission checks before a
protected page renders. `AUTH_MODE=mock` remains available for explicit header-based
API development and tests.

API health:

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/health/ready
```

Business web:

```bash
http://localhost:3000
```

## Mobile Apps

```bash
cd apps/farmer-mobile
flutter pub get
flutter run

cd ../partner-mobile
flutter pub get
flutter run
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm test
npm --workspace @vardhnam/marketplace-api run test:integration
npm run build
npm run test:scaffold
```

Integration tests need PostgreSQL and Redis running, plus a **dedicated test
database** — the suite truncates every table in whatever database it is pointed
at. Set `TEST_DATABASE_URL` (see `.env.example`); the suite refuses to start
unless the database name contains `test`, and it configures `AUTH_MODE` itself,
so no other environment setup is needed:

```bash
npm --workspace @vardhnam/marketplace-api run test:integration
```

The command chains two sequential Jest runs, each with its own config and
`AUTH_MODE`: `phase1d-authentication.spec.ts` exercises the real JWT bearer path
and needs `AUTH_MODE=production`, while every other spec uses mock identity
headers and needs `AUTH_MODE=mock`. They must not run concurrently — both reset
the same database. Run one group on its own with
`test:integration:mock-auth` or `test:integration:production-auth`.

`test/integration/mvp-acceptance.spec.ts` drives the whole acceptance scenario
from `docs/PRODUCT_REQUIREMENTS.md` section 30 through the HTTP API and is the
fastest way to confirm the platform still composes after a change.

## Testing the Farmer App

To run the farmer app against a seeded backend with the Kisan Club module
populated, follow `docs/FARMER_APP_TESTING_GUIDE.md`. In short: bring up Docker,
set `KISAN_CLUB_ENABLED=true` and `AUTH_MODE=production`, run `seed` then
`seed:demo`, start the API **and the worker**, then:

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

`10.0.2.2` is the Android emulator's route to the host; use your LAN IP for a
physical device. Log in as `+919000000042` — the OTP comes back in the API
response while `SMS_PROVIDER=mock`.

## File Storage

Uploads go directly from client to storage; bytes never pass through the API.
Request a URL from `POST /api/v1/files/upload-url`, `PUT` the bytes to it, then
`POST /api/v1/files/:fileId/confirm`. The file is scanned on the `documents`
queue and is **not downloadable until the scan clears it** — a download request
returns 409 while it is still pending, so a worker must be running for uploads
to become usable.

`STORAGE_PROVIDER=local` writes under `STORAGE_LOCAL_ROOT` (default `.storage`,
gitignored) and issues HMAC-signed expiring URLs against the API's own
`storage/local-object` endpoint, so the client flow matches a cloud bucket
exactly. `VIRUS_SCANNER=mock` recognises only the EICAR test string and is not
virus scanning. See `docs/DECISIONS/0011-file-and-document-storage.md`.

## Background Workers

The API enqueues background jobs but never consumes them. Run the worker as a
separate process:

```bash
npm --workspace @vardhnam/marketplace-api run start:worker:dev
```

Without a worker running, jobs simply accumulate in Redis and the API is
unaffected. The worker also owns the repeatable maintenance schedule (commission
finalisation, batch expiry, OTP and refresh-token cleanup). Queue depths and the
dead-letter queue are visible to `ADMIN`/`SUPER_ADMIN` at `/api/v1/admin/jobs/queues`
and `/api/v1/admin/jobs/dead-letter`. See `docs/DECISIONS/0010-background-job-architecture.md`.

## Current Boundary

Phase 4E implements company-owned catalogue foundations, distributor-owned warehouses, batch inventory, append-only stock movements, distributor offer foundations, public read-only marketplace product discovery, API-backed farmer product browsing, richer offer status operations, inventory ageing reports, farmer profile/address APIs, farmer-owned cart APIs, idempotent cart checkout, parent product checkout records, distributor-split child product orders, order status history, append-only inventory reservation movements, backend-confirmed mock payment intents/events, farmer-owned cancellation with append-only reservation release, distributor fulfilment order accept/reject transitions, picking/packing transitions, packed-order invoice snapshot generation, invoiced-order dispatch readiness, delivery assignment, out-for-delivery transition and backend mock OTP delivery completion. It does not implement real payment provider capture, production payment webhooks, real SMS/WhatsApp notifications, geotagged proof capture, delivery payouts, finance ledger, settlement, refunds, invoice PDFs, private document storage or Tally write-back.
