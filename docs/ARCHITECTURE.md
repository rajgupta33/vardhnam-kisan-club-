# Architecture

## Phase 0 Decision

Phase 0 establishes a modular monorepo with one backend API, one business web portal and two mobile application skeletons.

## System Shape

- `apps/marketplace-api`: NestJS REST API with OpenAPI, global validation, standard errors, correlation IDs, JSON logging, Prisma/PostgreSQL, Redis readiness checks, catalogue, inventory, inventory reporting, distributor offer operations, marketplace discovery, farmer profile, cart, checkout, product order, mock payment and cancellation foundations.
- `apps/business-web`: Next.js role-based business portal for onboarding approval queues, catalogue review, distributor inventory, offers, fulfilment, finance, settlements, support and audit operations.
- `apps/farmer-mobile`: Flutter farmer mobile app with English/Hindi localisation, public API-backed product browse/detail and distributor-offer selection, authenticated farmer profile/address/cart management, idempotent checkout and child-order review, and mock-payment/cancellation preview screens.
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

The backend supports two explicit authentication modes. `AUTH_MODE=mock` reads development-only identity headers and validates them against active users, organisations and memberships. `AUTH_MODE=production` accepts JWT Bearer access tokens issued by password or OTP login, revalidates the membership on every protected request, and supports persisted rotating refresh tokens. Permission checks use seeded role-permission mappings and services still enforce resource ownership. Public marketplace discovery routes remain read-only and unauthenticated.

## Business Web API Boundary

The business portal calls the API from server components and server actions. Password login and organisation selection place access and refresh tokens in secure, same-site, httpOnly cookies; no token is stored in browser storage or exposed to client components. Next.js middleware refreshes near-expiry access tokens through the backend's rotating refresh endpoint, redirects unauthenticated requests, and returns `403` before rendering routes outside the JWT permission set. Navigation is filtered from the same server-side permission claims, while the backend remains authoritative. The portal currently covers onboarding, catalogue, inventory reporting, offers, distributor fulfilment, finance/commissions/ledger/settlements, support and audit.

## Farmer Mobile API Boundary

Farmer mobile bootstrap resolves a supported saved language first, then the device language, then English. When preference storage was read successfully but contains no supported saved choice, a guarded first-launch route requires explicit English or Hindi selection before login, public browsing or restored authenticated routes continue. The choice is persisted in non-sensitive preferences and does not clear a restored secure session. Product browsing and product detail use the public `MarketplaceModule`. Detail navigation preserves the active pincode and displays the returned variants and distributor offers, including seller-of-record identity, GSTIN, fulfilment, SLA, warehouse, batch, public document, price and derived availability fields. Farmer profile, delivery-address management, cart and checkout use protected farmer-owned APIs through a central Dio client that attaches the Bearer access token, serializes refresh-token rotation after `401`, retries each failed request once and invalidates terminal sessions. The cart repository supports load, add/replace offer, quantity update, removal and clear; the UI renders backend-returned item snapshots, line totals and subtotal without financial calculation. Checkout filters owned addresses to the cart pincode, persists an idempotency key across ambiguous failures, submits explicit confirmation, and renders backend-created child orders and batch reservations. Mock payment and cancellation remain sample-data skeletons; their integrations must continue using backend-derived payment and cancellation state.

## External Integrations

External SMS, WhatsApp, payment capture, production webhooks and Tally write-back remain mock or abstracted. The backend now has private file storage, finance ledger, commission, settlement, promoter attribution, payout-account, notification, support, returns/refunds and Tally-sync foundations; refund execution is asynchronous but still mock-only. WP-15A makes the invoice JSON snapshot tax-aware through immutable checkout classification/state inputs, integer tax-inclusive line calculation and transactional seller/FY numbering, while PDF/credit-note output remains open. Tax classifications require chartered-accountant approval. Future providers must sit behind interfaces and use sandbox/mock mode until production approval.

## Observability

All requests receive or preserve an `x-request-id`. Logs are emitted as JSON with timestamp, level, context and message.

## Kisan Club layering

`KisanClubModule` is an additive domain layer inside `marketplace-api`. KC-01 owns membership lifecycle and composes the existing Prisma, authentication, permission and audit modules. It does not duplicate marketplace, checkout, inventory or finance pipelines. `KISAN_CLUB_ENABLED` is checked by a route guard before authentication/permission work and defaults off. Integration tests run serially against a dedicated database; the shared reset helper refuses a `DATABASE_URL` whose database name does not contain `test`.

KC-05 exports a benefit evaluator from `KisanClubModule` for cart display and the existing checkout service. Cart snapshots are non-authoritative. Checkout invokes evaluation and redemption inside its serializable inventory/order transaction. The existing payments service charges the derived farmer payable and the existing finance ledger records platform subsidy separately, while delivery commission and distributor payable continue to consume gross order subtotal. Returns allocate the saved line benefit and refunds append its reversal; no parallel Club checkout, order, invoice or ledger exists.

KC-06 adds a one-to-one coordination overlay after payment confirmation. `PaymentsService` calls the exported Club fulfilment service inside the successful confirmation transaction; the hook short-circuits while Club is disabled, ignores non-Club orders, is idempotent per child order and does not fail an otherwise valid payment when no active promoter relationship exists. Promoter transitions operate only on the Club record. Existing checkout fulfilment and `ProductDeliveryAssignment` remain the sole product-order and OTP/POD authorities.
