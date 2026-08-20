# Data Model

## KC-09 Advisory Entities

- `AdvisoryRule` stores bilingual, human-authored content, deterministic crop/variety/day/region/season criteria, an immutable approved version number, source reference and named author/reviewer metadata.
- `AdvisoryEvent` links exactly one approved rule version to one farmer-owned active crop cycle and Club membership. The unique `(cropCycleId, advisoryRuleId, ruleVersion)` key prevents repeat advice.
- `AdvisoryEventStatus` is `PENDING`, `DELIVERED`, `READ` or `DISMISSED`. Generation writes the event, localized in-app notification and audit record transactionally.
- `AGRONOMIST` is a distinct platform role responsible for advisory review accountability.

## Phase 0 To Phase 3D Entities

Phase 0 created the foundation models required for users, organisations, memberships, permissions, idempotency and audit logs. Phase 1A completes their lifecycle and permission behavior. Phase 1B adds company and distributor onboarding details plus KYC document metadata for approval queues. Phase 2A adds company-owned brand and master product catalogue records with variant and product document metadata. Phase 2B adds distributor-owned warehouse, batch and append-only inventory movement foundations. Phase 2C adds distributor-owned offers linked to approved catalogue variants and sellable inventory scope. Phase 2D adds public marketplace discovery as a derived read model over approved catalogue, approved offers, serviceable pincodes and inventory movement balances. Phase 2E adds operational offer status transitions and inventory ageing reports over the same persisted records. Phase 3A adds farmer-owned profile, address and cart records with backend-generated price and availability snapshots. Phase 3B adds parent product checkouts, distributor-split child product orders, order items, batch-level reservation rows and product order status history. Phase 3C adds mock payment intent records and append-only payment event history linked to farmer-owned product checkouts. Phase 3D adds cancellation status transitions and append-only reservation release movements for eligible unpaid or payment-failed checkouts/orders. Farmer mobile onboarding adds the `FARMER_REGISTRATION` OTP purpose; it reuses the existing user, profile, membership, refresh-token and audit models rather than introducing a second farmer identity store.

## Promoter Farmer Leads

`FarmerLead` stores a promoter- and organisation-owned prospect with normalized phone, controlled source, optional coarse locality/crop notes and explicit `NEW`, `CONTACTED`, `CONVERTED` or `LOST` status. Indexed owner/status fields support own pipeline reads. Contacted/lost timestamps and a required loss reason preserve lifecycle context; records are not deleted. A converted lead has a required `convertedFarmerProfileId` link to an OTP-verified farmer profile; the database status-metadata constraint prevents converted records without that link.

`PromoterVisit` is an append-only, promoter- and organisation-owned field record targeting exactly one owned `FarmerLead` or actively attributed `FarmerProfile`. It stores a controlled purpose, optional notes and UTC occurrence time. `locationStatus` distinguishes not requested, granted, denied and unavailable capture. Database checks require the complete coordinate/accuracy/capture-time tuple only for `GRANTED` and forbid partial or residual location data for every other outcome. Raw coordinates are omitted from audit snapshots; private evidence remains deferred until authorised file storage exists.

### Identity

- `User`: platform account with optional email and phone. Uses UUID public identifiers and UTC timestamps.
- `UserProfile`: display and locale preferences for one user.
- `FarmerProfile`: farmer-owned profile details linked one-to-one to a `User`.
- `FarmerAddress`: farmer-owned delivery address records linked to one `FarmerProfile`, including a two-digit GST place-of-supply state code.

### Organisations and Access

- `Organisation`: business or internal organisation such as Vardhnam, company, distributor or service provider. GST-registered sellers retain the normalised GSTIN, registered-state code and GST verification timestamp used by invoice generation.
- `Organisation.reviewedAt`, `reviewedByUserId`, `reviewReason`: approval decision metadata for company, distributor and service-provider verification flows.
- `OrganisationMembership`: joins users to organisations with one platform role and a status.
- `Permission`: machine-readable permission code.
- `RolePermission`: maps platform roles to permissions.

Duplicate memberships are blocked by `userId`, `organisationId` and `role`.

### Company and Distributor Onboarding

- `CompanyProfile`: company-specific legal, brand and primary contact details for one `COMPANY` organisation.
- `DistributorProfile`: distributor-specific code, operating address, primary contact, fulfilment capability and serviceable pincode details for one `DISTRIBUTOR` organisation.
- `KycDocument`: metadata for onboarding documents submitted against a company or distributor organisation. Phase 1B stores metadata and lifecycle status only; file upload and private document storage are future work.

Each company or distributor organisation can have at most one matching onboarding profile and multiple KYC document metadata records.

### Catalogue Foundation

- `Brand`: company-owned brand metadata. Brands use `CatalogueStatus` and must be submitted before approval or rejection.
- `MasterProduct`: company-owned master product metadata linked to one approved brand before product approval.
- `ProductVariant`: product pack-size metadata including variant name, pack size, pack unit, optional SKU, optional MRP stored in paise, HSN code and GST rate in basis points. Tax fields remain nullable while drafting but are required on every active variant before catalogue submission.
- `ProductDocument`: metadata for product labels, registrations, safety sheets, images, test reports or other catalogue documents. Phase 2A stores metadata only; file upload and private document storage are future work.

Each `COMPANY` organisation may own many brands and master products. Each master product belongs to one brand, may have many variants and may have many product document metadata records.

### Inventory Foundation

- `Warehouse`: distributor-owned physical stock location with code, address, pincode, contact metadata and warehouse status.
- `InventoryBatch`: distributor and warehouse-specific batch metadata linked to one approved master product and one active product variant.
- `InventoryMovement`: append-only stock movement record with movement type, quantity delta, balance after movement, actor metadata and required reason.

Each `DISTRIBUTOR` organisation may own many warehouses, inventory batches and inventory movements. Each batch belongs to one warehouse and one product variant. On-hand stock is read from the latest movement balance, and sellable quantity is zero when a batch is blocked or expired.

### Distributor Offer Foundation

- `DistributorOffer`: distributor-owned sellable offer metadata linked to one approved master product, one active variant, one warehouse and optionally one batch.
- `DistributorOffer.sellingPricePaise`: distributor selling price stored as an integer amount in paise.
- `DistributorOffer.serviceablePincodes`: pincode list used for future farmer-visible serviceability.
- `DistributorOffer.fulfilmentMode`: commercial fulfilment mode metadata only; through Phase 2E the platform does not execute delivery.
- `DistributorOffer.status`: offer lifecycle status for draft, submitted, approved, rejected, paused or archived records. Phase 2E uses `PAUSED` for temporary farmer-visibility removal and `ARCHIVED` for non-deleted retirement.

