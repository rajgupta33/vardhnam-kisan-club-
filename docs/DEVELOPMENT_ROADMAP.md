# Development Roadmap

> **Status note (2026-08-23):** This file is a chronological build log, not a
> current backlog. For the authoritative current state and remaining work, read
> the 2026-08-23 snapshot in `docs/HANDOVER.md` and
> `docs/REMAINING_IMPLEMENTATION_PLAN.md`. Later completion notes supersede older
> “remaining” or “not started” bullets retained below.

## Phase 0 - Foundation

- Repository scaffold
- Architecture documents
- Local Docker configuration
- PostgreSQL and Redis configuration
- NestJS API skeleton
- Next.js business web skeleton
- Flutter farmer and partner app skeletons
- Prisma setup
- Health and readiness endpoints
- Environment validation
- Structured logging
- Global API validation
- Standard API error format
- OpenAPI setup
- Unit and integration test setup
- Lint, formatting and type-check setup
- GitHub Actions CI
- `.env.example`
- Seed-data framework
- Initial audit-log infrastructure
- Initial user, organisation and membership models

## Phase 1 - Organisations and Access

- Completed Phase 1A: users, organisations and memberships
- Completed Phase 1A: role and permission enforcement
- Completed Phase 1A: approval-ready organisation review and audit flows
- Completed Phase 1B: company onboarding detail model and API
- Completed Phase 1B: distributor onboarding detail model and API
- Completed Phase 1B: KYC document metadata lifecycle and reviewer audit flow
- Completed Phase 1B: derived company/distributor onboarding approval queue API
- Completed Phase 1C: business portal onboarding queue connected to backend APIs
- Completed Phase 1C: company/distributor onboarding detail views
- Completed Phase 1C: KYC metadata review and organisation approval/rejection actions
- Completed Phase 1C: audit log portal views and onboarding integration test coverage
- Remaining Phase 1: connect a real OTP transport and replace demo identities/data with approved pilot onboarding data before production

## Phase 2 - Catalogue and Inventory

- Completed Phase 2A: company-owned brands, master products and variants
- Completed Phase 2A: product document metadata
- Completed Phase 2A: catalogue submission statuses and approval/rejection audit flows
- Completed Phase 2A: catalogue review queue/detail APIs and business portal review views
- Completed Phase 2B: distributor-owned warehouses
- Completed Phase 2B: batch metadata linked to approved product variants
- Completed Phase 2B: append-only inventory movements and audited stock adjustments
- Completed Phase 2B: business portal inventory and warehouse views
- Completed Phase 2C: distributor-owned offers linked to approved products, variants, warehouses and optional batches
- Completed Phase 2C: offer pricing in paise, fulfilment mode, serviceable pincodes and inventory-derived availability
- Completed Phase 2C: distributor offer submission, approval/rejection audit flows and business portal offer review views
- Completed Phase 2D: public read-only marketplace product listing and detail APIs
- Completed Phase 2D: pincode, category, brand and search filters over approved catalogue and approved offers
- Completed Phase 2D: farmer-visible seller, fulfilment and backend-derived availability metadata
- Completed Phase 2D and later farmer UI work: API-backed, filterable, paginated marketplace discovery and product detail with internal-test pack shots
- Completed Phase 2E: offer pause, reactivation and archive operations with audit history
- Completed Phase 2E: low-stock, expiring-batch and inventory ageing report APIs
- Completed Phase 2E: business portal inventory ageing view and offer operation controls
- Remaining Phase 2: pilot seed data and reporting refinements

## Phase 3 - Farmer Commerce

