# Vardhnam Agrotech Marketplace Product Requirements

## 1. Product Overview

Vardhnam Agrotech is a managed agriculture marketplace connecting farmers with verified agriculture-product companies, authorised distributors, promoters, service providers and delivery partners.

The platform enables farmers to register with minimal friction, manage farm and crop profiles, discover agriculture products by crop, brand, category and problem, buy from authorised distributor offers, track orders, download invoices, request support, request returns and book agriculture services.

The platform enables agriculture companies to create and manage master catalogue data for their brands, submit product documents, track approved products and review demand reports.

The platform enables distributors to maintain warehouses, batches, stock, product offers, serviceable pincodes, pricing, order acceptance, packing, invoice generation and settlement visibility.

The platform enables promoters, sales partners, service providers and delivery partners through one role-based partner application.

The platform enables Vardhnam teams to run approval workflows, customer support, fulfilment operations, commissions, settlements, audit logs and reporting.

## 2. Product Vision

The long-term vision is to become an agriculture operating system for Vardhnam distribution, sales, fulfilment and farmer-service network. The MVP must begin with a controlled marketplace foundation and avoid national-scale optimisation until the pilot model is validated.

## 3. Initial Geographical Scope

The MVP supports a controlled pilot in one district or a limited group of pincodes. The domain model must not hardcode one district; serviceability must remain data-driven through pincodes, warehouses, distributor offers and service areas.

## 4. Platform Applications

### 4.1 Farmer Mobile Application

Primary users:

- Farmers
- Buyers purchasing on behalf of a farm, where legally and operationally permitted

Core capabilities:

- OTP registration and login
- Farmer profile
- Farm and crop profile
- Address management
- Location and pincode detection
- Crop-wise, brand-wise and category-wise product browsing
- Product search
- Product details
- Seller and fulfilment information
- Cart and checkout
- Payment status
- Order tracking
- Invoice download
- Cancellation
- Return request
- Refund tracking
- Support ticket
- Product review
- Service browsing and booking
- Hindi and English localisation
- WhatsApp and phone-support access

### 4.2 Partner Mobile Application

One application with interfaces determined by logged-in role.

Supported partner roles:

- Promoter
- Sales partner
- Service provider
- Delivery partner

Promoter and sales-partner capabilities:

- KYC
- Assigned territory
- Farmer lead creation
- Farmer onboarding
- Farmer crop and acreage survey
- Assisted ordering
- Referral or attribution code
- Visit record
- Geotagged attendance where authorised
- Daily targets
- Order attribution
- Commission statement
- Approved payout statement
- Training material
- Complaint escalation

Service-provider capabilities:

- KYC
- Service-provider profile
- Licences and documents
- Equipment details
- Service catalogue
- Pricing
- Serviceable locations
- Availability calendar
- Booking acceptance or rejection
- Farmer contact and farm location
- Before-service evidence
- Service completion evidence
- Acreage confirmation
- Service completion OTP
- Ratings
- Earnings and payout statements

Delivery-partner capabilities:

- KYC
- Bank and payout details
- Vehicle details
- Service zone
- Availability status
- Delivery assignment
- Pickup acceptance
- Package QR scan
- Pickup proof
- Navigation
- Farmer calling
- Delivery OTP
- Geotagged proof of delivery
- Failed-delivery reason
- Return pickup
- COD ledger where enabled
- Earnings and payout statements

### 4.3 Business Web Portal

One role-based portal supports companies, distributors, Vardhnam administrators, operations, finance, support and catalogue reviewers. Each role must see only authorised data and actions.

## 5. Organisation Model

Organisations represent Vardhnam internal units, agriculture companies, distributors and service-provider businesses. Users may belong to multiple organisations with different roles. Resource-level access must be checked against organisation membership.

## 6. Onboarding and Verification

The platform must support onboarding for farmers, promoters, companies, distributors, service providers and delivery partners. Business onboarding must support KYC documents, verification status, approval, rejection and audit logs.