Offer availability is not stored as a mutable field. It is derived by the backend from active, unexpired inventory batches and latest append-only movement balances. Phase 3A cart items may reference approved offers and snapshot availability, but they do not create reservations, checkouts, payments, deliveries, finance records, settlements or Tally records. Phase 3B checkout creates `RESERVED_FOR_ORDER` inventory movements, so availability automatically excludes reserved stock through the latest movement balance. Phase 3D cancellation creates `RELEASED_FROM_ORDER` movements to restore reserved stock without deleting the original reservation trail.

### Marketplace Discovery Read Model

Phase 2D does not add new persistent database tables. Public marketplace product listings are derived at request time from:

- `MasterProduct.status = APPROVED`
- `Brand.status = APPROVED`
- active product variants
- active distributor organisations
- active warehouses
- `DistributorOffer.status = APPROVED`
- requested pincode present in `DistributorOffer.serviceablePincodes`
- active, unexpired `InventoryBatch` records
- the latest `InventoryMovement.balanceAfter` per eligible batch

The read model groups eligible offers by master product and returns seller, warehouse, optional batch, fulfilment, price and backend-derived availability metadata. It excludes private product document fields such as `fileName` and `storageKey` from farmer-facing product detail responses.

### Inventory Ageing Read Model

Phase 2E does not add persistent reporting tables. Inventory ageing, low-stock and expiring-batch reports are derived from:

- `InventoryBatch.status`
- `InventoryBatch.createdAt`
- `InventoryBatch.expiryDate`
- `Warehouse` and distributor ownership metadata
- latest `InventoryMovement.balanceAfter`

Report rows include on-hand quantity, sellable quantity, batch age, days until expiry and alert flags. Blocked and expired batches are visible in the combined ageing report but are not counted as sellable low-stock rows.

### Farmer Profile, Address And Cart Foundation

- `FarmerProfile`: profile data for the authenticated farmer user, including full name, preferred locale, optional village/district/state, primary pincode and crop interests.
- `FarmerAddress`: reusable farmer address records with pincode, recipient, phone, address lines, two-digit GST state code and default-address metadata.
- `Cart`: one active cart per farmer profile in Phase 3A, with optional delivery address and serviceable pincode context.
- `CartItem`: cart item records linked to an approved distributor offer and its source distributor, product, variant and warehouse.

`CartItem` stores backend-generated snapshots for price in paise, derived availability, pincode, product name, variant name, seller name, warehouse name, fulfilment mode and delivery SLA. These snapshots are for cart review only. They do not reserve inventory, create a checkout, create product orders, create invoices or write financial ledger entries.

Cart validation reads from the same approved catalogue, approved offer, serviceable pincode and active unexpired inventory movement foundations used by marketplace discovery. Changing the cart pincode while items exist is rejected so stale serviceability assumptions do not survive into checkout.

### Product Checkout And Order Foundation

- `ProductCheckout`: parent checkout record created from one authenticated farmer cart. It stores farmer profile, source cart, delivery address, serviceable pincode, checkout status, subtotal in paise, item count and child order count.
- `ProductOrder`: child product order record for one distributor seller. It stores order type, seller, farmer, delivery address, serviceable pincode, seller snapshot, delivery address snapshot, subtotal in paise, item count and current status.
- `ProductOrderItem`: item snapshot copied from current backend offer/catalogue data at checkout time. It stores product, variant, warehouse, offer, quantity, unit price in paise, line total in paise, HSN/GST-rate snapshots and fulfilment metadata.
- `ProductOrderItemReservation`: batch-level reservation row linking a product order item to the append-only inventory movement that reserved stock.
- `ProductOrderStatusHistory`: append-only status transition history for each product order with actor, role, reason, request ID and timestamp.
- `ProductInvoice`: one immutable invoice snapshot per child product order. It stores the seller financial-year sequence number, seller legal/display/GSTIN/state/address snapshots, place of supply, farmer and delivery snapshots, line-level HSN/tax breakup, reservation batch references, and backend-calculated taxable/CGST/SGST/IGST/tax/subtotal/total amounts in paise.
- `ProductInvoiceDocument`: one durable PDF-generation record per product invoice, with queued/processing/available/failed state, retry evidence and a checksum-bearing private `StoredFile` link.
- `CreditNote`: one immutable GST credit note per succeeded return refund, linked to the original invoice and carrying accepted-quantity, seller/FY sequence, tax, farmer-refund and subsidy-reversal snapshots.
- `CreditNoteDocument`: durable queued PDF state and private checksum-bearing storage link for a credit note.
- `InvoiceSequence`: one transactional counter per distributor seller and Indian financial year. It is incremented in the same serializable transaction that creates the invoice, so replay does not consume another number and a rolled-back invoice does not leave a committed increment.
- `ProductDispatch`: one dispatch readiness snapshot per child product order. It stores dispatch number, linked invoice, seller, farmer, pincode, delivery address, warehouse/item snapshots, ready-for-pickup reason, ready-by actor/time and package-QR hash/issuance metadata. The raw QR payload is transient.
- `ProductDeliveryAssignment`: one delivery assignment snapshot per child product order and dispatch. It stores assigned delivery partner user, delivery status, dispatch/invoice/seller snapshots, pickup and item snapshots, package verification attempts and pickup actor/time, hashed delivery OTP metadata, failed OTP attempt count, assignment/start/completion actor metadata and proof note.
- `DeliveryPartnerProfile`: one operational profile per delivery-partner user and organisation context. It stores backend-authoritative `OFFLINE`/`ONLINE` availability and the last change timestamp; it is separate from identity, payout accounts and delivery assignments.

`ProductCheckout.status` starts as `PENDING_PAYMENT` in Phase 3B. Child `ProductOrder` records are created as `PENDING_PAYMENT` and transition to `INVENTORY_RESERVED` after reservation movements are written. Phase 3C may move the checkout through `PAYMENT_PROCESSING`, `PAYMENT_FAILED` or `PAID` from backend mock payment actions. Phase 3D may move eligible `PENDING_PAYMENT` or `PAYMENT_FAILED` checkouts and eligible `PENDING_PAYMENT`, `INVENTORY_RESERVED` or `PAYMENT_FAILED` child orders to `CANCELLED`. Phase 3B through Phase 3D do not create real payment captures, invoices, delivery tasks, finance ledger entries, settlement records, refund records or Tally records.

### Payment Foundation

