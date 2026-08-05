# Vardhnam Agrotech Marketplace - Codex Project Instructions

## 1. Project Purpose

This repository contains the Vardhnam Agrotech managed agriculture marketplace.

The platform connects:

- Farmers
- Agriculture product companies
- Distributors
- Promoters and commission-based sales partners
- Service providers
- Delivery partners
- Vardhnam administrators, operations teams, support teams and finance teams

The platform is not a normal single-seller e-commerce application. It is a multi-sided B2B2C managed marketplace where agriculture companies submit approved product catalogue data, authorised distributors maintain local sellable stock and sell directly to farmers, and Vardhnam manages technology, order allocation, customer experience, commissions, fulfilment and delivery operations.

## 2. Permanent Business Truths

These rules must not be changed without an explicit product decision:

1. The farmer is the buyer.
2. The distributor is normally the seller of record for product orders.
3. The distributor issues the product invoice directly to the farmer using the distributor legal name, GSTIN and other applicable details.
4. The agriculture company is the brand owner and master catalogue owner. It does not automatically become the seller.
5. Vardhnam is the marketplace operator, technology provider, marketing platform and optional fulfilment provider.
6. A company creates or submits a master product listing.
7. Vardhnam administrators review and approve the master product listing before publication.
8. A distributor creates an offer against an approved product.
9. A distributor offer contains distributor-specific information such as selling price, available quantity, batch number, manufacturing date where applicable, expiry or validity date, germination information where applicable, warehouse, serviceable pincodes, delivery SLA and fulfilment mode.
10. One master product may have multiple distributor offers.
11. One farmer checkout may create multiple child orders when products are supplied by different distributors.
12. Each child order must have one seller, one invoice and an independently traceable fulfilment lifecycle.
13. A promoter may assist a farmer in placing an order, but the order remains a transaction between the farmer and distributor.
14. Only one primary promoter or sales-attribution record may receive the standard sales commission for an order unless an authorised commission rule explicitly allows otherwise.
15. Delivery partner earnings are based on completed deliveries and approved operational rules.
16. Service-provider bookings are different from product orders and must use a separate order type and workflow.
17. Vardhnam own products must follow the same seller, inventory, invoice and fulfilment principles as third-party products.
18. Marketplace commission, fulfilment charges, delivery charges and promotional charges must be represented separately in the financial ledger.
19. Commission must normally be finalised only after successful delivery and completion of the applicable return or dispute window.
20. No financial amount may be calculated only on the mobile or web frontend. Financial calculations must be performed and validated by the backend.

## 3. Core Order Types

The system must support the domain-level order types `PRODUCT_ORDER` and `SERVICE_ORDER`.

Do not combine product inventory and service availability into the same database model.

## 4. User Roles

Initial platform roles:

- `FARMER`
- `PROMOTER`
- `SALES_PARTNER`
- `DISTRIBUTOR_OWNER`
- `DISTRIBUTOR_STAFF`
- `COMPANY_OWNER`
- `COMPANY_STAFF`
- `SERVICE_PROVIDER`
- `DELIVERY_PARTNER`
- `SUPPORT_AGENT`
- `OPERATIONS_MANAGER`
- `FINANCE_MANAGER`
- `CATALOGUE_REVIEWER`
- `ADMIN`
- `SUPER_ADMIN`

Implement role-based access control. Where required, also implement resource-level access control. For example, a distributor user must only access orders, offers, invoices and warehouses belonging to that distributor organisation.

## 5. Required Architecture

Use this architecture unless an Architecture Decision Record documents an approved change:

- Backend: TypeScript, NestJS, PostgreSQL, Prisma ORM, Redis, BullMQ or an equivalent queue, REST API, OpenAPI, Docker for local development.
- Business web portal: Next.js, TypeScript, React, reusable component system, server-side permission validation.
- Mobile applications: two Flutter applications, one farmer app and one partner app. The partner app uses role-based interfaces for promoters, sales partners, service providers and delivery partners.
- Shared contracts: generate or maintain typed clients from OpenAPI. Avoid manually duplicating request and response types. Never trust frontend validation alone.

Do not build completely separate company, distributor and admin web portals during the MVP unless there is a demonstrated isolation requirement.

## 6. Required Backend Modules

Maintain clear domain boundaries for identity and authentication, organisations, user membership, RBAC, KYC and business verification, companies and brands, product catalogue, distributor offers, inventory, warehouses, batches, farmer profiles, addresses, cart, checkout, order orchestration, product orders, service bookings, invoices, payments, settlements, commissions, delivery payouts, fulfilment, returns, refunds, disputes, notifications, support tickets, audit logs, reports, accounting integration and Tally integration.

Avoid placing business logic in controllers or route handlers. Use domain services, application services and repositories with clear responsibilities.

## 7. Engineering Rules