MVP onboarding should be intentionally simple while preserving verification history and future compliance fields.

## 7. Product Catalogue

Companies own master product catalogue data. Vardhnam administrators or catalogue reviewers approve product listings before publication. Product variants must represent pack sizes, units and regulated/compliance information where applicable.

Distributor offers are separate from product masters. The distributor offer contains seller-specific commercial and fulfilment data, including price, quantity, batch, warehouse, pincode serviceability and delivery SLA.

Operational teams and authorised distributors must be able to pause, reactivate or archive distributor offers without physically deleting them. These status changes must be audited and must affect farmer-visible discovery.

## 8. Inventory and Batch Management

Inventory is distributor- and warehouse-specific. Batch-managed products must track manufacturing date, expiry or validity date, germination information where applicable and blocked/expired status.

Inventory movements are append-only. Sellable availability is derived from inventory movements, reservations, expiry rules and blocked stock.

Phase 2E adds low-stock, expiring-batch and ageing reports for operations teams. These reports are read-only and do not create reservations, orders or financial records.

## 9. Search and Discovery

Farmers should browse and search by crop, brand, product category, problem and serviceable location. Search results must show actual seller and expected delivery information once an offer is selected.

Phase 2D implements the first farmer-safe discovery foundation: public read-only product listing and detail APIs filtered by serviceable pincode, approved catalogue, approved distributor offers and backend-derived availability. Cart, checkout, order allocation and payment remain separate future workflows.

## 10. Distributor Allocation

Allocation should:

1. Exclude ineligible offers.
2. Prefer available local inventory.
3. Prefer fewer child orders where commercially reasonable.
4. Consider delivery SLA.
5. Consider total payable amount.
6. Consider distributor operating status.
7. Record the allocation reason.

## 11. Cart and Checkout

Cart and checkout must support multi-distributor fulfilment. One farmer checkout may create multiple child product orders. Each child order has one seller, one invoice and one independently traceable fulfilment lifecycle.

Phase 3A implements the cart foundation only: farmer profile, farmer addresses, one active farmer cart, cart item validation against approved offers and backend-generated price/availability snapshots. Cart items do not reserve inventory and do not create checkout, payment, order, delivery, finance, settlement or Tally records.

Phase 3B implements idempotent checkout from the authenticated farmer cart, parent product checkout records, distributor-split child product orders, backend-calculated order totals, order status history and batch-level inventory reservation movements. Phase 3B does not implement payment capture, delivery execution, invoices, finance ledger entries, settlements or Tally records.

Phase 3C implements mock-only payment intent creation, backend mock payment confirmation, payment event history and checkout/child-order payment status transitions. Phase 3C does not implement real payment provider capture, production payment webhooks, delivery execution, invoices, finance ledger entries, settlements or Tally records.

Phase 3D implements farmer-owned cancellation for eligible unpaid or payment-failed checkouts/orders and releases reserved inventory through append-only inventory movement records. Phase 3D does not implement delivery execution, invoices, finance ledger entries, settlements, refunds or Tally records.

## 12. Product-Order Lifecycle

Product orders must use explicit states and valid transitions. Status history must record actor, timestamp, reason and request/correlation ID where applicable.