- `PaymentIntent`: payment attempt linked to one farmer-owned `ProductCheckout` and `FarmerProfile`. It stores provider mode, platform/provider references, local and last-observed provider status, amount in paise, currency, last provider sync time and optional failure metadata.
- `PaymentEvent`: append-only payment history for intent creation, confirmation, verified webhook receipt, provider-status fetches, reconciliation mismatches, success and failure. It stores event type, resulting payment status, provider reference, payload metadata, actor, request ID and timestamp.
- `WebhookEvent`: durable raw verified-provider delivery, unique by provider and provider event ID. It stores the byte-preserving payload text, payload digest, signature, processing status and attempts, optional matched payment intent, failure reason and timestamps. Rejected signatures are audited but their attacker-controlled bodies are not stored.

`PaymentIntent.providerMode` is `MOCK` through Phase 3C. `PaymentIntent.status` can be `PENDING`, `PROCESSING`, `SUCCEEDED` or `FAILED`. Payment intent creation sets the checkout and child orders to `PAYMENT_PROCESSING`. Mock confirmation with `SUCCESS` sets the payment intent to `SUCCEEDED`, checkout to `PAID`, and child product orders to `CONFIRMED`. Mock confirmation with `FAILURE` sets the payment intent to `FAILED`, checkout to `PAYMENT_FAILED`, and child product orders to `PAYMENT_FAILED`.

The WP-07 provider foundation adds `SANDBOX` and `LIVE` modes to the schema while configuration remains fail-closed on `mock` until a real gateway implementation and merchant account are supplied. A payment can settle from a provider only through a signature-verified webhook with an exact amount match. Reconciliation records provider observations and mismatches without automatically changing payment state.

Phase 3C payment records are not a financial ledger and do not create distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, tax, refund, adjustment, settlement or Tally records. Inventory reservations remain in place after payment failure until a Phase 3D farmer cancellation creates positive `RELEASED_FROM_ORDER` movements.

### Distributor Fulfilment Foundation

Phase 4A and 4B use existing `ProductOrder` and `ProductOrderStatusHistory` tables. Distributor fulfilment list/detail APIs read child product orders where `sellerOrganisationId` is the distributor seller of record. Accept and reject actions move eligible `CONFIRMED` orders to `DISTRIBUTOR_ACCEPTED` or `DISTRIBUTOR_REJECTED` and append status history plus audit records. Picking and packing actions move `DISTRIBUTOR_ACCEPTED` orders to `READY_TO_PACK`, then `READY_TO_PACK` orders to `PACKED`.

Phase 4C adds `ProductInvoice`; WP-15A adds `InvoiceSequence` and the tax-classification/state snapshots described above. Invoice generation is allowed for packed product orders and creates exactly one invoice per child order using `ProductInvoice.productOrderId` uniqueness. Tax-inclusive gross line amounts are split into taxable value and CGST/SGST or IGST in integer paise, then constrained to reconcile at both component and header level. The invoice receives the next number for its distributor seller and financial year and audits `PRODUCT_INVOICE_GENERATED`. WP-15B adds `ProductInvoiceDocument` for durable queued PDF rendering and private `StoredFile` delivery, plus a separately sequenced `CreditNote` and durable `CreditNoteDocument` for succeeded accepted-return refunds. Tax classifications, rounding and final legal layouts remain sandbox/provisional until chartered-accountant approval.

Phase 4D adds `ProductDispatch`. Dispatch readiness is allowed only for packed product orders with a generated invoice and creates exactly one dispatch record per child order using `ProductDispatch.productOrderId` uniqueness. The dispatch snapshots invoice number, seller, delivery address, warehouse quantities and reserved item batches, then moves the child order to `READY_FOR_PICKUP`. Phase 4D adds no delivery assignment, delivery OTP, notification, refund, settlement, finance ledger or Tally tables.

Phase 4E adds `ProductDeliveryAssignment`. Assignment is allowed only for ready-for-pickup product orders with a ready dispatch and creates exactly one assignment per child order and dispatch using `ProductDeliveryAssignment.productOrderId` and `dispatchId` uniqueness. The assignment snapshots dispatch, invoice, seller, delivery address, pickup and item data, stores the delivery OTP as `otpHash` plus `otpSalt`, records expiry and failed attempt count, and moves through `ASSIGNED` → `ACCEPTED` → `OUT_FOR_DELIVERY` → `DELIVERED`; `ASSIGNED` may instead move to `REJECTED`. Operations reassign a rejected row in place to preserve the one-order/one-dispatch invariant, replace the OTP metadata, reset execution fields and return it to `ASSIGNED`; audit records preserve the prior partner and reason. The local/mock assignment or reassignment response may include a transient `mockOtpCode`, but the raw OTP is not stored.

WP-12 package pickup verification adds a nullable hash and issuance actor/time to `ProductDispatch`, plus verification attempt count and verified actor/role/time to `ProductDeliveryAssignment`. Label issuance returns the raw QR payload once and stores only its SHA-256 hash. The assignment cannot move from `ACCEPTED` to `OUT_FOR_DELIVERY` until the payload is verified.

WP-12 geotag proof adds `proofLocationStatus`, latitude, longitude, device accuracy and captured-at metadata to `ProductDeliveryAssignment`. A database check constraint permits coordinates only for `GRANTED` and requires a complete coordinate set in that state. `DENIED` and `UNAVAILABLE` are durable, auditable outcomes and do not block OTP completion. Binary photo evidence is not represented until WP-08 provides authorised private storage.

WP-12 failed-delivery handling adds a controlled `DeliveryFailureReasonCode`, durable failure count, latest failure reason/note/actor/time and `retryScheduledAt` to `ProductDeliveryAssignment`. Order status history and append-only audit logs preserve every `OUT_FOR_DELIVERY` → `DELIVERY_FAILED` → `OUT_FOR_DELIVERY` transition. Starting a due retry preserves the failure metadata and replaces only the hashed OTP metadata and attempt counter.

WP-12 adds `DeliveryPartnerProfile` with a unique `(userId, organisationId)` key. A missing row is treated as `OFFLINE`; the first availability update creates it. New delivery assignment validates an active delivery-partner membership, active delivery-partner organisation and an `ONLINE` profile in the same organisation. Availability changes are audited and do not alter existing assignments.

WP-12 return collection adds `ReturnPickupAssignment`, with unique `returnRequestId` and `productOrderId` links so one return has one durable pickup lifecycle. It snapshots seller, farmer, pickup address and returned items, and moves through `ASSIGNED` to `ACCEPTED` and `COLLECTED`, or to `REJECTED`. A rejected row may be reassigned in place while audit records preserve the prior partner and reason. Collection records actor/time and atomically advances the related return and child order to their in-transit states.

### Cancellation And Reservation Release Foundation

Phase 3D does not add new tables. It adds the `RELEASED_FROM_ORDER` inventory movement type and uses existing checkout, order, reservation, status history, audit and idempotency records.