- Read relevant documentation before changing code.
- Inspect existing patterns before introducing new patterns.
- Prefer simple, maintainable solutions over clever abstractions.
- Do not add dependencies without explaining why they are required.
- Do not silently change business rules.
- Record significant architecture decisions in `docs/DECISIONS/`.
- Update documentation whenever implementation changes an agreed contract.
- Do not create fake integrations that appear production-ready.
- Clearly label mock, sandbox and placeholder integrations.
- Do not claim that tests passed unless they were executed successfully.
- Use strict TypeScript and avoid `any`.
- Validate all external input.
- Store monetary amounts in paise using integers.
- Never use floating-point arithmetic for financial settlement calculations.
- Store timestamps in UTC.
- Use UUIDs or another approved non-sequential public identifier.
- Add created-at and updated-at timestamps to important entities.
- Do not physically delete financial transactions, invoices, settlements or audit records.
- Use database transactions for inventory reservation, order creation and financial ledger changes.
- Use versioned APIs, starting with `/api/v1`.
- Use consistent error objects and machine-readable error codes.
- Add idempotency support to checkout, payment and webhook endpoints.
- Authenticate webhook signatures.
- Enforce permissions on the server.

## 8. Security Requirements

- Never commit secrets, API keys, private certificates or production credentials.
- Use `.env.example` with placeholder values only.
- Hash passwords using a secure modern password-hashing algorithm.
- Prefer OTP authentication for farmer onboarding.
- Add rate limits to OTP, login and sensitive endpoints.
- Validate uploaded file types and sizes.
- Restrict private documents using signed or authorised URLs.
- Record security-sensitive actions in an audit log.
- Do not store raw card information.
- Use a payment-provider abstraction rather than hardcoding one provider throughout the domain.
- Separate authentication, authorisation and organisation membership.
- Require additional approval for high-risk administrative actions.
- Never put secrets into Codex memory, documentation or screenshots.

## 9. Audit Requirements

Audit records must be append-only for important events including approvals, product listing changes, price changes, stock adjustments, batch changes, order status changes, invoice generation, refund approval, settlement release, commission adjustment, role changes, bank-detail changes and manual administrative overrides.

Each audit record should include actor, actor role, organisation, action, resource type, resource ID, previous value where appropriate, new value where appropriate, timestamp, request or correlation ID and reason for manual override where applicable.

## 10. Financial, Inventory and Order Rules

Use immutable ledger entries for financial movements. Separate farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, taxes, refund, adjustment and settlement.

Inventory is distributor- and warehouse-specific. Batch-managed products must reserve inventory at batch level. Do not allow allocation from expired or blocked batches. Inventory movements must be append-only records.

Do not use arbitrary order status text. Product orders must use an explicit state machine and record every transition with actor, timestamp and reason.

## 11. User Experience Rules

Farmer app: minimal registration, OTP login, Hindi and English, agriculture-friendly terminology, clear seller and delivery information, invoice download, support entry points and low-bandwidth design.

Business portal: role-specific dashboards, operational action lists, persistent filters where useful, authorised CSV exports with audit logging and status indicators that do not rely only on colour.

Partner app: role-specific interface. Do not expose delivery functions to promoters or promoter commissions to delivery partners. Geotagging requires explicit permission.

## 12. Testing and Definition of Done

Every completed feature must include appropriate tests. Critical areas include business rules, database workflows, API permissions, validation, state transitions, finance, inventory concurrency, webhook idempotency and critical mobile flows.

A task is not complete unless acceptance criteria are satisfied, relevant tests pass, linting and type checking pass, migrations are included where required, API documentation is updated, user-facing text is localisable, permissions are enforced server-side, audit requirements are addressed, security impact is considered, documentation is updated, and assumptions and limitations are listed.

## 13. Codex Working Method

For substantial tasks:

1. Read this file and relevant documents.
2. Inspect the repository.
3. State current understanding.
4. Identify assumptions.
5. Produce a concise implementation plan.
6. Identify affected modules.
7. Implement the smallest complete vertical slice.
8. Run tests and quality checks.
9. Review the diff for security and business-rule regressions.
10. Update documentation.
11. Provide a completion summary.

Do not attempt to build the entire marketplace in one uncontrolled change. Break work into reviewable phases and vertical slices.

## 14. Prohibited Actions Without Explicit Approval

Do not deploy to production, purchase services, create paid cloud resources, send real SMS/email/WhatsApp messages, process real payments, modify real Tally data, use real farmer data, delete production-like data, change the seller-of-record model, introduce credit or lending, implement automatic pesticide recommendations, add unapproved AI-generated agronomy advice, circumvent licences or verification, store secrets in the repository, or weaken authentication, permissions, audit logs or tests merely to make a feature pass.

## 15. Authoritative Documents

The following documents are authoritative:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/BUSINESS_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACTS.md`
- `docs/SECURITY_AND_COMPLIANCE.md`
- `docs/DEVELOPMENT_ROADMAP.md`
