# Architecture

## Phase 0 Decision

Phase 0 establishes a modular monorepo with one backend API, one business web portal and two mobile application skeletons.

## System Shape

- `apps/marketplace-api`: NestJS REST API with OpenAPI, global validation, standard errors, correlation IDs, JSON logging, Prisma/PostgreSQL, Redis readiness checks, catalogue, inventory, inventory reporting, distributor offer operations, marketplace discovery, farmer profile, cart, checkout, product order, mock payment and cancellation foundations.
- `apps/business-web`: Next.js role-based business portal for onboarding approval queues, catalogue review queues, distributor inventory views, inventory ageing reports, distributor offer operations and review views, KYC metadata review and audit log visibility, with future sections for Vardhnam, companies, distributors, finance, operations and support.
- `apps/farmer-mobile`: Flutter farmer mobile app skeleton with English/Hinglish localisation structure, product browse preview screens, cart preview screens, checkout review preview screens, mock payment preview states and cancellation preview states.
- `apps/partner-mobile`: Flutter partner mobile app skeleton with role-based partner surface.
- `packages/shared-types`: shared TypeScript enums and API response types.
- `packages/validation`: shared validation constants and schemas.
- `packages/api-client`: generated-client destination and lightweight placeholder client.
- `packages/design-tokens`: shared colours, spacing and typography tokens.
- `infrastructure`: local database, Docker and CI documentation.

## Backend

The backend uses NestJS modules instead of route-handler business logic. Foundation through Phase 3D modules:

- `HealthModule`
- `ConfigModule`
- `PrismaModule`
- `RedisModule`
- `AuthModule`
- `AccessModule`
- `IdentityModule`
- `FarmersModule`
- `OrganisationsModule`
- `OnboardingModule`
- `CatalogueModule`
- `InventoryModule`
- `OffersModule`
- `MarketplaceModule`
- `CartModule`
- `CheckoutModule`
- `PaymentsModule`
- `AuditModule`

The API prefix is `/api/v1`. OpenAPI is exposed at `/api/docs` in non-production environments.

## Data

PostgreSQL is the transactional source of truth. Prisma owns schema definition and migrations. Redis is used for future queues, rate limiting, idempotency and short-lived operational state.

## Auth and Permissions

Phase 3D includes a mock development authentication guard that reads explicit headers only when `AUTH_MODE=mock`. This is not production authentication. The guard validates that `x-user-id`, `x-user-role` and `x-organisation-id` match an active user, active organisation and active membership in PostgreSQL for protected APIs. Permission checks use seeded role-permission mappings, including onboarding, KYC, catalogue review, inventory, offer, farmer cart, checkout, farmer order, mock payment and cancellation permissions. Public marketplace discovery routes are read-only and unauthenticated.

## Business Web API Boundary

The business web portal uses `packages/api-client` from server components and server actions. Local mock-auth headers are read from `BUSINESS_WEB_MOCK_USER_ID`, `BUSINESS_WEB_MOCK_ROLE` and `BUSINESS_WEB_MOCK_ORGANISATION_ID`, and are never sent from browser-side code. If the server-side mock-auth configuration is missing or the API is unavailable, the portal renders a blocked state instead of silently bypassing permissions. Through Phase 4E the portal is connected to onboarding, catalogue, inventory, inventory reporting, offer operations, distributor fulfilment order management, invoice snapshot generation, dispatch readiness, delivery assignment/OTP completion and audit review APIs; farmer cart, checkout, payment and cancellation UI belongs to the farmer mobile app.

## Farmer Mobile API Boundary

The Phase 3D farmer mobile browse, cart, checkout review, mock payment and cancellation preview screens are sample-data skeletons for the marketplace discovery, cart, checkout, product order, mock payment and cancellation contracts. API-backed mobile browsing should use the public `MarketplaceModule` endpoints for pincode-filtered product listing and detail data. API-backed cart work should use the protected `CartModule` endpoints. API-backed checkout and cancellation work should use the protected `CheckoutModule` endpoints with an `Idempotency-Key`. API-backed mock payment work should use the protected `PaymentsModule` endpoints with an `Idempotency-Key`. The mobile app must display seller, fulfilment, backend price snapshots, child order grouping, backend reservation metadata, backend payment status and backend cancellation eligibility from responses and must not calculate availability, prices, payment state or inventory release locally.

## External Integrations

Through Phase 4E there is no real SMS, WhatsApp, payment provider capture, production webhook, invoice PDF generation, finance ledger, refund workflow, delivery payout calculation or Tally integration. Product invoice snapshots are stored by the backend only after distributor packing, dispatch readiness is stored only after invoice generation, and delivery completion uses backend-verified local/mock OTP metadata rather than a real notification provider. Future providers must sit behind interfaces and use sandbox/mock mode until production approval.

## Observability

All requests receive or preserve an `x-request-id`. Logs are emitted as JSON with timestamp, level, context and message.