Cancellation APIs use `IdempotencyRecord` scoped to the authenticated farmer user plus checkout or order ID. A cancellation stores status transitions in `ProductOrderStatusHistory`, updates the current checkout/order status to `CANCELLED`, and writes audit records. Each released reservation is represented by a new `InventoryMovement` with a positive `quantityDelta`, `referenceType = ProductOrderCancellation` and `referenceId = ProductOrder.id`. `ProductOrderItemReservation` rows continue to point at the original reservation movement; release movement audit payloads carry the original reservation movement ID for traceability.

Checkout uses `IdempotencyRecord` scoped to the authenticated farmer user. Duplicate checkout requests with the same idempotency key and same request hash return the stored checkout response. Mock payment and cancellation workflows also use idempotency records and return stored responses for matching completed requests.

### Audit and Idempotency

- `AuditLog`: append-only event history for security-sensitive and business-critical actions.
- `IdempotencyRecord`: checkout, mock payment and future webhook idempotency foundation.

## Ownership

Users own profile records and farmer profile records. Farmer profiles own farmer addresses, carts, product checkouts and product orders. Organisations own memberships and business resources. Company organisations own catalogue records. Distributor organisations own warehouses, batches, inventory movements, distributor offers and child product orders where they are seller of record. Audit logs reference the actor and organisation when known, but must survive even if optional relationships are absent.

## Transaction Boundaries

The following operations should use database transactions:

- User creation with profile creation and audit entry
- Organisation creation with membership creation and audit entry
- Membership creation with duplicate checks and audit entry
- Company profile, distributor profile and KYC document changes with audit entries
- Brand, master product, product variant and product document metadata changes with audit entries
- Warehouse, batch and inventory movement changes with audit entries
- Distributor offer create, update, submit and review decisions with audit entries
- Distributor offer pause, reactivate and archive status transitions with audit entries
- Marketplace discovery reads do not create records and do not require database transactions
- Inventory ageing reports are read-only and do not require database transactions
- Farmer profile and address writes with audit entries
- Cart context and cart item mutations with audit entries
- Checkout creation with child product orders, order status history, batch-level inventory reservation movements, cart clearing, audit entries and idempotency completion
- Mock payment intent creation with checkout/order status transitions, payment event history, audit entries and idempotency completion
- Mock payment confirmation with payment intent, checkout and child order status transitions, payment event history, audit entries and idempotency completion
- Distributor fulfilment accept/reject with child order status transition, status history and audit entry
- Distributor fulfilment picking/packing with child order status transition, status history and audit entry
- Distributor invoice generation with product invoice snapshot and audit entry
- Distributor dispatch readiness with product dispatch snapshot, child order status transition, status history and audit entries
- Delivery assignment with product delivery assignment snapshot and audit entry
- Delivery start/completion with assignment status update, child order status transition, status history, OTP attempt audit where applicable and delivery audit entries
- Future real payment capture and ledger posting

## Deletion Policy

Phase 0 avoids physical deletion for audit logs and idempotency records. Phase 2B inventory movements are append-only and have no update or delete API. Phase 2C offers are status-managed records; Phase 2E offer retirement uses `ARCHIVED` rather than physical deletion. Phase 2D discovery and Phase 2E reports add no deletion behavior because they are read-only. Phase 3A cart item removal may physically delete non-financial cart rows while preserving cart mutation audit history. Phase 3B checkout clears cart item rows only after order item snapshots and reservation rows are created. Phase 3D cancellation does not delete reservation rows or reservation movements; it appends release movements and status history. Product checkout, product order, product order item, reservation, status history, payment intent, payment event, inventory movement, product invoice, product dispatch and product delivery assignment rows must not be physically deleted through application workflows. Future financial, settlement and audit data must not be physically deleted.

## Mermaid ER Diagram