- Completed Phase 3A: farmer profiles and addresses
- Completed Phase 3A: authenticated farmer-owned cart foundation
- Completed Phase 3A: cart item validation against approved offers, serviceable pincodes and inventory-derived availability
- Completed Phase 3A: backend-generated cart price and availability snapshots
- Completed Phase 3A and later farmer UI work: backend-authoritative cart with seller grouping, quantity controls and revalidation
- Completed Phase 3B: idempotent checkout from authenticated farmer cart
- Completed Phase 3B: parent product checkout and distributor-split child product orders
- Completed Phase 3B: product order status history and farmer-owned order read APIs
- Completed Phase 3B: append-only batch-level inventory reservation movements
- Completed Phase 3B and later farmer UI work: checkout review and idempotent seller-split order creation
- Completed Phase 3C: idempotent backend mock payment intent creation
- Completed Phase 3C: backend mock payment confirmation with checkout and child order status transitions
- Completed Phase 3C: mock payment event history, audit logs and farmer-owned payment read APIs
- Completed Phase 3C and later farmer UI work: explicit mock-payment success/failure/retry flow with authoritative refresh
- Completed Phase 3D: farmer-owned checkout and child-order cancellation APIs for eligible unpaid or payment-failed records
- Completed Phase 3D: append-only inventory reservation release movements and cancellation audit logs
- Completed Phase 3D and later farmer UI work: idempotent checkout/child-order cancellation and lifecycle-aware order surfaces
- Completed Phase 3: API-backed farmer product discovery UI

## Phase 4 - Distributor Fulfilment

- Completed Phase 4A: distributor-facing fulfilment order list/detail APIs
- Completed Phase 4A: confirmed-order accept/reject transitions with status history and audit logs
- Completed Phase 4A: business portal product order dashboard and accept/reject detail actions
- Completed Phase 4B: accepted-order ready-to-pack and packed transitions with status history and audit logs
- Completed Phase 4B: business portal picking and packing actions
- Completed Phase 4C: packed-order invoice snapshot generation with audit logs
- Completed Phase 4C: business portal invoice action and invoice summary
- Completed Phase 4D: invoiced packed-order dispatch readiness with audit logs
- Completed Phase 4D: business portal ready-for-pickup action and dispatch summary
- Completed Phase 4E: delivery assignment, out-for-delivery and OTP delivery completion foundations with audit logs
- Completed Phase 4E: business portal assignment, out-for-delivery and completion actions with delivery assignment summary
- Completed Phase 4F: Phase 4A-4E integration coverage for accept/reject, picking, packing, invoicing, dispatch, delivery assignment and OTP completion
- Completed Phase 4F: fulfilment state-machine, cross-distributor isolation, delivery-partner RBAC and OTP failure coverage
- Completed Phase 4F: end-to-end MVP acceptance spec driving PRODUCT_REQUIREMENTS section 30 through the HTTP API
- Completed Phase 4F: idempotent demo seed for the acceptance scenario (`npm run seed:demo`)
- Completed Phase 4F: `DELIVERY_PARTNER` organisation type (see `docs/DECISIONS/0002-organisation-type-naming.md`)
- Future: real notification transport, authorised photo proof, push registration and COD only if explicitly approved; payout and core partner delivery workflows are implemented

## Phase 1D - Authentication

- Completed Phase 1D: OTP challenge model with hashed codes, expiry and attempt limits
- Completed Phase 1D: JWT access tokens, persisted rotatable refresh tokens, logout
- Completed Phase 1D: organisation selection for multi-organisation users
- Completed Phase 1D: rate limiting on OTP endpoints and authentication integration coverage
- Remaining Phase 1D: real SMS/WhatsApp OTP delivery (`mockOtpCode` is returned only while `SMS_PROVIDER=mock`)

## Phase 5 - Finance

- Completed Phase 5: commission rules with status lifecycle and applicability resolution
- Completed Phase 5: commission entries auto-created on delivery, provisional to final after the return window, with explicit reversal
- Completed Phase 5: financial ledger separating farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee and promoter commission
- Completed Phase 5: settlement creation with generated settlement numbers, status lifecycle and audit
- Remaining Phase 5: connect the selected real payment/refund provider and signed refund-status webhook; returns/refunds/disputes and provider-neutral reconciliation are implemented

## Phase 6 - Partner Network