Initial product-order states include `DRAFT`, `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAYMENT_FAILED`, `CONFIRMED`, `DISTRIBUTOR_ACCEPTED`, `DISTRIBUTOR_REJECTED`, `INVENTORY_RESERVED`, `READY_TO_PACK`, `PACKED`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `CANCELLATION_REQUESTED`, `CANCELLED`, `RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `RETURN_IN_TRANSIT`, `RETURNED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED` and `CLOSED`.

## 13. Payments

The MVP uses a mock or sandbox payment flow only. Frontend redirects must not be treated as proof of payment. Payment status must be confirmed server-side. Payment webhook handling must be idempotent and signature verification must exist before production provider use.

Phase 3C uses a backend mock payment intent instead of a real provider. Creating and confirming mock payment intents requires idempotency keys and farmer ownership checks. Successful mock confirmation marks the checkout `PAID` and child product orders `CONFIRMED`; failed mock confirmation marks them `PAYMENT_FAILED`. Payment failure does not release reserved inventory by itself. Phase 3D cancellation requires idempotency keys and farmer ownership checks, then releases original reservations through positive `RELEASED_FROM_ORDER` inventory movements.

## 14. Invoicing

The distributor is normally the seller of record and invoices the farmer. Vardhnam marketplace charges, fulfilment charges and commissions must be represented separately from the distributor invoice.

Phase 4C implements basic product invoice generation for packed child product orders. WP-15A extends it with active-variant HSN/GST metadata, immutable checkout-time tax snapshots, verified seller and place-of-supply state inputs, tax-inclusive CGST/SGST or IGST extraction in integer paise, and a transactional sequential number per distributor and Indian financial year. Each child order may have one immutable invoice snapshot containing those tax fields plus distributor seller details, farmer name, delivery address, item lines and reservation batch references. The implementation remains sandbox-only until chartered-accountant approval and does not yet implement invoice PDFs, credit notes, dispatch, delivery assignments, refunds, settlements or Tally sync.

## 15. Fulfilment and Delivery

Fulfilment may be distributor-led, Vardhnam-assisted or delivery-partner executed depending on approved operational rules. Delivery completion may require OTP, proof of delivery and geolocation where authorised.

Phase 4D implements dispatch readiness for packed child product orders that already have a generated invoice. Dispatch readiness creates one dispatch snapshot, moves the child order to `READY_FOR_PICKUP`, and does not assign delivery partners, create delivery OTPs, send notifications, post finance ledger entries, settle parties, refund payments or write Tally data.

Phase 4E implements local/mock delivery assignment and OTP completion for ready-for-pickup child product orders. It creates one delivery assignment snapshot, stores only OTP hash/salt metadata, moves assigned deliveries through `OUT_FOR_DELIVERY` to `DELIVERED`, and exposes a transient mock OTP in the assignment response for development. Phase 4E does not send real SMS/WhatsApp messages, capture geotagged proof, calculate delivery payouts, post finance ledger entries, settle parties, refund payments or write Tally data.

The later WP-12 delivery slice adds permission-aware foreground location proof at OTP completion. Granted location records coordinates, device accuracy and capture time; denied or unavailable location is recorded explicitly and does not block OTP completion. Photo proof remains deferred until authorised private file storage is available.

WP-12 also makes `DELIVERY_FAILED` reachable through controlled reason codes and backend-owned retry scheduling. Only the assigned partner or authorised operations actor may record failure or start a due retry; each retry issues a fresh hashed delivery OTP and retains order history and audit evidence.

WP-12 return pickup uses a separate assignment lifecycle. Operations assigns an approved return to an active, online delivery partner; the assigned partner accepts or reason-rejects it and records collection. Collection atomically moves the return and seller child order to their in-transit states with history, audit and farmer notification. Partner access is own-scoped and does not expose another partner's return work.

## 16. Promoter and Sales Attribution

A promoter may help a farmer order, but the transaction remains between farmer and distributor. Only one primary promoter or sales-attribution record may receive standard sales commission unless an approved commission rule explicitly allows otherwise.

## 17. Commissions, Charges and Settlements

Financial entries must separate farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, taxes, refund, adjustment and settlement. Commission normally becomes final only after delivery and return/dispute window completion.

## 18. Returns, Refunds and Disputes

Returns and refunds must be auditable. Products must not automatically return to sellable inventory without inspection. Refunds and commission reversals must be represented through financial ledger entries.

## 19. Service Marketplace

Service bookings are separate from product orders and use separate availability, pricing and lifecycle models. Possible service types include drone spraying, soil testing, farm machinery, seed treatment, agronomy visit, harvesting and transportation.

Service booking lifecycle includes `REQUESTED`, `QUOTED`, `ACCEPTED`, `SCHEDULED`, `PROVIDER_EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `FARMER_CONFIRMED`, `CANCELLED`, `DISPUTED`, `REFUNDED` and `CLOSED`.

