# Development Roadmap

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
- Remaining Phase 1: production authentication decision and richer seeded demo onboarding data

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
- Completed Phase 2D: farmer mobile product browse skeleton with sample listings
- Completed Phase 2E: offer pause, reactivation and archive operations with audit history
- Completed Phase 2E: low-stock, expiring-batch and inventory ageing report APIs
- Completed Phase 2E: business portal inventory ageing view and offer operation controls
- Remaining Phase 2: pilot seed data and reporting refinements

## Phase 3 - Farmer Commerce

- Completed Phase 3A: farmer profiles and addresses
- Completed Phase 3A: authenticated farmer-owned cart foundation
- Completed Phase 3A: cart item validation against approved offers, serviceable pincodes and inventory-derived availability
- Completed Phase 3A: backend-generated cart price and availability snapshots
- Completed Phase 3A: farmer mobile cart skeleton screen
- Completed Phase 3B: idempotent checkout from authenticated farmer cart
- Completed Phase 3B: parent product checkout and distributor-split child product orders
- Completed Phase 3B: product order status history and farmer-owned order read APIs
- Completed Phase 3B: append-only batch-level inventory reservation movements
- Completed Phase 3B: farmer mobile checkout review skeleton screen
- Completed Phase 3C: idempotent backend mock payment intent creation
- Completed Phase 3C: backend mock payment confirmation with checkout and child order status transitions
- Completed Phase 3C: mock payment event history, audit logs and farmer-owned payment read APIs
- Completed Phase 3C: farmer mobile mock payment preview skeleton screen
- Completed Phase 3D: farmer-owned checkout and child-order cancellation APIs for eligible unpaid or payment-failed records
- Completed Phase 3D: append-only inventory reservation release movements and cancellation audit logs
- Completed Phase 3D: idempotency coverage, integration tests and farmer mobile cancellation preview skeleton
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
- Future: real notification delivery, geotagged proof capture, payout calculation and partner-app delivery workflows

## Phase 5 - Finance

- Payment ledger
- Commission rules
- Promoter attribution
- Distributor payable
- Settlements
- Refunds and reconciliation

## Phase 6 - Partner Network

- Promoter app workflows
- Delivery partner workflows
- Service provider workflows
- Service listings and bookings
- Earnings and payouts

## Phase 7 - Integrations and Analytics

- Notification providers
- Payment provider sandbox
- Tally export and sync abstraction
- Dashboards
- Inventory ageing
- Demand reports