- Completed Phase 6: promoter attribution create/revoke/list with the single-primary-attribution rule and a promoter commission ledger entry type
- Completed Phase 6: payout accounts with self-service upsert, admin verification and partner earnings statements
- Completed Phase 6: delivery fee support in the financial ledger
- Completed Phase 6 foundation: the shared partner Flutter shell now has OTP authentication, secure session refresh, multi-membership selection, English/Hindi localisation and strict role routing for promoters, sales partners, service providers and delivery partners.
- Completed Phase 6 delivery slices: a delivery partner manages audited organisation-scoped online/offline availability; only online partners can receive new assignments; assigned partners can list/read only their own work, explicitly accept or reason-reject it, verify seller-issued package QR pickup, open navigation/calling handoffs, mark verified work out-for-delivery and complete delivery with the farmer OTP. Completion records permission-aware geotag proof (granted, denied or unavailable) without blocking the OTP path. Operations can auditably reassign rejected work to a different online partner with a fresh OTP.
- Remaining Phase 6: shared partner KYC submission, authorised photo delivery proof after WP-08 storage exists, service provider workflows, service listings and service bookings (WP-14). Structured failed-delivery reason and due-only retry with a fresh OTP are complete. Return-pickup assignment, partner response and collection are also complete. Promoter-assisted farmer registration verifies the farmer's OTP without exposing farmer session tokens and immediately applies the existing lead-conversion attribution rule. General promoter territory assignment preserves the shared Club profile as one source of truth while remaining independently permissioned and organisation-scoped. General farm/crop surveys now authorize through active attribution, remain independent of Club membership and intentionally omit precise location. Append-only promoter visit logging is complete for owned leads and actively attributed farmers, with bilingual history, controlled purposes and explicit one-time permission-aware location capture.

## Phase 7 - Integrations and Analytics

- Completed Phase 7: notification abstraction with channels, categories, payload snapshots, attempts, statuses and read receipts (mock delivery only)
- Completed Phase 7: Tally sync abstraction with sync records, attempts, retry state and a reconciliation endpoint (mock provider only)
- Completed Phase 7: permission-scoped dashboard summary API with audited export
- Completed cross-cutting: support ticket lifecycle (create, assign, wait, resume, escalate, resolve, close, reopen) with evidence
- Remaining Phase 7: connect business-selected notification/payment providers and credentials; dashboard portal wiring is complete, while demand forecasting remains deferred until sufficient completed-season history exists

## Phase 8 - Platform infrastructure

- Completed WP-04 (2026-08-17): BullMQ queues consumed by a separate worker process, correlation-ID-carrying job envelopes, exponential-backoff retry, per-queue dead-letter queues with audited operator replay, `ADMIN`-only `/admin/jobs` surface behind new `jobs:read`/`jobs:manage` permissions, and `/health/ready` queue reporting.
- Completed WP-04: scheduled commission finalisation, inventory batch expiry, OTP challenge cleanup and refresh-token pruning. `support-sla-breach-sweep` moved to WP-06 (it needs a breach flag and a notification to be worth persisting); `return-window-sweep` dropped as redundant.
- Completed WP-08 (2026-08-17): `StoredFile` model, storage provider abstraction with a working local provider that mimics presigned-URL semantics, direct-to-storage upload/download, per-purpose content-type and size policy validated at issue and again against the stored object, scan-gated availability on the `documents` queue, audited permission-checked downloads, and a documented retention policy. A cloud provider awaits the hosting decision; the factory throws rather than falling back to local disk.
- Completed WP-06 (2026-08-18): per-channel notification provider abstraction, delivery worker on the `notifications` queue with retry and dead-lettering, a minute-interval dispatch sweep that required no producer changes, per-channel templates with language-aware SMS segment limits, recipient preferences protecting transactional categories, and OTPs routed through the SMS transport without ever being persisted as notification rows. All transports remain mock pending a BSP account.
- Completed 2026-08-18: scheduled Kisan Club advisory generation, closing the temporary manual-trigger boundary recorded in `docs/DECISIONS/0009-advisory-content-governance.md`.
- Completed 2026-08-18: Kisan Club demo seed data — an active membership with assigned promoter and territory, a farm and active wheat crop cycle, a Vardhnam-owned Club product with stock and a live offer, a platform-funded benefit rule and an approved bilingual advisory. See `docs/FARMER_APP_TESTING_GUIDE.md`.
- Remaining Phase 8: real SMS, WhatsApp, push, email, payment/refund and cloud-storage adapters await business-selected providers, credentials and hosting decisions. The provider-neutral payment-webhook handler is implemented.

