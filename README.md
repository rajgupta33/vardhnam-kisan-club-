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

`npm run seed` creates the permission table and one deterministic mock admin:

- `BUSINESS_WEB_MOCK_USER_ID=00000000-0000-4000-8000-000000000002`
- `BUSINESS_WEB_MOCK_ROLE=SUPER_ADMIN`
- `BUSINESS_WEB_MOCK_ORGANISATION_ID=00000000-0000-4000-8000-000000000001`

`npm run seed:demo` adds the participants and catalogue needed to walk the MVP
acceptance scenario end to end: an approved company and distributor with
onboarding profiles and approved mock KYC, a brand, an approved product with two
variants, a warehouse, two stocked batches, two approved offers, a farmer with a
default address, an operations manager, a promoter and a delivery partner. It is
idempotent and prints the mock-auth headers for every demo role when it finishes.

Demo marketplace pincode: `302001`. The demo seed is development data only and
refuses to run with `NODE_ENV=production`.

## Development

```bash
npm run dev:api
npm run dev:web
```

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

Integration tests need PostgreSQL and Redis running with `DATABASE_URL` and
`REDIS_URL` set. `test/integration/mvp-acceptance.spec.ts` drives the whole
acceptance scenario from `docs/PRODUCT_REQUIREMENTS.md` section 30 through the
HTTP API and is the fastest way to confirm that Phase 1 through Phase 4E still
compose after a change.

## Current Boundary

Phase 4E implements company-owned catalogue foundations, distributor-owned warehouses, batch inventory, append-only stock movements, distributor offer foundations, public read-only marketplace product discovery, API-backed farmer product browsing, richer offer status operations, inventory ageing reports, farmer profile/address APIs, farmer-owned cart APIs, idempotent cart checkout, parent product checkout records, distributor-split child product orders, order status history, append-only inventory reservation movements, backend-confirmed mock payment intents/events, farmer-owned cancellation with append-only reservation release, distributor fulfilment order accept/reject transitions, picking/packing transitions, packed-order invoice snapshot generation, invoiced-order dispatch readiness, delivery assignment, out-for-delivery transition and backend mock OTP delivery completion. It does not implement real payment provider capture, production payment webhooks, real SMS/WhatsApp notifications, geotagged proof capture, delivery payouts, finance ledger, settlement, refunds, invoice PDFs, private document storage or Tally write-back.