```mermaid
erDiagram
  USER ||--o| USER_PROFILE : has
  USER ||--o{ ORGANISATION_MEMBERSHIP : belongs_to
  USER ||--o| FARMER_PROFILE : has
  FARMER_PROFILE ||--o{ FARMER_ADDRESS : has
  FARMER_PROFILE ||--o| CART : owns
  FARMER_PROFILE ||--o{ PRODUCT_CHECKOUT : creates
  FARMER_PROFILE ||--o{ PRODUCT_ORDER : buys
  FARMER_PROFILE ||--o{ PAYMENT_INTENT : pays_with
  FARMER_PROFILE ||--o{ PRODUCT_INVOICE : receives
  FARMER_PROFILE ||--o{ PRODUCT_DISPATCH : dispatches
  FARMER_PROFILE ||--o{ PRODUCT_DELIVERY_ASSIGNMENT : receives
  FARMER_ADDRESS ||--o{ CART : selected_for
  FARMER_ADDRESS ||--o{ PRODUCT_CHECKOUT : selected_for
  FARMER_ADDRESS ||--o{ PRODUCT_ORDER : delivers_to
  CART ||--o{ CART_ITEM : contains
  CART ||--o{ PRODUCT_CHECKOUT : checked_out_as
  USER ||--o{ ORGANISATION : reviews
  USER ||--o{ BRAND : reviews
  USER ||--o{ MASTER_PRODUCT : reviews
  USER ||--o{ DISTRIBUTOR_OFFER : reviews
  USER ||--o{ INVENTORY_MOVEMENT : records
  USER ||--o{ PRODUCT_DELIVERY_ASSIGNMENT : delivers
  ORGANISATION ||--o{ ORGANISATION_MEMBERSHIP : has
  ORGANISATION ||--o| COMPANY_PROFILE : has
  ORGANISATION ||--o| DISTRIBUTOR_PROFILE : has
  ORGANISATION ||--o{ KYC_DOCUMENT : submits
  ORGANISATION ||--o{ BRAND : owns
  ORGANISATION ||--o{ MASTER_PRODUCT : owns
  ORGANISATION ||--o{ WAREHOUSE : owns
  ORGANISATION ||--o{ INVENTORY_BATCH : owns
  ORGANISATION ||--o{ INVENTORY_MOVEMENT : owns
  ORGANISATION ||--o{ DISTRIBUTOR_OFFER : owns
  ORGANISATION ||--o{ CART_ITEM : sells
  ORGANISATION ||--o{ PRODUCT_ORDER : sells
  ORGANISATION ||--o{ PRODUCT_INVOICE : invoices
  ORGANISATION ||--o{ PRODUCT_DISPATCH : dispatches
  ORGANISATION ||--o{ PRODUCT_DELIVERY_ASSIGNMENT : assigns
  BRAND ||--o{ MASTER_PRODUCT : contains
  MASTER_PRODUCT ||--o{ PRODUCT_VARIANT : has
  MASTER_PRODUCT ||--o{ PRODUCT_DOCUMENT : has
  MASTER_PRODUCT ||--o{ INVENTORY_BATCH : stocked_as
  MASTER_PRODUCT ||--o{ INVENTORY_MOVEMENT : moved_as
  MASTER_PRODUCT ||--o{ DISTRIBUTOR_OFFER : offered_as
  MASTER_PRODUCT ||--o{ CART_ITEM : carted_as
  MASTER_PRODUCT ||--o{ PRODUCT_ORDER_ITEM : ordered_as
  PRODUCT_VARIANT ||--o{ INVENTORY_BATCH : stocked_as
  PRODUCT_VARIANT ||--o{ INVENTORY_MOVEMENT : moved_as
  PRODUCT_VARIANT ||--o{ DISTRIBUTOR_OFFER : offered_as
  PRODUCT_VARIANT ||--o{ CART_ITEM : carted_as
  PRODUCT_VARIANT ||--o{ PRODUCT_ORDER_ITEM : ordered_as
  WAREHOUSE ||--o{ INVENTORY_BATCH : stores
  WAREHOUSE ||--o{ INVENTORY_MOVEMENT : logs
  WAREHOUSE ||--o{ DISTRIBUTOR_OFFER : supplies
  WAREHOUSE ||--o{ CART_ITEM : supplies
  WAREHOUSE ||--o{ PRODUCT_ORDER_ITEM : supplies
  INVENTORY_BATCH ||--o{ INVENTORY_MOVEMENT : has
  INVENTORY_BATCH ||--o{ DISTRIBUTOR_OFFER : pins
  INVENTORY_BATCH ||--o{ PRODUCT_ORDER_ITEM_RESERVATION : reserves
  INVENTORY_MOVEMENT ||--o| PRODUCT_ORDER_ITEM_RESERVATION : records
  DISTRIBUTOR_OFFER ||--o{ CART_ITEM : selected_as
  DISTRIBUTOR_OFFER ||--o{ PRODUCT_ORDER_ITEM : ordered_as
  PRODUCT_CHECKOUT ||--o{ PRODUCT_ORDER : splits_into
  PRODUCT_CHECKOUT ||--o{ PAYMENT_INTENT : paid_by
  PRODUCT_CHECKOUT ||--o{ PRODUCT_INVOICE : invoices
  PRODUCT_CHECKOUT ||--o{ PRODUCT_DISPATCH : dispatches
  PRODUCT_CHECKOUT ||--o{ PRODUCT_DELIVERY_ASSIGNMENT : deliveries
  PRODUCT_ORDER ||--o{ PRODUCT_ORDER_ITEM : contains
  PRODUCT_ORDER ||--o{ PRODUCT_ORDER_STATUS_HISTORY : has
  PRODUCT_ORDER ||--o| PRODUCT_INVOICE : has
  PRODUCT_ORDER ||--o| PRODUCT_DISPATCH : has
  PRODUCT_ORDER ||--o| PRODUCT_DELIVERY_ASSIGNMENT : has
  PRODUCT_INVOICE ||--o| PRODUCT_DISPATCH : enables
  PRODUCT_DISPATCH ||--o| PRODUCT_DELIVERY_ASSIGNMENT : enables
  PRODUCT_ORDER_ITEM ||--o{ PRODUCT_ORDER_ITEM_RESERVATION : reserves
  PAYMENT_INTENT ||--o{ PAYMENT_EVENT : records
  PERMISSION ||--o{ ROLE_PERMISSION : grants
  USER ||--o{ AUDIT_LOG : actor
  USER ||--o{ PAYMENT_EVENT : triggers
  ORGANISATION ||--o{ AUDIT_LOG : scope

  USER {
    uuid id PK
    string email
    string phone
    string passwordHash
    UserStatus status
    datetime createdAt
    datetime updatedAt
  }

  USER_PROFILE {
    uuid id PK
    uuid userId FK
    string displayName
    string preferredLocale
    string timezone
    datetime createdAt
    datetime updatedAt
  }

  FARMER_PROFILE {
    uuid id PK
    uuid userId FK
    string fullName
    string alternatePhone
    string preferredLocale
    string village
    string district
    string state
    string primaryPincode
    string cropInterests
    datetime createdAt
    datetime updatedAt
  }

  FARMER_ADDRESS {
    uuid id PK
    uuid farmerProfileId FK
    string label
    string recipientName
    string phone
    string addressLine1
    string city
    string state
    string pincode
    boolean isDefault
    datetime createdAt
    datetime updatedAt
  }

  ORGANISATION {
    uuid id PK
    OrganisationType type
    string legalName
    string displayName
    string gstin
    OrganisationStatus status
    datetime reviewedAt
    uuid reviewedByUserId FK
    string reviewReason
    datetime createdAt
    datetime updatedAt
  }

  ORGANISATION_MEMBERSHIP {
    uuid id PK
    uuid userId FK
    uuid organisationId FK
    PlatformRole role
    MembershipStatus status
    datetime createdAt
    datetime updatedAt
  }

  COMPANY_PROFILE {
    uuid id PK
    uuid organisationId FK
    string brandName
    string registrationNumber
    string pan
    string primaryContactName
    string primaryContactPhone
    string primaryContactEmail
    string registeredAddress
    string city
    string state
    string pincode
    datetime createdAt
    datetime updatedAt
  }

  DISTRIBUTOR_PROFILE {
    uuid id PK
    uuid organisationId FK
    string distributorCode
    string pan
    string primaryContactName
    string primaryContactPhone
    string primaryContactEmail
    string operatingAddress
    string city
    string state
    string pincode
    string serviceablePincodes
    string fulfilmentCapability
    datetime createdAt
    datetime updatedAt
  }

  KYC_DOCUMENT {
    uuid id PK
    uuid organisationId FK
    KycDocumentType documentType
    KycDocumentStatus status
    string documentNumber
    string fileName
    string storageKey
    datetime issuedAt
    datetime expiresAt
    string rejectionReason
    datetime createdAt
    datetime updatedAt
  }

  BRAND {
    uuid id PK
    uuid companyOrganisationId FK
    string name
    string slug
    string description
    string website
    CatalogueStatus status
    datetime reviewedAt
    uuid reviewedByUserId FK
    string reviewReason
    datetime createdAt
    datetime updatedAt
  }

  MASTER_PRODUCT {
    uuid id PK
    uuid companyOrganisationId FK
    uuid brandId FK
    string name
    string slug
    string category
    string description
    string cropTargets
    CatalogueStatus status
    datetime reviewedAt
    uuid reviewedByUserId FK
    string reviewReason
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_VARIANT {
    uuid id PK
    uuid productId FK
    string sku
    string variantName
    decimal packSize
    string packUnit
    int mrpPaise
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_DOCUMENT {
    uuid id PK
    uuid productId FK
    ProductDocumentType documentType
    string title
    string documentNumber
    string fileName
    string storageKey
    datetime issuedAt
    datetime expiresAt
    datetime createdAt
    datetime updatedAt
  }

  WAREHOUSE {
    uuid id PK
    uuid distributorOrganisationId FK
    string code
    string name
    string addressLine1
    string addressLine2
    string city
    string state
    string pincode
    string contactName
    string contactPhone
    WarehouseStatus status
    datetime createdAt
    datetime updatedAt
  }

  INVENTORY_BATCH {
    uuid id PK
    uuid distributorOrganisationId FK
    uuid warehouseId FK
    uuid productId FK
    uuid variantId FK
    string batchNumber
    date manufacturingDate
    date expiryDate
    decimal germinationPercentage
    InventoryBatchStatus status
    string blockedReason
    datetime createdAt
    datetime updatedAt
  }

  INVENTORY_MOVEMENT {
    uuid id PK
    uuid distributorOrganisationId FK
    uuid warehouseId FK
    uuid batchId FK
    uuid productId FK
    uuid variantId FK
    InventoryMovementType movementType
    int quantityDelta
    int balanceAfter
    string reason
    string referenceType
    string referenceId
    uuid createdByUserId FK
    datetime createdAt
  }

  DISTRIBUTOR_OFFER {
    uuid id PK
    uuid distributorOrganisationId FK
    uuid productId FK
    uuid variantId FK
    uuid warehouseId FK
    uuid batchId FK
    string offerCode
    int sellingPricePaise
    int minimumOrderQuantity
    int maximumOrderQuantity
    string serviceablePincodes
    FulfilmentMode fulfilmentMode
    int deliverySlaDays
    DistributorOfferStatus status
    datetime reviewedAt
    uuid reviewedByUserId FK
    string reviewReason
    datetime createdAt
    datetime updatedAt
  }

  CART {
    uuid id PK
    uuid farmerProfileId FK
    uuid deliveryAddressId FK
    string serviceablePincode
    CartStatus status
    datetime createdAt
    datetime updatedAt
  }

  CART_ITEM {
    uuid id PK
    uuid cartId FK
    uuid offerId FK
    uuid distributorOrganisationId FK
    uuid productId FK
    uuid variantId FK
    uuid warehouseId FK
    uuid batchId
    int quantity
    int priceSnapshotPaise
    int availableQuantitySnapshot
    string serviceablePincodeSnapshot
    string productNameSnapshot
    string variantNameSnapshot
    string sellerNameSnapshot
    string warehouseNameSnapshot
    FulfilmentMode fulfilmentModeSnapshot
    int deliverySlaDaysSnapshot
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_CHECKOUT {
    uuid id PK
    uuid farmerProfileId FK
    uuid sourceCartId FK
    uuid deliveryAddressId FK
    string serviceablePincode
    ProductCheckoutStatus status
    int subtotalPaise
    int itemCount
    int childOrderCount
    datetime createdAt
    datetime updatedAt
  }

  PAYMENT_INTENT {
    uuid id PK
    uuid checkoutId FK
    uuid farmerProfileId FK
    PaymentProviderMode providerMode
    string providerReference
    PaymentIntentStatus status
    int amountPaise
    string currency
    string failureCode
    string failureMessage
    datetime createdAt
    datetime updatedAt
  }

  PAYMENT_EVENT {
    uuid id PK
    uuid paymentIntentId FK
    PaymentEventType eventType
    PaymentIntentStatus status
    string providerReference
    json payload
    uuid actorUserId FK
    PlatformRole actorRole
    string requestId
    datetime createdAt
  }

  PRODUCT_ORDER {
    uuid id PK
    uuid checkoutId FK
    OrderType orderType
    uuid farmerProfileId FK
    uuid deliveryAddressId FK
    uuid sellerOrganisationId FK
    string orderNumber
    ProductOrderStatus status
    string serviceablePincode
    string sellerNameSnapshot
    string sellerGstinSnapshot
    json deliveryAddressSnapshot
    int subtotalPaise
    int itemCount
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_ORDER_ITEM {
    uuid id PK
    uuid productOrderId FK
    uuid sourceCartItemId
    uuid offerId FK
    uuid distributorOrganisationId FK
    uuid productId FK
    uuid variantId FK
    uuid warehouseId FK
    int quantity
    int unitPricePaise
    int lineTotalPaise
    string productNameSnapshot
    string variantNameSnapshot
    string sellerNameSnapshot
    string warehouseNameSnapshot
    FulfilmentMode fulfilmentModeSnapshot
    int deliverySlaDaysSnapshot
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_ORDER_ITEM_RESERVATION {
    uuid id PK
    uuid productOrderItemId FK
    uuid batchId FK
    uuid inventoryMovementId FK
    int quantity
    datetime createdAt
  }

  PRODUCT_ORDER_STATUS_HISTORY {
    uuid id PK
    uuid productOrderId FK
    ProductOrderStatus fromStatus
    ProductOrderStatus toStatus
    uuid actorUserId FK
    PlatformRole actorRole
    string reason
    string requestId
    datetime createdAt
  }

  PRODUCT_INVOICE {
    uuid id PK
    uuid productOrderId FK
    uuid checkoutId FK
    uuid farmerProfileId FK
    uuid sellerOrganisationId FK
    string invoiceNumber
    ProductInvoiceStatus status
    string currency
    int subtotalPaise
    int taxPaise
    int totalPaise
    int itemCount
    string sellerLegalNameSnapshot
    string sellerDisplayNameSnapshot
    string sellerGstinSnapshot
    string farmerNameSnapshot
    json deliveryAddressSnapshot
    json lineItemsSnapshot
    uuid generatedByUserId
    PlatformRole generatedByRole
    datetime generatedAt
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_DISPATCH {
    uuid id PK
    uuid productOrderId FK
    uuid checkoutId FK
    uuid invoiceId FK
    uuid farmerProfileId FK
    uuid sellerOrganisationId FK
    string dispatchNumber
    ProductDispatchStatus status
    string serviceablePincode
    string invoiceNumberSnapshot
    string sellerNameSnapshot
    string sellerGstinSnapshot
    json deliveryAddressSnapshot
    json warehouseSnapshot
    json itemsSnapshot
    string readyForPickupReason
    uuid readyByUserId
    PlatformRole readyByRole
    datetime readyAt
    datetime createdAt
    datetime updatedAt
  }

  PRODUCT_DELIVERY_ASSIGNMENT {
    uuid id PK
    uuid productOrderId FK
    uuid checkoutId FK
    uuid dispatchId FK
    uuid farmerProfileId FK
    uuid sellerOrganisationId FK
    uuid deliveryPartnerUserId FK
    string assignmentNumber
    ProductDeliveryAssignmentStatus status
    string serviceablePincode
    string dispatchNumberSnapshot
    string invoiceNumberSnapshot
    json deliveryAddressSnapshot
    json pickupSnapshot
    json itemsSnapshot
    string otpHash
    string otpSalt
    datetime otpExpiresAt
    int otpAttemptCount
    datetime otpVerifiedAt
    string deliveryProofNote
    datetime assignedAt
    datetime startedAt
    datetime completedAt
    datetime createdAt
    datetime updatedAt
  }

  PERMISSION {
    uuid id PK
    string code
    string description
    datetime createdAt
    datetime updatedAt
  }

  ROLE_PERMISSION {
    uuid id PK
    PlatformRole role
    uuid permissionId FK
    datetime createdAt
  }

  AUDIT_LOG {
    uuid id PK
    uuid actorUserId FK
    PlatformRole actorRole
    uuid organisationId FK
    string action
    string resourceType
    string resourceId
    json previousValue
    json newValue
    string requestId
    string reason
    datetime createdAt
  }
```

