# Security and Compliance

## Secrets

Never commit real secrets, API keys, private certificates, production database URLs, production payment credentials, production Tally details or private farmer data.

## Authentication

Phase 3D uses mock authentication only for protected local development and tests. Mock requests must include `x-user-id`, `x-user-role` and `x-organisation-id`, and the backend verifies that those headers match an active user, active organisation and active membership. Public marketplace discovery endpoints are unauthenticated, read-only and limited to approved farmer-safe product data. Farmer profile, address, cart, checkout, own-order, mock payment and cancellation APIs are authenticated and require the `FARMER` role in addition to farmer-owned permissions. Future production authentication should prefer OTP for farmers and stronger role-aware authentication for business users.

The business web portal sends mock-auth headers only from server-side code. Browser-rendered components must not expose mock user IDs, organisation IDs or role headers.

## Authorisation

Enforce permission-based access on the server. Permissions are assigned through role-permission mappings seeded into the database. Resource-level access checks protect organisation-owned reads where non-admin users may only access their active organisation context.

## Audit

Security-sensitive and business-critical actions must create append-only audit logs with actor, role, organisation, action, resource, previous value, new value, timestamp, request ID and reason where applicable.

Phase 1A audits user creation, user/profile/status updates, organisation creation, organisation updates, organisation approval/rejection, membership creation and membership status changes. Phase 1B adds audit records for company profile creation/update, distributor profile creation/update, KYC document submission, KYC document metadata updates, KYC resubmission and KYC review decisions. Phase 1C exposes onboarding audit entries in the business portal with server-side permission enforcement. Phase 2A adds audit records for brand creation/update/submission/review, master product creation/update/submission/review, variant metadata creation and product document metadata creation. Phase 2B adds audit records for warehouse changes, batch metadata/status changes and append-only inventory movement records. Phase 2C adds audit records for distributor offer create/update/submit/review decisions. Phase 2E adds audit records for distributor offer pause, reactivation and archive transitions. Phase 3A adds audit records for farmer profile changes, farmer address changes and cart mutations. Phase 3B adds audit records for checkout creation, child product order creation, order inventory reservation and cart checkout clearing. Phase 3C adds audit records for mock payment intent creation, checkout payment status changes and child order payment status changes. Phase 3D adds audit records for checkout cancellation, child order cancellation and inventory reservation release. Phase 4A adds audit records for distributor fulfilment order acceptance and rejection. Phase 4B adds audit records for ready-to-pack and packed order transitions. Phase 4C adds audit records for product invoice generation. Phase 4D adds audit records for ready-for-pickup order transitions and product dispatch creation. Phase 4E adds audit records for delivery assignment, out-for-delivery, delivered completion and failed OTP attempts. Marketplace discovery and inventory reports are read-only and create no audit records.

## Payments

Do not store raw card information. Use provider abstractions. Confirm payment state server-side through secure provider events.

Phase 3C payment APIs are mock-only and require `Idempotency-Key` headers for intent creation and confirmation. They store mock provider references, payment status and append-only payment events, but no card details, payment credentials, real provider captures or webhook secrets. Production payment provider work must add signed webhook verification before trusting external payment events.

## Data

Use UTC timestamps. Use UUIDs for public identifiers. Avoid physical deletion for financial, invoice, settlement and audit records.

KYC document handling and product document handling are metadata-only through Phase 3D. Do not store real private documents, signed URL secrets or production storage keys in the repository, local seed data, documentation or screenshots. Real upload validation, file size/type restrictions and authorised document access must be implemented before production document storage is enabled.

Inventory movement rows are append-only through the API. Stock adjustments require a reason and must pass backend permission checks and non-negative balance validation.

Distributor offer availability is derived on the backend from active, unexpired inventory batches and latest inventory movement balances. Frontend clients must not provide or override farmer-visible stock quantities.

Marketplace discovery responses must not expose review-only metadata, private KYC data, private product document storage keys, raw file names, unapproved products, unapproved brands, unapproved offers, inactive warehouses, inactive distributor organisations or zero-stock offers. Seller and fulfilment visibility is intentionally limited to product purchasing context: distributor legal/display name, GSTIN, warehouse location metadata, fulfilment mode and delivery SLA metadata.

Offer pause, reactivation and archive actions require authenticated protected API calls, resource-level offer write checks and an audit reason. Inventory ageing reports require inventory read permission and must apply distributor resource scope for own-organisation users.

Farmer cart APIs store backend-generated price and availability snapshots but do not reserve inventory or create checkout/payment state. Cart subtotal values are backend-calculated from integer paise snapshots. Clients must not submit cart prices, subtotals or availability counts.

Checkout APIs require an `Idempotency-Key` header and store idempotency records scoped to the authenticated farmer user. Checkout revalidates cart items against current backend offer, catalogue, serviceability and inventory data before writing parent checkout, child product orders and reservation movements in one database transaction. Reservation movements use `RESERVED_FOR_ORDER` and cannot be created through manual inventory adjustment APIs. Phase 3C mock payment APIs require idempotency keys, verify checkout ownership through the farmer profile, write payment events and audit status transitions. Phase 3D cancellation APIs require idempotency keys, verify checkout/order ownership through the farmer profile, reject paid or payment-processing records, and release reservations only through append-only `RELEASED_FROM_ORDER` inventory movements. Phase 4A through 4E fulfilment APIs verify seller-organisation access for distributor users where distributor fulfilment permissions apply, permit status transitions only in the approved sequence, create invoices only for packed child product orders, create dispatch readiness only after invoice generation, create delivery assignments only after dispatch readiness, and do not release inventory or initiate refunds. Phase 4C invoice totals are calculated on the backend in integer paise and invoice generation audits `PRODUCT_INVOICE_GENERATED`. Phase 4D dispatch readiness audits `PRODUCT_ORDER_READY_FOR_PICKUP` and `PRODUCT_DISPATCH_CREATED`. Phase 4E delivery completion verifies OTP on the backend, stores only OTP hash/salt/expiry/attempt metadata, audits failed attempts and does not send real notifications, create payment captures, finance ledger entries, settlements, refunds, invoice PDFs or Tally records.

## Development Providers

SMS, WhatsApp, email, payment and Tally providers must remain mock or sandbox until production readiness is approved.