## 20. Notifications

Notifications must use an abstraction for push notifications, SMS, WhatsApp, email and in-app notifications. Development environments must use mock or sandbox providers.

## 21. Support and Grievance Management

Support tickets must connect users, orders or bookings, categories, priority, evidence, SLA, assigned agent, status, resolution and escalation. Ticket statuses include `OPEN`, `ASSIGNED`, `WAITING_FOR_CUSTOMER`, `WAITING_FOR_SELLER`, `ESCALATED`, `RESOLVED`, `CLOSED` and `REOPENED`.

## 22. Reporting and Dashboards

Dashboards must cover Vardhnam, company, distributor and partner views. Operational action lists are more important than decorative charts. Exports must be permission-controlled and high-risk exports must be logged.

Kisan Club pilot intelligence must provide permission-protected aggregate acreage by crop and district, crop-cycle status and sowing-window distribution, plus current promoter capacity and coordination-outcome indicators. It must not expose farmer identities or precise farm coordinates. Demand forecasting must remain explicitly unavailable until sufficient completed-season conversion history exists.

## 23. Tally Integration

Tally integration is required but must not block initial marketplace development. Create an accounting integration abstraction supporting party masters, item mapping, vouchers, invoices, credit notes, receipts, settlements, commission invoices, sync status, retry, error logs and reconciliation. Do not directly modify real Tally production data during development.

## 24. Non-Functional Requirements

- Common API read requests should target under 500 ms at normal pilot load.
- Product search should target under 2 seconds.
- Checkout must favour correctness over speed.
- Long-running tasks should use background jobs.
- Mobile screens must remain usable on slower networks.
- External-provider downtime must be handled gracefully.
- Background jobs need retry and dead-letter handling.
- Health-check endpoints, structured logging and correlation IDs are required.
- API, workers, notifications, search, webhooks and reporting should be horizontally scalable.
- No important user-facing UI string should be hardcoded directly into components.
- English and Hindi are required from MVP.
- Accessibility must include clear typography, sufficient tap targets, screen-reader labels where practical and simple form errors.

## 25. MVP Scope

The MVP must include authentication, user and organisation onboarding, role-based access, company onboarding, distributor onboarding, farmer onboarding, promoter onboarding, product master catalogue, catalogue approval, distributor offers, warehouses, inventory and batch management, farmer browsing, cart, checkout, multi-distributor child orders, mock payment flow, distributor order management, basic invoice generation, basic fulfilment workflow, delivery assignment and completion, promoter attribution, basic commissions, basic settlements, cancellation, return request, support tickets, audit logs, basic reports, Hindi and English localisation and seeded demonstration data.

## 26. Out of MVP Scope

Do not include credit, lending, buy-now-pay-later, insurance, carbon credits, satellite crop monitoring, automated AI crop diagnosis, automated pesticide prescription, complex dynamic pricing, national multi-warehouse optimisation, blockchain, cryptocurrency, company-owned consignment stock, automated real-bank settlements, real Tally write-back, advanced route optimisation or multi-level marketing commissions unless separately approved.

## 27. Development Phases

Phase 0: foundation, repository scaffold, architecture documents, Docker local environment, database, authentication skeleton, CI, logging, testing setup, OpenAPI, seed-data framework.

Phase 1: users, organisations, memberships, roles, permissions, company onboarding, distributor onboarding, approval workflow, audit logs.

Phase 2: brands, products, variants, product documents, catalogue approval, warehouses, batches, inventory movements, distributor offers, farmer-safe public discovery, offer operations and inventory ageing reports.