## Future Domain Groups

The full MVP will add partner profiles, real payment provider sandboxing and the service marketplace. Product delivery, finance, returns/refunds, support, notifications and the farmer-owned farm registry now have implementation foundations.

## Return-request foundation

`ReturnRequest` belongs to one distributor seller-specific `ProductOrder`, the owning `FarmerProfile`/user, and the seller organisation. The request-foundation slice permits at most one request per child order and enforces that constraint in PostgreSQL, including concurrent submissions. `ReturnRequestItem` snapshots the order line unit price and backend-calculated line refund amount; `ReturnRequestStatusHistory` is append-only and records actor, role, reason, request ID, and UTC timestamp. The configured return-window expiry is snapshotted from the actual `DELIVERED` order transition.

The return workflow supports farmer creation/read, an organisation-scoped operational queue, and `REQUESTED` → `APPROVED`/`REJECTED` → `IN_TRANSIT` → `RECEIVED` → `INSPECTED`/`COMPLETED`. `ReturnInspectionDisposition` immutably links a returned line quantity to an original `ProductOrderItemReservation`, its batch, an inspection outcome, the inspector, and an optional inventory movement. The inspection allocation must exactly cover every returned line without exceeding any original reservation. Only `RESTOCKABLE` adds quantity back through `RETURN_RESTOCKED`; quarantine and damage write immutable zero-delta trace movements because the sale already reduced availability. Each transition and inspection commits status history, audit and any inventory movements in one serializable transaction. Pickup assignments and product-order disputes are implemented as separate domain models.