## Open or deferred work (current wording supersedes historical bullets)

- Service marketplace (WP-14)
- Partner remainder: shared KYC submission, authorised photo proof, push registration, consented attendance/targets/training, COD only if approved, and service-provider workflows after WP-14
- Product reviews and ratings
- ~~File and document storage~~ - completed 2026-08-17, see Phase 8 above (WP-08)
- ~~Background job infrastructure~~ - completed 2026-08-17, see Phase 8 above (WP-04)
- Distributor allocation engine with recorded allocation reasons (WP-15)
- GST engineering and invoice/credit-note PDFs are implemented; chartered-accountant approval of classifications, rounding and legal templates remains open (WP-15)
- Mobile runtime internationalisation is complete; business-portal Hindi remains open (WP-11r)
- Deployment is partial: containerisation and API hardening are implemented; registry/orchestration, secrets, TLS/ingress, shared rate limits, observability and backup/restore remain open (WP-16)

# Kisan Club delivery status

- KC-01 membership foundation: completed 2026-08-11.
- KC-02 farm and crop registry: completed with dedicated-database integration coverage.
- KC-03 promoter territories and assignments: completed with dedicated-database integration coverage.
- KC-04 Club catalogue programmes: completed with dedicated-database integration coverage.
- KC-05 Club pricing and finance: completed, including benefit administration/evaluation, checkout redemption, platform subsidy ledger treatment and refund-safe allocation, with dedicated-database integration coverage.
- KC-06 Club fulfilment coordination: completed and dedicated-database verified 2026-08-14, including payment-confirmation assignment creation, scoped promoter queues, audited state transitions, explicit operations reassignment and independence from the seller order state machine.
- KC-07 benefit tokens and assisted purchase: completed with one-time hashed bearer tokens, expiry/attempt/replay controls, active-promoter resource scope, live checkout revalidation, normal inventory reservation, mandatory in-app payment and dedicated-database integration coverage.
- KC-08 farmer app Club module: completed and Flutter-verified 2026-08-14. The bilingual, membership-aware module includes dashboard gating, free join and resumable farm-profile completion, Club home/catalogue/detail and normal seller-offer commerce reuse, farmer-owned farms and crop cycles with activity/harvest recording, assigned-promoter visibility, consent-gated advisories, one-time benefit-token issuance, and duplicate-safe paginated token history with exact backend status filtering. Financial values and token lifecycle decisions remain backend-authoritative.
- KC-09 advisory: completed 2026-08-13. Human-authored bilingual rule versioning, independent agronomist approval, deterministic crop-stage matching, consent-gated farmer events, localised in-app notifications, farmer read/dismiss flows and the permission-filtered business portal workspace are implemented. Focused HTTP/database acceptance coverage passes against a dedicated PostgreSQL test database.
- KC-10 partner app Club module: completed and Flutter-verified 2026-08-14. KC-10A through KC-10D provide promoter/sales-partner-only navigation, backend-scoped assigned-farmer list/detail, allowlisted farm/crop presentation, idempotent one-time benefit-token redemption into a pending-payment assisted checkout, own-scope Club fulfilment inbox/detail/history with backend-validated coordination transitions, audited assigned-farmer farm/current-crop survey submission without precise-location collection, and recipient-scoped commission/payout statements using backend totals plus masked own-account status. Shared payout-account setup remains WP-12 rather than KC-10.
- KC-11 business portal: completed 2026-08-14. Permission-filtered advisory, member, field-network, commercial and Club fulfilment workspaces are implemented. Staff can administer members, territories, promoter eligibility/capacity, Vardhnam-only product programmes and platform-funded benefit rules; authorised staff and assigned promoters can operate the separately scoped coordination queue. Programme/benefit rules, financial calculations, coordination transitions and the distributor seller-order lifecycle remain backend-authoritative.
- KC-12 Club intelligence: completed 2026-08-14. Permission-protected crop/district acreage, season, lifecycle and sowing-month aggregates plus promoter capacity and current-holder coordination indicators are available through typed APIs and an operational-table portal workspace. Farmer identity and precise location are not exposed. Demand forecasting remains deferred until completed-season conversion history exists.