Phase 3: farmer profile, addresses, product discovery, cart, offer allocation, checkout, parent checkout, child orders, mock payment, inventory reservation and cancellation. Phase 3A completes farmer profile, address and cart foundations. Phase 3B completes checkout, parent checkout, child product order and inventory reservation foundations. Phase 3C completes mock payment intent and backend confirmation foundations. Phase 3D completes order cancellation and reservation release foundations. The farmer mobile product discovery screen calls the public marketplace API for pincode, category and search-filtered product browsing.

Phase 4: distributor fulfilment, distributor order dashboard, accept/reject, picking, packing, invoice, dispatch, delivery assignment, delivery OTP. Phase 4A completes distributor-facing order list/detail APIs, confirmed-order accept/reject transitions and business portal order actions. Phase 4B completes accepted-order ready-to-pack and packed transitions plus business portal picking/packing actions. Phase 4C completes packed-order invoice snapshot generation and business portal invoice display/actions. Phase 4D completes invoiced packed-order dispatch readiness and business portal dispatch display/actions. Phase 4E completes mock delivery assignment, out-for-delivery transition and backend OTP delivery completion. Phase 4E does not send real notifications, calculate payouts, create refunds, settlements, invoice PDFs, finance ledger entries or Tally records.

Phase 5: payment ledger, commission rules, promoter attribution, distributor payable, settlements, refunds, reconciliation.

Phase 6: promoter app, delivery partner app, service provider, service listings, service bookings, earnings and payouts.

Phase 7: notification providers, payment provider sandbox, Tally export/sync abstraction, dashboards, inventory ageing, demand reports.

## 28. MVP Acceptance Scenario

The MVP is successful when an administrator approves a company and distributor, the company submits a product, the administrator approves it, the distributor creates a warehouse and batch inventory, activates an offer, a promoter registers a farmer, the farmer logs in, sees the product for their pincode, adds it to cart, the system assigns the distributor, the farmer completes mock payment, inventory is reserved, the distributor accepts and packs the order, an invoice is generated, a delivery partner receives and completes the assignment through OTP, the order becomes delivered, distributor payable and marketplace commission are calculated, promoter commission becomes provisional, the return window is completed, commission and settlement become eligible, and important actions are visible in the audit log.

## 29. Kisan Club

Kisan Club is a free programme inside the existing marketplace, not a separate marketplace or subscription. A farmer explicitly accepts a versioned terms document to join. Advisory, marketing and precise-location consent are independent and optional; declining any of them must not block membership. Membership begins as `PENDING_PROFILE` and uses a non-sequential display member number while all API resource access uses UUIDs. A platform kill switch hides all Club routes with a not-found response when the programme is disabled.

Club farmers may maintain farmer-owned farms, controlled-reference crop cycles and an append-only activity diary. Precise farm coordinates require explicit location consent. An actively assigned promoter may submit the same validated survey on the farmer's behalf. Completing the first crop cycle advances the member to `AWAITING_PROMOTER`. Eligible local promoters are assigned through an explainable deterministic matcher or an audited operations choice; assignment activates the membership and drives the existing single promoter-attribution record.

The Club catalogue contains deliberately enrolled, approved Vardhnam-owned products with optional regional, variant and availability-window scope. Discovery continues to show current approved distributor offers and stock; programme enrolment never changes the seller or invoice issuer. Active members receive backend-evaluated, usage-limited Club benefits where an active rule matches. Vardhnam funds the benefit separately: the distributor's gross goods value, invoice basis, payable basis and marketplace-commission basis do not shrink. Cart estimates are non-binding; checkout re-evaluates and records the final redemption, farmer payable and subsidy ledger movement atomically.

After successful payment, each eligible Club child order with an active member-promoter relationship receives a promoter coordination assignment. Its lifecycle is independent from the legal product order and delivery proof. Promoters may acknowledge, coordinate readiness and farmer contact, and report completion or failure; operations may explicitly reassign or cancel. Physical delivery, OTP proof and delivery earnings remain in the existing authorised delivery-partner workflow. Advisory remains a later additive work package.