`ReturnRequestEvidence` immutably links one scan-cleared `RETURN_EVIDENCE` `StoredFile` to one return, with uploader user/role, optional caption and UTC creation time. `storedFileId` is globally unique so one file cannot be reused as evidence for multiple returns. Attachment requires the current uploader, repeats farmer ownership or operational seller-scope checks, and atomically moves the file's organisation scope to the return seller while preserving the uploader as owner. This lets the farmer, authorised seller users and any-file operations users reuse the existing signed-download authorisation without exposing the object key.

`Refund` links one inspected return to its seller child order, farmer user and successful checkout payment intent. It stores the backend-approved paise amount, method, provider mode, lifecycle status and unique creation idempotency key. `RefundEvent` is append-only and stores confirmation idempotency/hash metadata. `FinancialLedgerEntry.refundId` links the primary negative refund movement and every commission reversal to the refund without editing prior ledger rows. Successful mock confirmation updates mutable lifecycle status but appends the financial records, events, order history, return history and audit in a serializable transaction. Real-provider execution remains a subsequent slice.

`Dispute` belongs to exactly one seller-specific `ProductOrder`, optionally references that order's `ReturnRequest`, and snapshots the farmer user, seller organisation, raiser, category and the product-order status that existed before the dispute. A PostgreSQL partial unique index permits only one non-closed dispute per child order. `DisputeEvent` is append-only and records creation, assignment, participant notes, information requests, resolution and closure with actor, role, state, request ID and UTC timestamp. Resolution restores `orderStatusBeforeDispute`. A positive farmer award appends a negative `ADJUSTMENT` `FinancialLedgerEntry` linked through `disputeId`; no existing financial row is mutated. See ADR 0013.

## Kisan Club membership foundation

`KisanClubMembership` has a one-to-one restricted relation to `FarmerProfile`. It stores a random display-only `memberNumber`, lifecycle status, home locality, join time, accepted terms version/time and three independent optional consent flags/timestamps. A self-relation stores an optional referral by membership UUID. Suspension reason and closure time preserve lifecycle history; the row is never deleted by the API. Indexes support status/pincode and district/status operational filtering. KC-01 intentionally adds no tier, fee, farm, benefit, order, inventory or finance model.

## Farm and crop registry

`Crop` is an operations-seeded reference record with a stable unique code, English and Hindi names, and an active flag. Crop cycles reference its UUID; farmer or promoter free text is not used for the crop identity.

`Farm` always belongs to its owning `FarmerProfile` and optionally belongs to a `KisanClubMembership`. Club-created farms retain both links; general promoter-attributed surveys use `membershipId = null`. The farmer reference preserves ownership independently of programme lifecycle changes. Area uses `Decimal(10,3)`. Coordinates use six-decimal fixed precision and may be stored only after the applicable explicit precise-location consent; general promoter surveys currently reject coordinates. Farms are deactivated rather than physically deleted. Club advisory generation explicitly ignores farms without a Club membership.

`FarmCropCycle` belongs to one farm and one controlled crop. It records optional catalogue-linked variety, area, season, dates, lifecycle status and yield. `FarmActivity` is append-only, belongs to one cycle, identifies its farmer/promoter/system source and recorder, and may reference an owned product order. Restrictive foreign keys preserve historical farm and crop-cycle records.

## Kisan Club territories and promoter assignments

`PromoterTerritory` stores an operationally managed state/district boundary with controlled block, pincode and village lists. Territories are made inactive rather than deleted. A territory with active Club assignments cannot be deactivated until those farmers are reassigned.

`KisanClubPromoterProfile.territoryId` is also the current general field-operations territory for that promoter and organisation. The general promoter assignment API may create a profile with `clubEnabled = false` or update only `territoryId`; it never implicitly enables Club work or changes capacity/intake settings. This shared source prevents contradictory general and Club territory assignments. Until the model is renamed in a separately reviewed migration, API responses expose it as a promoter territory assignment rather than a Club profile.

`KisanClubPromoterProfile` is one-to-one with a promoter user and identifies the active organisation membership used for attribution, optional territory, locality, operational enablement, availability and capacity. `activeFarmerCount` is maintained transactionally and protected by database constraints.

`KisanClubPromoterAssignment` preserves the complete relationship history. PostgreSQL permits at most one `ACTIVE` assignment per Club membership. Each assignment snapshots its territory, reason, actor and deterministic matching diagnostics and links one-to-one to the existing `PromoterAttribution` money record. Reassignment ends rather than deletes the prior record.

## Kisan Club product programmes

`KisanClubProductProgramme` enrols an approved Vardhnam-owned `MasterProduct`, optionally narrowed to one active product variant. It stores an explicit lifecycle, UTC availability window, optional pincode/district eligibility and display priority. Programme rows are operational policy and do not alter catalogue ownership, distributor offers, inventory or seller-of-record relationships. A partial unique index permits only one product-wide programme while the product/variant unique key prevents duplicate variant programmes.

## Kisan Club benefit rules and redemptions

`KisanClubBenefitRule` belongs to one product programme and stores an explicit type, integer paise or basis-point value, optional line cap, minimum quantity, controlled crop UUID and pincode scopes, lifecycle/window and total/per-member usage limits. `usageCount` is atomically incremented during serializable checkout. Redeemed rules retain immutable economic and eligibility terms.

`KisanClubBenefitRedemption` links the selected rule and active membership to one child order and one unique order line. It snapshots quantity, per-unit benefit and exact total paise. The unique order-item key prevents checkout retries from double-counting a redemption.

`CartItem.clubBenefitSnapshotPaise` and `Cart.kisanClubContext` are display context only. `ProductOrderItem` stores the binding rule and benefit; checkout and each child order add `clubBenefitPaise` and non-null `farmerPayablePaise`. Existing rows are backfilled with farmer payable equal to subtotal. `ProductOrder.isKisanClubOrder` defaults false. `ReturnRequestItem.clubBenefitPaise` preserves the proportional benefit allocation used to ensure net-only refunds.

`FinancialLedgerEntryType.CLUB_BENEFIT_SUBSIDY` records positive platform funding at successful payment and a proportional negative movement at successful return refund. Gross `subtotalPaise` remains unchanged for invoice, distributor payable and marketplace commission calculations.

## Kisan Club fulfilment coordination

`KisanClubFulfilmentAssignment` links one unique Club child order to the active Club membership and promoter selected when payment succeeds. It stores coordination mode, current explicit status, assignment/acceptance/completion timestamps and optional failure reason. The unique order relation makes confirmation retries idempotent.

`KisanClubFulfilmentStatusHistory` is append-only and records every transition with prior/new status, actor, role, request ID, reason and UTC timestamp. Explicit operations reassignment updates the current promoter while appending `old -> REASSIGNED -> ASSIGNED`; it does not change the member's long-lived promoter relationship.

This model has no relation to delivery earnings and does not replace `ProductDeliveryAssignment`. `ProductOrderStatus` remains unchanged by Club coordination actions.

## Kisan Club intelligence projections

KC-12 adds no persisted intelligence or forecasting tables. Crop summary responses are read-only projections over controlled `Crop`, `Farm` and `FarmCropCycle` records. They expose aggregate acreage and counts by crop, district, season, crop-cycle status and recorded sowing month while omitting membership, farmer, farm and precise-location identifiers.

Promoter operations responses are read-only projections over `KisanClubPromoterProfile`, active `KisanClubPromoterAssignment` rows and the current holder of `KisanClubFulfilmentAssignment`. The profile's denormalised `activeFarmerCount` is not used as the reporting source. Reassignment means these coordination outcomes are a current-holder snapshot, not immutable historical attribution. Forecast persistence and model outputs remain deferred.

## Stored files

`StoredFile` is the authoritative record of an object held in storage: owner, optional organisation, purpose, lifecycle status, server-generated object key, declared and observed size, checksum, scan result and rejection reason. Bytes live in object storage and never in the database.

The `objectKey` is generated as `purpose/yyyymm/uuid.ext` and is unique. The client-supplied filename is retained in `originalFilename` for display only — it never forms part of the key, because it is untrusted input and would leak personal data into storage paths and access logs.

Status runs `PENDING_UPLOAD -> PENDING_SCAN -> AVAILABLE`, with `INFECTED` and `REJECTED` terminal. A database `CHECK` constraint requires `AVAILABLE` rows to carry a `CLEAN` scan result with both `scanCompletedAt` and `uploadedAt` set, so no application path can publish a file that was never scanned. `declaredSizeBytes` records what the client promised when the upload URL was issued and is kept alongside the observed `sizeBytes`, so a client that misdeclares can be detected at confirm time.

`KycDocument.storedFileId` and `SupportTicketEvidence.storedFileId` are nullable foreign keys added by WP-08. Their pre-existing free-text `storageKey` columns remain populated for rows created during the metadata-only era; migrating those rows depends on the pilot data decision in WP-16. New uploads populate `storedFileId` only.

Deletion is a status change to `DELETED` plus removal of the underlying object. Rows are never hard-deleted, so the audit trail of who uploaded and who downloaded a file survives the file itself.

## Notification preferences

`NotificationPreference` is unique per user, category and channel. Absence means "use the default for that category" rather than "disabled", so a recipient who has never opened the settings screen receives everything.

Only categories the platform classes as optional — advisory and marketing — may be set to `enabled = false`. The class is resolved in code (`notification-categories.ts`) rather than stored on the row, and is re-evaluated at send time: a category can be reclassified as the domain grows, and a preference saved while it was optional must not silence it once it becomes transactional. An unclassified category is treated as transactional, because failing to deliver an unknown event is worse than failing to suppress it.

Notification rows themselves are created one per channel. An event delivered both in-app and by SMS produces two `Notification` rows sharing a category and payload snapshot, each with its own status, attempt history and provider reference, so one transport failing cannot misrepresent another.

One-time passcodes are deliberately **not** represented here. An OTP never becomes a `Notification` row, because those rows are readable through the recipient's own inbox API; only the salted hash on `OtpChallenge` is persisted.

## Product imagery

`MasterProduct.primaryImageStoredFileId` is a nullable foreign key to `StoredFile`, holding the pack shot a farmer sees. It is nullable because a product can be approved and sellable before its photography exists; clients fall back to a labelled placeholder rather than a broken image. Deletion of the file is `SET NULL`, so removing an image neither is blocked by nor cascades into the product record.

Discovery responses expose `primaryImageUrl` pointing at `GET /marketplace/products/:id/image`, a stable public endpoint that redirects to a short-lived storage URL. The URL in the payload deliberately does not carry a signature: farmer discovery is cached on device for 24 hours, and an embedded signature would expire inside that window.

Product photography is public marketing material and is served without authentication, unlike every other `StoredFile` purpose, which is permission-checked and — for KYC and invoices — audited on each download.
