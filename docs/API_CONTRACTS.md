# API Contracts

## Kisan Club Advisory (KC-09)

- Authoring: `GET/POST /api/v1/advisory/rules`, `GET/PATCH /api/v1/advisory/rules/:id`, then explicit `/submit`, `/review` and `/archive` actions. Authors need `advisory-rules:manage`; only an `AGRONOMIST` with `advisory-rules:review` may approve, and self-approval is rejected.
- Generation: `POST /api/v1/advisory/generate` performs the documented deterministic daily sweep. It is a manually/cron-triggered stopgap until the background-worker work package lands.
- Farmer reads: `GET /api/v1/advisory/me`, `GET /api/v1/advisory/me/:id`, `POST /api/v1/advisory/me/:id/read` and `/dismiss`. Reads are membership-owned and require advisory consent.
- Only `APPROVED` bilingual rule versions can produce events. One event exists per crop cycle, rule and version. Farmer payloads are localized using the stored preferred locale.
- Product mappings and automatic pesticide recommendations are not part of this contract.

## General Rules

- Version all APIs under `/api/v1`.
- Use JSON request and response bodies.
- Use UUID identifiers for public resources.
- Enforce server-side permissions.
- Validate all external input.
- Return standard error envelopes.
- Include or return `x-request-id` for correlation.
- Use idempotency keys for checkout, mock payment and future webhook endpoints.

## Standard Success Envelope

```json
{
  "data": {},
  "requestId": "example-request-id"
}
```

## Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "statusCode": 400,
    "requestId": "example-request-id",
    "timestamp": "2026-08-01T00:00:00.000Z",
    "details": []
  }
}
```

## Foundation And Phase 1A Endpoints

### `GET /api/v1/health`

Returns API liveness.

### `GET /api/v1/health/ready`

Checks database and Redis readiness.

### `POST /api/v1/users`

Creates a user account. Requires `users:create`.

### `GET /api/v1/users`

Lists users with pagination. Requires `users:read:any`.

### `GET /api/v1/users/:userId`

Reads one user with profile and memberships. Requires `users:read:any`.

### `PATCH /api/v1/users/:userId`

Updates user contact, profile and status fields. Requires `users:update:any`. Writes audit records for user, profile and status changes.

### `POST /api/v1/organisations`

Creates an organisation in pending verification by default. Requires `organisations:create`. A supplied GSTIN is normalised to uppercase and must match the accepted 15-character structure; its first two digits are stored as the unverified registered-state candidate.

### `GET /api/v1/organisations`

Lists organisations with pagination. Requires `organisations:read:any`.

### `GET /api/v1/organisations/:organisationId`

Reads one organisation. Users with `organisations:read:any` may read any organisation. Users with `organisations:read:own` may read only the organisation in their active request context.

### `PATCH /api/v1/organisations/:organisationId`

Updates organisation profile fields. Requires `organisations:update:any`. Changing a GSTIN clears its verification timestamp and returns an active organisation to `PENDING_VERIFICATION`; invoice generation remains blocked until the organisation is reviewed again.

### `POST /api/v1/organisations/:organisationId/review`

Approves or rejects an organisation. Requires `organisations:approve`. Approval sets status to `ACTIVE`; rejection sets status to `REJECTED`. The reviewer, timestamp and reason are persisted and audited. For `COMPANY` and `DISTRIBUTOR` organisations, approval is rejected unless the matching onboarding profile exists and at least one KYC document metadata record is `APPROVED`. Distributor approval additionally requires a structurally valid GSTIN and records `registeredStateCode` plus `gstinVerifiedAt`; rejection clears that verification snapshot.

### `POST /api/v1/organisations/:organisationId/memberships`

Creates an organisation membership. Requires `memberships:create`. Duplicate user, organisation and role combinations are rejected.

### `GET /api/v1/organisations/:organisationId/memberships`

Lists memberships for one organisation. Users with `memberships:read:any` may read any organisation. Users with `memberships:read:own` may read only the organisation in their active request context.

### `PATCH /api/v1/organisations/:organisationId/memberships/:membershipId`

Updates membership status. Requires `memberships:update:any`. Memberships are not physically deleted; use `REMOVED` status.

### `GET /api/v1/access/roles`

Lists platform role-to-permission mappings. Requires `roles:read`.

### `GET /api/v1/access/permissions`

Lists available permission codes. Requires `roles:read`.

### `GET /api/v1/audit-logs`

Lists audit entries with pagination and filters. Requires `audit:read`.

## Phase 1B Onboarding Endpoints

### `GET /api/v1/onboarding/approval-queue`

Lists pending company and distributor organisations for onboarding review. Requires `onboarding:queue:read`.

Supported filters:

- `type`: `COMPANY` or `DISTRIBUTOR`
- `status`: organisation review status, defaulting to `PENDING_VERIFICATION`
- `missingProfile`: `true` to return organisations without the matching company or distributor profile
- `page`, `limit`: standard pagination

Each queue item includes the organisation, whether the onboarding profile exists, submitted/approved/rejected KYC document counts and `missingRequirements`. Missing requirements may include `PROFILE`, `KYC_DOCUMENT` and `APPROVED_KYC_DOCUMENT`.

### `GET /api/v1/onboarding/organisations/:organisationId`

Reads one organisation with its onboarding profile, KYC document metadata and organisation review metadata. Users with `onboarding:read:any` may read any onboarding record. Users with `onboarding:read:own` may read only their active organisation context.

### `PUT /api/v1/onboarding/organisations/:organisationId/company-profile`

Creates or updates the company-specific onboarding profile for a `COMPANY` organisation. Requires `onboarding:write:any` for operations users or `onboarding:write:own` for users acting inside the same organisation. Writes an audit record for create and update actions.

### `PUT /api/v1/onboarding/organisations/:organisationId/distributor-profile`

Creates or updates the distributor-specific onboarding profile for a `DISTRIBUTOR` organisation. Requires `onboarding:write:any` for operations users or `onboarding:write:own` for users acting inside the same organisation. Writes an audit record for create and update actions.

### `POST /api/v1/onboarding/organisations/:organisationId/kyc-documents`

Creates KYC document metadata for a company or distributor organisation. Requires `kyc-documents:write:any` or same-organisation `kyc-documents:write:own`. This endpoint stores document metadata only; real file upload, private storage and signed document access are not implemented in Phase 1B.

### `PATCH /api/v1/onboarding/organisations/:organisationId/kyc-documents/:documentId`

Updates KYC document metadata and review status. Requires `kyc-documents:review` for approval, rejection, expiry and reviewer-only changes. Same-organisation submitters may update editable metadata and may resubmit a rejected document by moving it back to `SUBMITTED`. Approved or expired KYC metadata cannot be modified by the submitting organisation. Every update writes an audit record with previous and new values.

## Phase 2A Catalogue Endpoints

Catalogue records use `CatalogueStatus`: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` and `ARCHIVED`. Phase 2A catalogue document APIs store metadata only and do not upload or serve private files.

### `GET /api/v1/catalogue/brands`

Lists brand records with pagination. Users with `catalogue:read:any` may read all brands and filter by `companyOrganisationId`. Users with `catalogue:read:own` may read only brands for their active company organisation.

Supported filters: `status`, `companyOrganisationId`, `q`, `page` and `limit`.

### `GET /api/v1/catalogue/brands/review-queue`

Lists brand records for catalogue reviewers. Requires `catalogue:queue:read` and defaults to `SUBMITTED` records.

### `POST /api/v1/catalogue/brands`

Creates a company-owned brand record. Requires `catalogue:write:any` for operations/admin users or `catalogue:write:own` for users acting inside an active `COMPANY` organisation. Writes `BRAND_CREATED` audit history.

### `GET /api/v1/catalogue/brands/:brandId`

Reads one brand record. Enforces any-catalogue or same-company catalogue read permission.

### `PATCH /api/v1/catalogue/brands/:brandId`

Updates brand metadata. Updating an approved brand moves it back to `DRAFT` and clears reviewer metadata. Writes `BRAND_UPDATED` audit history.

### `POST /api/v1/catalogue/brands/:brandId/submit`

Submits a draft or rejected brand for catalogue review. Requires `catalogue:submit:own` for same-company users or `catalogue:write:any` for operations/admin users. Writes `BRAND_SUBMITTED` audit history.

### `POST /api/v1/catalogue/brands/:brandId/review`

Approves or rejects a submitted brand. Requires `catalogue:review`. Writes `BRAND_APPROVED` or `BRAND_REJECTED` audit history.

### `GET /api/v1/catalogue/products`

Lists master products with variants and document metadata. Users with `catalogue:read:any` may read all company products and filter by `companyOrganisationId`. Users with `catalogue:read:own` may read only products for their active company organisation.

Supported filters: `status`, `companyOrganisationId`, `q`, `page` and `limit`.

### `GET /api/v1/catalogue/products/review-queue`

Lists master products for catalogue review. Requires `catalogue:queue:read` and defaults to `SUBMITTED` records. Each queue item includes active variant count, document count and `missingRequirements`.

### `POST /api/v1/catalogue/products`

Creates a master product under an existing company-owned brand. Requires catalogue write permission for the owning company context. Writes `MASTER_PRODUCT_CREATED` audit history.

### `GET /api/v1/catalogue/products/:productId`

Reads one master product with brand, company, variant, document and reviewer metadata. The response includes `missingRequirements`, which can contain `APPROVED_BRAND`, `ACTIVE_VARIANT`, `VARIANT_TAX_METADATA` or `PRODUCT_DOCUMENT`.

### `PATCH /api/v1/catalogue/products/:productId`

Updates master product metadata. Updating an approved product moves it back to `DRAFT` and clears reviewer metadata. Writes `MASTER_PRODUCT_UPDATED` audit history.

### `POST /api/v1/catalogue/products/:productId/variants`

Creates variant and pack-size metadata for one master product. `mrpPaise`, when provided, is an integer amount in paise. Optional `hsnCode` is 4–8 digits and optional `gstRateBps` is an integer from 0 through 10,000 basis points. Both fields must exist on every active variant before product submission. Writes `PRODUCT_VARIANT_CREATED` audit history. Adding a variant to an approved product reopens the product as `DRAFT`.

### `PATCH /api/v1/catalogue/products/:productId/variants/:variantId`

Updates company-owned variant, pack and tax-classification metadata. The same validation and company resource boundary as variant creation apply. Updating a variant on an approved product reopens the product as `DRAFT`, clears its review metadata and writes `PRODUCT_VARIANT_UPDATED` audit history.

### `POST /api/v1/catalogue/products/:productId/documents`

Creates product document metadata for one master product. Supported document types are `LABEL`, `REGISTRATION_CERTIFICATE`, `SAFETY_DATA_SHEET`, `PRODUCT_IMAGE`, `TEST_REPORT` and `OTHER`. Writes `PRODUCT_DOCUMENT_METADATA_CREATED` audit history. Adding document metadata to an approved product reopens the product as `DRAFT`.

### `POST /api/v1/catalogue/products/:productId/submit`

Submits a draft or rejected product for review. The backend rejects submission unless the brand is approved, at least one variant is active, every active variant has HSN and GST-rate metadata, and at least one document metadata record exists. Writes `MASTER_PRODUCT_SUBMITTED` audit history.

### `POST /api/v1/catalogue/products/:productId/review`

Approves or rejects a submitted master product. Approval repeats the backend readiness checks. Requires `catalogue:review`. Writes `MASTER_PRODUCT_APPROVED` or `MASTER_PRODUCT_REJECTED` audit history.

## Phase 2B Inventory Endpoints

Inventory records are scoped to distributor organisations. Users with `warehouses:*:own` or `inventory:*:own` may only access records for their active distributor organisation. Users with `*:any` inventory permissions may access records across distributors. Inventory APIs do not create distributor offers, checkout reservations or farmer-visible availability.

### `GET /api/v1/inventory/warehouses`

Lists distributor warehouse records with pagination. Supported filters are `status`, `distributorOrganisationId`, `q`, `page` and `limit`.

### `POST /api/v1/inventory/warehouses`

Creates a warehouse for an active `DISTRIBUTOR` organisation. Requires `warehouses:write:own` for same-distributor users or `warehouses:write:any` for operations/admin users. Writes `WAREHOUSE_CREATED` audit history.

### `GET /api/v1/inventory/warehouses/:warehouseId`

Reads one warehouse. Enforces any-warehouse or same-distributor warehouse read permission.

### `PATCH /api/v1/inventory/warehouses/:warehouseId`

Updates warehouse metadata or status. Requires any-warehouse or same-distributor warehouse write permission. Writes `WAREHOUSE_UPDATED` audit history.

### `GET /api/v1/inventory/batches`

Lists batch stock records with backend-calculated `onHandQuantity`, `sellableQuantity` and `isExpired` fields. Supported filters are `status`, `distributorOrganisationId`, `warehouseId`, `batchId`, `productId`, `variantId`, `q`, `page` and `limit`.

### `POST /api/v1/inventory/batches`

Creates batch metadata under an active warehouse. The referenced product variant must be active, and its master product must be `APPROVED`. Optional `openingQuantity` creates an `OPENING_STOCK` inventory movement. Requires inventory write permission and writes `INVENTORY_BATCH_CREATED`; opening stock also writes `INVENTORY_MOVEMENT_RECORDED`.

### `GET /api/v1/inventory/batches/:batchId`

Reads one batch with warehouse, distributor, product, variant, recent movement history and backend-calculated stock fields.

### `PATCH /api/v1/inventory/batches/:batchId`

Updates batch metadata or batch status. Blocking a batch requires a blocked reason. Requires inventory write permission and writes `INVENTORY_BATCH_UPDATED`.

### `POST /api/v1/inventory/batches/:batchId/adjustments`

Creates an append-only stock movement for a batch. Allowed adjustment movement types are `STOCK_RECEIVED`, `MANUAL_INCREASE`, `MANUAL_DECREASE` and `DAMAGE_WRITE_OFF`; `OPENING_STOCK` is only created during batch creation. A reason is required. The backend rejects any adjustment that would reduce batch stock below zero. Writes `INVENTORY_MOVEMENT_RECORDED`.

### `GET /api/v1/inventory/movements`

Lists append-only inventory movement records with pagination. Supported filters are `distributorOrganisationId`, `warehouseId`, `batchId`, `productId`, `variantId`, `movementType`, `page` and `limit`.

## Phase 2C Distributor Offer Endpoints

Distributor offer records are scoped to distributor organisations. Users with `offers:*:own` may only access records for their active distributor organisation. Users with `offers:*:any`, `offers:queue:read` or `offers:review` can review across distributors according to their assigned permissions. Phase 2C offer APIs do not create carts, inventory reservations, checkout records, orders, delivery tasks, finance records or Tally entries.

Offer records use `DistributorOfferStatus`: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PAUSED` and `ARCHIVED`. Fulfilment metadata uses `FulfilmentMode`: `DISTRIBUTOR_FULFILLED`, `VARDHNAM_FULFILLED` and `PICKUP`.

### `GET /api/v1/offers`

Lists distributor offers with backend-calculated `availableQuantity` and `missingRequirements`. Supported filters are `status`, `distributorOrganisationId`, `productId`, `variantId`, `warehouseId`, `batchId`, `serviceablePincode`, `q`, `page` and `limit`.

### `GET /api/v1/offers/review-queue`

Lists distributor offers for review. Requires `offers:queue:read` and defaults to `SUBMITTED` records. Each queue item includes the offer, backend-derived `availableQuantity` and readiness `missingRequirements`.

### `POST /api/v1/offers`

Creates a distributor-owned offer against an approved master product and active variant. The warehouse must be active and owned by the same distributor. Optional `batchId` must belong to the same distributor, warehouse, product and variant. Price is stored in `sellingPricePaise`. Writes `DISTRIBUTOR_OFFER_CREATED` audit history.

### `GET /api/v1/offers/:offerId`

Reads one offer with distributor, product, variant, warehouse, optional batch, review metadata, backend-derived availability and readiness checks. Enforces any-offer or same-distributor read permission.

### `PATCH /api/v1/offers/:offerId`

Updates offer commercial metadata such as offer code, selling price, order quantity bounds, serviceable pincodes, fulfilment mode and delivery SLA metadata. Updating a submitted or approved offer returns it to `DRAFT` and clears reviewer metadata. Writes `DISTRIBUTOR_OFFER_UPDATED` audit history.

### `POST /api/v1/offers/:offerId/submit`

Submits a draft or rejected offer for Vardhnam review. The backend rejects submission unless the product is approved, the variant is active, the warehouse is active, the price and order quantity range are valid, serviceable pincodes are present, required SLA metadata is present and derived sellable inventory is greater than zero. Writes `DISTRIBUTOR_OFFER_SUBMITTED` audit history.

### `POST /api/v1/offers/:offerId/review`

Approves or rejects a submitted distributor offer. Approval repeats backend readiness checks and requires `offers:review`. Rejection requires a reason. Writes `DISTRIBUTOR_OFFER_APPROVED` or `DISTRIBUTOR_OFFER_REJECTED` audit history.

## Phase 2D Marketplace Discovery Endpoints

Marketplace discovery endpoints are public and read-only in Phase 2D. They expose only approved master products with approved distributor offers that serve the requested pincode and have backend-derived available quantity greater than zero. They do not create carts, checkout records, orders, reservations, payments, delivery tasks, finance records, settlement records or Tally entries.

### `GET /api/v1/marketplace/products`

Lists farmer-safe marketplace product summaries. `pincode` is required and must be a six-digit Indian pincode. Supported optional filters are `category`, `brandId`, `brandSlug`, `q`, `page` and `limit`.

Each item includes:

- master product identity, name, slug, category and crop targets
- approved brand and company display metadata
- requested serviceable pincode
- lowest approved offer price in paise
- backend-derived total available quantity across eligible offers
- seller count, offer count and fulfilment modes
- eligible offer summaries with seller legal/display name, GSTIN, warehouse city/state/pincode, optional batch metadata, price in paise, quantity limits, delivery SLA metadata and backend-derived availability

Supports exact `cropTarget` filtering in addition to pincode, category, brand,
search and pagination filters.

### `GET /api/v1/marketplace/products/filter-options`

Returns public `categories`, `brands` and `cropTargets` for a required pincode.
Options are derived only from approved catalogue products and offers belonging
to active distributors and warehouses with serviceable, active, unexpired and
backend-derived sellable stock. The endpoint is read-only and does not expose
private catalogue metadata.

Search text matches product name, slug, category, brand name or variant name. Results exclude unapproved catalogue records, unapproved/paused/rejected distributor offers, inactive variants, inactive warehouses, inactive distributor organisations, blocked/expired batches and zero-stock offers.

### `GET /api/v1/marketplace/products/:productId`

Reads one farmer-safe marketplace product detail for a required `pincode`. The response includes the same offer, seller, fulfilment and backend-derived availability fields as the list response, plus product description, active variants and public product document metadata. Private product document storage fields such as `fileName` and `storageKey` are not returned.

If the product has no approved, serviceable and stocked offer for the requested pincode, the API returns `NOT_FOUND`.

## Phase 2E Offer Operations And Inventory Reporting Endpoints

Phase 2E adds operational status controls and read-only inventory reports. These APIs do not create carts, inventory reservations, checkout records, orders, delivery tasks, payment records, finance records, settlement records or Tally entries.

### `POST /api/v1/offers/:offerId/pause`

Pauses an approved distributor offer. Requires offer write permission for the owning distributor or any-offer write permission for operations users. Only `APPROVED` offers may be paused. Paused offers are excluded from farmer marketplace discovery. A `reason` is required and the action writes `DISTRIBUTOR_OFFER_PAUSED` audit history.

### `POST /api/v1/offers/:offerId/reactivate`

Reactivates a paused distributor offer back to `APPROVED`. Requires offer write permission. The backend repeats readiness checks before reactivation, including approved catalogue, active variant, active warehouse, serviceable pincodes, valid price/SLA metadata and backend-derived sellable inventory greater than zero. A `reason` is required and the action writes `DISTRIBUTOR_OFFER_REACTIVATED` audit history.

### `POST /api/v1/offers/:offerId/archive`

Archives a distributor offer without physically deleting it. Requires offer write permission. Archived offers cannot be edited through normal update flows and are excluded from farmer marketplace discovery. A `reason` is required and the action writes `DISTRIBUTOR_OFFER_ARCHIVED` audit history.

### `GET /api/v1/inventory/reports/ageing`

Returns a read-only inventory ageing report over distributor batch stock. Supported filters are `distributorOrganisationId`, `warehouseId`, `productId`, `variantId`, `lowStockThreshold`, `expiringWithinDays`, `page` and `limit`. Users with any-inventory read permission may filter across distributors; users with own-inventory read permission are scoped to their active distributor organisation.

Each row includes batch, distributor, warehouse, product, variant, backend-derived on-hand and sellable quantities, stock age in days, stock age bucket, days until expiry, low-stock flag, expiring-soon flag, expired flag, blocked flag and an ageing bucket.

### `GET /api/v1/inventory/reports/low-stock`

Returns only active, unexpired and unblocked batch rows whose backend-derived sellable quantity is less than or equal to `lowStockThreshold`. Zero-stock active rows are included so operations can replenish them. Blocked and expired rows are not treated as low-stock sellable inventory.

### `GET /api/v1/inventory/reports/expiring-batches`

Returns only active, unexpired and unblocked batch rows whose expiry date is within `expiringWithinDays`. The report is read-only and does not change batch status automatically.

## Phase 3A Farmer Profile, Address And Cart Endpoints

Phase 3A adds authenticated farmer-owned profile, address and cart foundations. These APIs do not create checkout records, inventory reservations, product orders, delivery tasks, payment records, finance records, settlement records or Tally entries.

Farmer profile and cart APIs require the configured protected-request authentication mechanism for a user with the `FARMER` role and farmer permissions. Production mode uses a Bearer access token; verified mock headers remain local/test-only. Farmer data ownership is enforced by `actor.userId`, not by distributor or company organisation ownership.

### `GET /api/v1/farmers/me`

Reads the authenticated farmer's profile with owned address records. Requires `farmer-profile:read:own`. Returns `NOT_FOUND` until the farmer profile is created.

### `PUT /api/v1/farmers/me/profile`

Creates or updates the authenticated farmer's profile. Requires `farmer-profile:write:own`. Supported fields are `fullName`, `alternatePhone`, `preferredLocale`, `village`, `district`, `state`, `primaryPincode` and `cropInterests`. Writes `FARMER_PROFILE_CREATED` or `FARMER_PROFILE_UPDATED` audit history.

### `GET /api/v1/farmers/me/addresses`

Lists the authenticated farmer's addresses. Requires `farmer-addresses:read:own`.

### `POST /api/v1/farmers/me/addresses`

Creates an owned farmer address. Requires `farmer-addresses:write:own`. `stateCode` is the two-digit GST state/UT code used for the eventual place of supply; the backend derives it for recognised state names and rejects a supplied code that conflicts with that state. The first address becomes default automatically unless another default is explicitly managed later. Writes `FARMER_ADDRESS_CREATED` audit history.

### `PATCH /api/v1/farmers/me/addresses/:addressId`

Updates an owned farmer address. Requires `farmer-addresses:write:own`. State-code derivation and mismatch validation are repeated against the merged address. If `isDefault=true`, other addresses for the farmer profile are unset as default. Writes `FARMER_ADDRESS_UPDATED` audit history.

### `GET /api/v1/cart`

Reads or creates the authenticated farmer's active cart after a farmer profile exists. Requires `cart:read:own`. The response includes cart pincode/address context, item snapshots, item count and backend-calculated `subtotalPaise`. Each item also includes the related offer's current `minimumOrderQuantity` and nullable `maximumOrderQuantity`; these are live quantity constraints, not financial snapshots. The existing `availableQuantitySnapshot` remains the backend-derived availability captured during the latest successful cart mutation.

### `PATCH /api/v1/cart/context`

Sets the cart serviceable pincode directly or from an owned `farmerAddressId`. Requires `cart:write:own`. If the cart already contains items, changing to a different pincode is rejected until the cart is cleared. Writes `CART_CONTEXT_UPDATED` audit history.

### `POST /api/v1/cart/items`

Adds or replaces an item for an approved distributor offer. Requires `cart:write:own`. The backend validates:

- the offer is `APPROVED`
- the requested pincode is in `DistributorOffer.serviceablePincodes`
- the product and brand are approved
- the variant, warehouse and distributor are active
- the optional batch is active and unexpired
- requested quantity respects offer minimum and maximum quantities
- requested quantity does not exceed backend-derived sellable availability

The cart item stores price, availability, pincode, product, variant, seller, warehouse and fulfilment snapshots from the backend. It does not reserve stock. Writes `CART_ITEM_ADDED` or `CART_ITEM_UPDATED` audit history.

### `PATCH /api/v1/cart/items/:cartItemId`

Updates the quantity for an owned cart item. Requires `cart:write:own`. The backend revalidates the current offer and stock before updating snapshots. Writes `CART_ITEM_UPDATED` audit history.

### `DELETE /api/v1/cart/items/:cartItemId`

Removes an owned cart item. Requires `cart:write:own`. Writes `CART_ITEM_REMOVED` audit history.

### `DELETE /api/v1/cart/items`

Clears all items from the authenticated farmer's cart. Requires `cart:write:own`. Writes `CART_CLEARED` audit history.

## Phase 3B Checkout And Product Order Endpoints

Phase 3B adds authenticated farmer-owned checkout and product order foundations. These APIs create parent checkout records, split child product orders by distributor seller and reserve inventory through append-only inventory movements. They do not create payment captures, delivery tasks, invoices, finance ledger entries, settlement records or Tally records.

Checkout and order APIs require mock-auth headers for a user with the `FARMER` role and checkout/order permissions. Ownership is enforced by `actor.userId` through the farmer profile.

### `POST /api/v1/checkout/from-cart`

Creates a checkout from the authenticated farmer's active cart. Requires `checkout:create:own` and an `Idempotency-Key` header. The request body may include `farmerAddressId` and `reason`; if `farmerAddressId` is omitted, the cart must already have a selected delivery address.

The backend revalidates every cart item against current approved distributor offers, approved catalogue, serviceable pincode, active distributor and warehouse state, active unexpired batches, offer quantity limits and backend-derived sellable availability. Cart snapshots are not trusted as final checkout state.

The response includes the parent product checkout, selected delivery address, backend-calculated subtotal in paise, child order count and child product orders. Each child order contains exactly one distributor seller, item snapshots, batch-level reservation rows and status history. Successful checkout writes `PRODUCT_CHECKOUT_CREATED`, `PRODUCT_ORDER_CREATED`, `PRODUCT_ORDER_INVENTORY_RESERVED`, `INVENTORY_RESERVED_FOR_ORDER` and `CART_CHECKED_OUT` audit history.

Successful checkout clears the active cart item rows and cart pincode/address context. The cart remains available for future shopping. Duplicate requests with the same `Idempotency-Key` and same request body return the stored checkout response instead of creating duplicate orders.

### `GET /api/v1/checkout/:checkoutId`

Reads one authenticated farmer-owned checkout with child orders, item snapshots, reservation rows and status history. Requires `checkout:read:own`.

### `GET /api/v1/orders`

Lists authenticated farmer-owned product orders with pagination. Requires `orders:read:own`. Supports optional `status`, `page` and `limit` query parameters.

### `GET /api/v1/orders/:orderId`

Reads one authenticated farmer-owned product order with item snapshots, reservation rows and status history. Requires `orders:read:own`.

## Phase 3C Mock Payment Endpoints

Phase 3C adds authenticated farmer-owned mock payment foundations. These APIs create mock-only payment intent records, record append-only payment events, and use backend confirmation to move checkouts and child orders through payment statuses. They do not call a real payment provider, capture real money, create payment webhooks, create invoices, write finance ledger entries, release reservations, execute delivery, create settlements or write Tally data.

Mock payment APIs require mock-auth headers for a user with the `FARMER` role and payment permissions. Ownership is enforced by `actor.userId` through the farmer profile.

`ProductCheckout.status` may now be `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `PAYMENT_FAILED`, `PAID` or `CANCELLED`. Phase 3C uses `PAYMENT_PROCESSING`, `PAYMENT_FAILED` and `PAID` only through backend payment actions.

### `POST /api/v1/payments/mock-intents`

Creates or returns an open mock payment intent for an owned checkout. Requires `payments:create:own` and an `Idempotency-Key` header.

Request body:

- `checkoutId`: owned product checkout ID.
- `reason`: optional audit reason.

The backend requires the checkout to be `PENDING_PAYMENT` or `PAYMENT_FAILED`, to have at least one child order, and for child orders to have reserved inventory or a prior payment failure. Existing open mock intents for the checkout are returned instead of creating duplicates. Existing successful payment intents reject new payment creation.

Successful creation sets the checkout to `PAYMENT_PROCESSING`, moves child orders to `PAYMENT_PROCESSING`, writes `INTENT_CREATED` payment event history and audits `PRODUCT_CHECKOUT_PAYMENT_PROCESSING`, `PRODUCT_ORDER_PAYMENT_PROCESSING` and `MOCK_PAYMENT_INTENT_CREATED`.

### `GET /api/v1/payments/mock-intents`

Lists authenticated farmer-owned mock payment intents. Requires `payments:read:own`. Supports `checkoutId`, `page` and `limit`.

### `GET /api/v1/payments/mock-intents/:paymentIntentId`

Reads one authenticated farmer-owned mock payment intent with checkout summary, child order status summaries and payment event history. Requires `payments:read:own`.

### `POST /api/v1/payments/mock-intents/:paymentIntentId/confirm`

Confirms a mock payment intent server-side. Requires `payments:confirm:own` and an `Idempotency-Key` header.

Request body:

- `outcome`: `SUCCESS` or `FAILURE`.
- `failureCode`: optional mock failure code.
- `failureMessage`: optional mock failure message.
- `reason`: optional audit reason.

For `SUCCESS`, the backend marks the payment intent `SUCCEEDED`, the checkout `PAID`, and all child orders `CONFIRMED`. For `FAILURE`, the backend marks the payment intent `FAILED`, the checkout `PAYMENT_FAILED`, and all child orders `PAYMENT_FAILED`. Both outcomes write payment events, audit records and a locale-aware farmer `IN_APP` notification (`PAYMENT_SUCCEEDED` or `PAYMENT_FAILED`) in the same transaction. Its `ProductCheckout` snapshot contains the backend-owned integer-paise amount and checkout/payment-intent identifiers; it intentionally does not select one child-order deep link for a potentially multi-seller checkout. Inventory reservations remain in place until an eligible Phase 3D cancellation releases them.

## Payment Provider Webhooks And Reconciliation

The provider boundary supports intent creation, byte-exact webhook signature verification, provider-status reads and refunds. Only the `mock` provider is enabled until the business selects and supplies a merchant sandbox; it performs no network calls or real money movement.

### `POST /api/v1/payments/webhooks/:provider`

This provider callback is authenticated by `x-webhook-signature`, not a platform bearer token. The backend verifies the signature against the raw request bytes before parsing or persisting the body. A failed signature returns `401` and writes a security audit record containing only correlation metadata and a SHA-256 digest, not the untrusted payload.

A verified event is stored as an append-only `WebhookEvent`, deduplicated by provider and provider event ID, and queued for asynchronous processing. A capture can settle an intent only when its provider-supplied integer-paise amount exactly matches the backend-owned intent amount. Settlement updates the payment, checkout and seller child orders and writes payment history, finance ledger, audit and notification records in one serializable transaction. Replays and duplicate events do not settle twice.

### `GET /api/v1/payments/reconciliation`

Requires `payments-reconciliation:read`. Returns paginated payment intents that are stale, have a recorded provider/platform terminal-status mismatch, or have failed webhook events. The scheduled reconciliation sweep reads provider status for stale `PROCESSING` intents and records observations and mismatches; it does not silently settle a disagreement.

## Phase 3D Cancellation And Reservation Release Endpoints

Phase 3D adds authenticated farmer-owned cancellation foundations for unpaid or payment-failed product checkouts and child product orders. These APIs transition eligible records to `CANCELLED`, release reserved stock through append-only `RELEASED_FROM_ORDER` inventory movements and write audit history. They do not create delivery execution, invoices, finance ledger entries, settlements, refunds, real payment-provider reversals or Tally records.

Cancellation APIs require mock-auth headers for a user with the `FARMER` role and cancellation permissions. Ownership is enforced by `actor.userId` through the farmer profile. Both endpoints require an `Idempotency-Key` header; duplicate requests with the same key and same body return the stored response.

Eligible checkout statuses are `PENDING_PAYMENT` and `PAYMENT_FAILED`. `PAYMENT_PROCESSING` is rejected to avoid cancelling while a mock payment attempt is in flight. `PAID` is rejected because refunds are not implemented in this phase. Eligible child order statuses are `PENDING_PAYMENT`, `INVENTORY_RESERVED` and `PAYMENT_FAILED`.

### `POST /api/v1/checkout/:checkoutId/cancel`

Cancels an owned eligible checkout and all non-cancelled eligible child orders. Requires `checkout:cancel:own` and an `Idempotency-Key` header.

Request body:

- `reason`: optional audit reason.

For each order-item reservation, the backend writes a positive `RELEASED_FROM_ORDER` inventory movement with `referenceType = ProductOrderCancellation` and `referenceId = productOrder.id`. It then writes `PRODUCT_ORDER_CANCELLED_BY_FARMER`, `PRODUCT_CHECKOUT_CANCELLED_BY_FARMER` and `INVENTORY_RELEASED_FROM_ORDER` audit entries.

### `POST /api/v1/orders/:orderId/cancel`

Cancels one owned eligible child product order. Requires `orders:cancel:own` and an `Idempotency-Key` header.

Request body:

- `reason`: optional audit reason.

The backend releases only that order's reservation movements and records the order status transition to `CANCELLED`. If all child orders under the parent checkout are cancelled after this action, the parent checkout also transitions to `CANCELLED`. If only some child orders are cancelled, the parent checkout remains in its prior unpaid or payment-failed status until a future partial-cancellation status model is added.

## Phase 4A To 4E Distributor Fulfilment Endpoints

### `GET /api/v1/delivery-partners/me`

Returns the authenticated delivery partner's operational profile for the active delivery-partner organisation context. Requires `delivery-partner-profile:read:own`. If no profile has been created, the response reports `OFFLINE` without mutating storage.

### `PUT /api/v1/delivery-partners/me/availability`

Creates or updates the authenticated delivery partner's organisation-scoped `ONLINE`/`OFFLINE` availability. Requires `delivery-partner-profile:write:own`, validates the active membership and organisation type, and audits actual state changes as `DELIVERY_PARTNER_AVAILABILITY_UPDATED`. Replaying the current value returns it without writing a duplicate audit record.

Request body:

- `availabilityStatus`: `ONLINE` or `OFFLINE`.

Phase 4A adds distributor-facing product order fulfilment reads and accept/reject transitions. Phase 4B adds picking and packing status transitions. Phase 4C adds one distributor invoice snapshot per packed child product order. Phase 4D adds dispatch readiness for packed, invoiced child orders. Phase 4E adds delivery assignment, out-for-delivery transition and mock OTP completion. These APIs operate on child `PRODUCT_ORDER` records where the distributor is seller of record. They do not send real SMS or WhatsApp messages, capture payments, issue refunds, post finance ledger entries, settle parties, generate invoice PDFs or write Tally records.

Fulfilment APIs require authentication. Users with `fulfilment-orders:read:own` or `fulfilment-orders:manage:own` may only access orders whose `sellerOrganisationId` matches their active distributor organisation. Vardhnam operations/admin users with `fulfilment-orders:*:any` may access orders across sellers. Delivery partners with `delivery-assignments:read:own` can list and read only orders assigned to their authenticated user ID; they cannot use `sellerOrganisationId` to browse a distributor queue. Delivery assignment creation requires `delivery-assignments:manage:any`; delivery partners with `delivery-assignments:manage:own` may only respond to, verify pickup for, move and complete their own assignments. Every order status transition writes `ProductOrderStatusHistory`; assignment-only transitions write audit records without inventing an order transition. Invoice generation writes a `ProductInvoice` record and audits `PRODUCT_INVOICE_GENERATED`. Dispatch readiness writes a `ProductDispatch` record, transitions the child order to `READY_FOR_PICKUP`, audits `PRODUCT_ORDER_READY_FOR_PICKUP` and audits `PRODUCT_DISPATCH_CREATED`. Label issuance, package verification, delivery assignment and completion audit their success and failed verification events without storing raw QR or OTP values.

### `GET /api/v1/fulfilment/orders`

Lists distributor seller product orders. Supports optional `status`, `sellerOrganisationId`, `q`, `page` and `limit`. Distributor users are restricted to their active seller organisation. Delivery partners receive only orders whose delivery assignment belongs to them and cannot submit `sellerOrganisationId`. Search text matches order number, serviceable pincode and seller snapshot.

### `GET /api/v1/fulfilment/orders/:orderId`

Reads one distributor seller product order with item snapshots, reservation rows, status history, optional `invoice` snapshot, optional `dispatch` snapshot and optional `deliveryAssignment` snapshot. A delivery partner read succeeds only when the assignment belongs to that authenticated user.

### `POST /api/v1/fulfilment/orders/:orderId/accept`

Accepts a confirmed product order. The order must currently be `CONFIRMED`; success moves it to `DISTRIBUTOR_ACCEPTED`, writes status history and audits `PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR`. Optional `reason` is recorded.

### `POST /api/v1/fulfilment/orders/:orderId/reject`

Rejects a confirmed product order. The order must currently be `CONFIRMED`; success moves it to `DISTRIBUTOR_REJECTED`, writes status history and audits `PRODUCT_ORDER_REJECTED_BY_DISTRIBUTOR`. `reason` is required. Phase 4A rejection does not release reserved inventory, refund the farmer or reallocate the order.

### `POST /api/v1/fulfilment/orders/:orderId/ready-to-pack`

Marks an accepted product order ready to pack. The order must currently be `DISTRIBUTOR_ACCEPTED`; success moves it to `READY_TO_PACK`, writes status history and audits `PRODUCT_ORDER_READY_TO_PACK`. Optional `reason` is recorded. This action does not create a packing record or invoice.

### `POST /api/v1/fulfilment/orders/:orderId/pack`

Marks a ready-to-pack product order packed. The order must currently be `READY_TO_PACK`; success moves it to `PACKED`, writes status history and audits `PRODUCT_ORDER_PACKED`. Optional `reason` is recorded. This action does not dispatch the order or assign delivery.

### `POST /api/v1/fulfilment/orders/:orderId/invoice`

Generates the distributor invoice snapshot for a packed child product order. The order must currently be `PACKED` unless an invoice already exists, in which case the endpoint returns the existing order detail and invoice without consuming another number. The seller must have an approved GSTIN/state snapshot, the delivery-address snapshot must contain a place-of-supply state code, and every order item must contain its checkout-time HSN/GST-rate snapshot. Prices are tax-inclusive: the backend extracts GST per line in integer paise, records CGST/SGST for intra-state supply or IGST for inter-state supply, and guarantees `taxableAmountPaise + taxPaise = subtotalPaise = totalPaise`. Success uses the next sequential number for that distributor and Indian financial year, creates exactly one immutable `ProductInvoice`, and requests its PDF asynchronously. This sandbox tax implementation still requires chartered-accountant approval and does not generate a credit note, change order status, dispatch the order, post finance ledger entries, settle parties, refund payments or write Tally data.

`POST /orders/:orderId/invoice/pdf` and `POST /fulfilment/orders/:orderId/invoice/pdf` idempotently request the existing invoice's PDF. `GET` on the same paths returns durable generation status, file ID and checksum. `GET .../invoice/pdf/download` returns a short-lived signed URL only after generation is available. Farmer endpoints require ownership and `orders:read:own`; fulfilment endpoints require the matching seller organisation or cross-seller fulfilment read permission. Issuance and every signed download are audited. The documents queue retries failures and a maintenance sweep repairs queued or interrupted work.

When an inspected return refund reaches `SUCCEEDED`, the same transaction issues one sequential GST credit note against the original invoice. `GET /refunds/:refundId/credit-note` returns its immutable financial snapshot and durable PDF status. `GET /refunds/:refundId/credit-note/download` returns an audited short-lived signed URL when available. Access is limited to the refund's farmer, the seller organisation and authorised cross-market refund readers. Gross credited goods value and tax are separate from the net farmer refund and any platform-subsidy reversal. Farmer Return detail exposes this flow only for a backend-reported successful refund, renders the returned credit-note/refund/tax values without recalculation, checks durable document status and opens only the signed URL returned by the download endpoint.

### `POST /api/v1/fulfilment/orders/:orderId/ready-for-pickup`

Marks a packed, invoiced child product order ready for pickup. The order must currently be `PACKED`, must already have a generated `ProductInvoice`, and must not already have a dispatch record. Success creates one `ProductDispatch` for the child order, snapshots invoice number, seller details, delivery address, warehouse quantities and reserved item batches, moves the child order to `READY_FOR_PICKUP`, writes status history and audits `PRODUCT_ORDER_READY_FOR_PICKUP` plus `PRODUCT_DISPATCH_CREATED`. Optional `reason` is recorded as the pickup readiness note.

### `POST /api/v1/fulfilment/orders/:orderId/dispatch-label`

Issues or reissues the printable package QR payload for a ready-for-pickup dispatch. Distributor-own or fulfilment-manage-any authority is required; delivery partners cannot issue labels. The backend returns the raw `packageQrCode` only in this response, stores only its SHA-256 hash, and audits `PRODUCT_DISPATCH_PACKAGE_QR_ISSUED` or `PRODUCT_DISPATCH_PACKAGE_QR_REISSUED`. Reissuing invalidates the previous label and is refused after pickup has been verified.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment`

Assigns a ready-for-pickup child order to an active `DELIVERY_PARTNER` user. The partner must have an active delivery-partner membership and an `ONLINE` profile in that organisation; offline partners cannot receive new assignments. The order must currently be `READY_FOR_PICKUP`, must have a ready `ProductDispatch`, and must not already have a delivery assignment. Success creates one `ProductDeliveryAssignment`, snapshots dispatch, invoice, seller, delivery address, pickup and item data, stores the delivery OTP as hash plus salt with expiry and attempt count, and audits `PRODUCT_DELIVERY_ASSIGNED`. The local/mock response includes `deliveryAssignment.mockOtpCode` one time so the demo flow can be completed without a real SMS provider. The raw OTP is not stored.

Request body:

- `deliveryPartnerUserId`: active delivery partner user UUID.
- `reason`: optional audit reason.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment/accept`

The assigned delivery partner accepts a pending `ASSIGNED` delivery. The order remains `READY_FOR_PICKUP`, the assignment moves to `ACCEPTED`, and the backend audits `PRODUCT_DELIVERY_ASSIGNMENT_ACCEPTED`. Own-assignment or manage-any permission is required.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment/reject`

The assigned delivery partner rejects a pending `ASSIGNED` delivery. A non-empty `reason` is required. The order remains `READY_FOR_PICKUP`, the assignment moves to `REJECTED`, and the backend audits `PRODUCT_DELIVERY_ASSIGNMENT_REJECTED` so operations can reassign it.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment/reassign`

Operations may move a `REJECTED` assignment to a different active, online delivery partner. Manage-any permission and a non-empty `reason` are required. The existing immutable order/dispatch relationship is retained, assignment status returns to `ASSIGNED`, prior execution/proof fields are cleared, and a fresh hashed OTP with new expiry and attempt state replaces the rejected assignment OTP. The local/mock response exposes the new OTP once. Success audits `PRODUCT_DELIVERY_REASSIGNED`; the former partner immediately loses own-scope access.

Request body:

- `deliveryPartnerUserId`: a different active, online delivery partner user UUID.
- `reason`: required reassignment reason.

### `POST /api/v1/fulfilment/orders/:orderId/out-for-delivery`

Moves an accepted, package-verified delivery out for delivery. The order must currently be `READY_FOR_PICKUP`, the assignment must be `ACCEPTED`, `pickupVerifiedAt` must be recorded, and the actor must have any-assignment manage permission or be the assigned delivery partner. Success moves the child order to `OUT_FOR_DELIVERY`, moves the assignment to `OUT_FOR_DELIVERY`, writes status history and audits `PRODUCT_ORDER_OUT_FOR_DELIVERY` plus `PRODUCT_DELIVERY_OUT_FOR_DELIVERY`.

Request body:

- `reason`: optional audit reason.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment/verify-pickup`

Verifies the seller-issued package label for the authenticated assigned partner while the assignment is `ACCEPTED`. A matching `packageQrCode` records the pickup actor, role and UTC timestamp and audits `PRODUCT_DELIVERY_PACKAGE_PICKUP_VERIFIED`. Invalid values increment `pickupVerificationAttemptCount` and audit `PRODUCT_DELIVERY_PACKAGE_QR_FAILED`; the raw value and stored hash are never returned in order detail. Another delivery partner receives `403` before package state is disclosed.

### `POST /api/v1/fulfilment/orders/:orderId/deliver`

Completes an out-for-delivery product order after backend OTP verification. The order and assignment must both be `OUT_FOR_DELIVERY`, the OTP must be unexpired, and the maximum failed-attempt count must not have been reached. The request must also report whether location was granted, denied or unavailable. Success stores the validated location-proof outcome, moves the assignment and child order to `DELIVERED`, records OTP verification and completion actor metadata, writes status history and audits `PRODUCT_ORDER_DELIVERED` plus `PRODUCT_DELIVERY_DELIVERED`. Invalid OTP attempts increment the attempt counter and audit `PRODUCT_DELIVERY_OTP_FAILED`. Location denial or service failure does not block OTP delivery. This endpoint does not accept photo bytes or create settlements, refunds, real notifications or Tally records.

Request body:

- `otpCode`: six digit farmer delivery OTP.
- `proofNote`: optional delivery proof note.
- `proofLocationStatus`: required `GRANTED`, `DENIED` or `UNAVAILABLE`.
- `proofLatitude`, `proofLongitude`, `proofAccuracyMetres`, `proofLocationCapturedAt`: all required for `GRANTED` and all forbidden for `DENIED`/`UNAVAILABLE`. Capture time is an ISO-8601 UTC timestamp and cannot be materially in the future.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-failure`

The assigned delivery partner, or an actor with manage-any authority, may move an `OUT_FOR_DELIVERY` assignment and child order to `DELIVERY_FAILED`. The request records a controlled reason code, optional note, actor metadata, failure count and a backend-validated retry time no more than seven days in the future. The transition writes product-order history and audits `PRODUCT_ORDER_DELIVERY_FAILED` plus `PRODUCT_DELIVERY_FAILED`. Another delivery partner receives `403`.

Request body:

- `reasonCode`: `FARMER_UNAVAILABLE`, `FARMER_REFUSED`, `ADDRESS_NOT_FOUND`, `ACCESS_RESTRICTED`, `VEHICLE_BREAKDOWN`, `WEATHER_OR_ROUTE_BLOCKED`, `PACKAGE_DAMAGED` or `OTHER`.
- `note`: optional detail, maximum 500 characters.
- `retryAt`: required future ISO-8601 timestamp, no more than seven days away.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-retry`

Starts a failed assignment's next attempt only after its backend-stored retry time is due. The same own/manage-any access rules apply. Success moves the assignment and child order back to `OUT_FOR_DELIVERY`, preserves the failure metadata and count, issues a fresh hashed OTP with reset attempts and expiry, writes order history, and audits `PRODUCT_ORDER_DELIVERY_RETRIED` plus `PRODUCT_DELIVERY_RETRIED`. Mock mode may return the fresh `mockOtpCode` transiently; it is never stored or audited.

Request body:

- `reason`: optional audit reason.

## Authentication Endpoints

### `POST /api/v1/auth/otp/request`

Accepts `phone`. Creates a hashed, expiring login challenge. `mockOtpCode` is included only while `SMS_PROVIDER=mock` and must never be exposed by a production provider configuration.

### `POST /api/v1/auth/otp/verify`

Accepts `phone` and six-digit `code`. Returns a token pair for a single eligible active membership, or `membershipSelectionRequired`, a short-lived `selectionToken`, and eligible organisation candidates. This login-only endpoint does not create users or memberships. OTP verification is rate limited and challenge attempts are bounded.

### `POST /api/v1/auth/farmer/otp/request`

Accepts `phone`, canonicalises valid Indian numbers to `+91`, and creates a hashed, expiring `FARMER_REGISTRATION` challenge. The request is rate limited. `mockOtpCode` is returned only while the explicitly configured SMS provider is `mock`.

### `POST /api/v1/auth/farmer/otp/verify`

Accepts `phone`, six-digit `code`, `fullName` and `preferredLocale` (`en-IN` or `hi-IN`). After backend OTP verification it atomically consumes the challenge and, when required, creates the active user, user profile, farmer profile and `FARMER` membership in the active Vardhnam organisation whose slug is `vardhnam-farmer-context`. Existing active farmer memberships are reused; suspended users or memberships are never silently reactivated. User, farmer-profile, membership and OTP verification events are audited. The response uses the normal token-pair-or-membership-selection union. Farmer verification includes only active `FARMER` candidates in that union; business-role memberships are not returned.

### `POST /api/v1/auth/login`

Password login for business-portal roles. Accepts `identifier` (email or phone) and `password`. The response is the same token-pair-or-membership-selection union as OTP verification. Login is rate limited.

### `POST /api/v1/auth/select-organisation`

Accepts `selectionToken` and `organisationId`. The short-lived signed token contains the exact eligible membership IDs from the preceding authentication result. The backend requires the requested active membership to belong to both that bounded set and the token subject, revalidates the active organisation, and returns an access/refresh token pair scoped to that membership. A different membership belonging to the same user is rejected when it was not an eligible candidate.

The partner Flutter shell uses the login OTP routes for `PROMOTER`, `SALES_PARTNER`, `SERVICE_PROVIDER` and `DELIVERY_PARTNER` memberships only. It removes unsupported farmer and business-portal candidates before presenting organisation selection, rejects an unsupported role in any returned session, persists the selected token pair in platform secure storage and routes from the backend-returned role. Protected partner requests refresh once after a `401`; a second `401` invalidates the local session. Backend permission and organisation checks remain authoritative.

### `POST /api/v1/auth/refresh`

Requires the refresh token in both the Bearer header and the validated `refreshToken` body. Rotates the persisted refresh token and returns a new access/refresh pair. Reuse of a revoked or replaced token is rejected.

### `POST /api/v1/auth/logout`

Requires the refresh token in the Bearer header and body. Revokes the persisted refresh token and returns `{ loggedOut: true }`.

### `GET /api/v1/auth/session`

Requires the configured protected-request authentication mechanism. In JWT mode it verifies the access-token signature and revalidates the active user, organisation and membership, then returns the current user, role, organisation, membership and permission claims. The business-portal middleware uses this lightweight endpoint before trusting decoded route permissions.

## Finance Endpoints

- `GET/POST /api/v1/finance/commission-rules`: list rules or create an active global/distributor-specific marketplace commission rule. Creating a rule deactivates the previous active rule for the same scope.
- `GET /api/v1/finance/commission-entries`: filter by order, seller, entry type and status.
- `POST /api/v1/finance/commission-entries/finalize-eligible`: finalise provisional entries only after their backend-calculated eligibility time.
- `POST /api/v1/finance/commission-entries/:entryId/reverse`: reverses all non-reversed commission siblings for the order and writes compensating refund ledger rows.
- `GET /api/v1/finance/ledger`: append-only ledger filterable by entry type, organisation and product order.
- `GET/POST /api/v1/finance/settlements`: list settlements or create one from final, unsettled distributor-payable entries for `sellerOrganisationId`. The backend calculates the amount.
- `GET /api/v1/finance/settlements/:settlementId`: settlement detail with its immutable commission-entry sources.
- `GET /api/v1/payouts/accounts/me`: returns only the authenticated user's payout account and always masks the account number; a missing account returns `NOT_FOUND`.
- `GET /api/v1/payouts/statements/me`: requires own-statement permission, scopes entries by authenticated `recipientUserId`, supports exact `PROVISIONAL`, `FINAL` or `REVERSED` status plus backend pagination, and returns backend-summed totals for every status independently of the active filter. KC-10D displays these values without recalculating commission and uses duplicate-safe pagination.
- `PUT /api/v1/payouts/accounts/me`: submits the authenticated user's account details and resets verification to pending. The shared partner-app workflow exposes this route to supported partner roles with `payout-accounts:write:own`, requires the complete account number on every submission, uppercases IFSC input and renders only the server-masked account number returned by the API.

### Promoter Farmer Leads

- `POST /api/v1/promoters/leads` requires `promoter-leads:create:own` and a promoter or sales-partner context. It normalizes Indian mobile numbers to `+91`, rejects a second open own lead for the same phone and audits a masked phone snapshot.
- `GET /api/v1/promoters/leads/me` requires `promoter-leads:read:own`, is forced to the authenticated promoter user and supports backend pagination plus exact `status`, exact `source` and bounded search.
- `GET /api/v1/promoters/leads` requires `promoter-leads:read:any` for operations-wide queues. `GET /api/v1/promoters/leads/:leadId` repeats own-or-any resource checks in the service.
- `PATCH /api/v1/promoters/leads/:leadId` requires own management permission and repeats own-or-any resource checks. The generic transition graph is `NEW → CONTACTED → LOST`; loss requires a reason and terminal records are read-only.
- `POST /api/v1/promoters/leads/:leadId/convert` requires own management permission and converts only an owned `CONTACTED` lead. The phone must already belong to an active farmer who completed OTP registration and has an active farmer membership; the endpoint never creates an unverified identity from lead data. In one transaction it links `convertedFarmerProfileId`, moves the lead to `CONVERTED`, creates the promoter attribution under the lead's promoter organisation (revoking any prior active primary attribution under the existing rule), and writes attribution plus lead-conversion audit records. A replay of an already converted lead returns the existing link without new writes.
- `POST /api/v1/promoters/leads/:leadId/farmer-otp/request` requires own management permission and starts a rate-limited farmer-registration OTP only for an owned `CONTACTED` lead. The backend derives the phone from the lead; callers cannot substitute another number.
- `POST /api/v1/promoters/leads/:leadId/farmer-otp/verify` accepts a six-digit `code` and `preferredLocale` (`en-IN` or `hi-IN`). It verifies and consumes the farmer-registration challenge, creates or reuses the active farmer identity through the same backend registration rules, then runs the normal lead conversion and single-primary-attribution transaction. It returns the conversion result only and never returns farmer access, refresh or membership-selection tokens to the promoter app.
- `GET /api/v1/promoters/territories/me` requires `promoter-territories:read:own` and returns only the authenticated promoter or sales partner's territory for the active organisation context. A profile belonging to another organisation is treated as unassigned rather than disclosed.
- `PUT /api/v1/promoters/territory-assignments/:promoterUserId` requires `promoter-territories:manage:any`. It accepts `promoterOrganisationId` and an active `territoryId`, validates an active promoter/sales-partner membership and active user/organisation, preserves all Club-specific profile flags, and audits the assignment. A territory change is refused while the shared profile has active Club farmers; identical replay is read-only and does not create a duplicate audit.

## Support Endpoints

- `POST /api/v1/support/tickets` and `GET /api/v1/support/tickets/me`: create and list the caller's tickets.
- `GET /api/v1/support/tickets`: permission-scoped operational queue for users with `support-tickets:read:any`.
- `GET /api/v1/support/tickets/:ticketId`: detail with server-side owner-or-manage enforcement.
- `POST /api/v1/support/tickets/:ticketId/evidence`: records evidence metadata; real file storage remains unimplemented.
- `POST /api/v1/support/tickets/:ticketId/assign`, `/mark-waiting`, `/resume`, `/escalate`, `/resolve`, `/close`, `/reopen`: explicit validated lifecycle transitions with audit records. Waiting status is either `WAITING_FOR_CUSTOMER` or `WAITING_FOR_SELLER`.
- `POST /api/v1/support/tickets/:ticketId/reopen-own`: requires `support-tickets:reopen:own`, verifies `raisedByUserId` against the authenticated user, permits only `RESOLVED` or `CLOSED`, clears resolution/closure timestamps and audits `SUPPORT_TICKET_REOPENED_BY_RAISER`. The management `/reopen` endpoint remains separate.

## Notification Endpoints

- `GET /api/v1/notifications/me`: paginated caller-owned notifications. Supports `channel`, `status`, `unreadOnly`, `page` and `limit`; the backend always scopes `recipientUserId` to the authenticated user.
- `GET /api/v1/notifications/:notificationId`: requires own-read or administrative read permission and revalidates notification-recipient ownership for own-read callers.
- `POST /api/v1/notifications/:notificationId/read`: applies the same owner-or-manager check, idempotently sets `readAt` and audits `NOTIFICATION_READ`.
- `GET /api/v1/notifications/preferences/me`: requires `notifications:read:own`. Returns the caller's stored preferences plus `optOutableCategories` — the categories they are permitted to disable.
- `PUT /api/v1/notifications/preferences/me`: same permission. Upserts `{category, channel, enabled}` entries. **Disabling a transactional category returns 400** with `details.rejectedCategories`; only advisory and marketing categories can be switched off. Audits `NOTIFICATION_PREFERENCES_UPDATED`.
- `POST /api/v1/notifications/:notificationId/dispatch`: requires `notifications:manage`. Queues the notification for delivery through its channel provider and returns once queued. This is the operational retry path for a failed send.
- `POST /api/v1/notifications/:notificationId/attempt`: requires `notifications:manage`. Retained for manual correction of a delivery outcome; the normal path is the queue, so prefer `/dispatch`.
- Notification creation remains a management operation. Farmer-visible payment, seller-order fulfilment, support-ticket and return/refund transitions automatically create locale-aware rows in the same transaction as the state change. `IN_APP` rows are created `SENT` — the row itself is the delivery. Five events (payment succeeded, out for delivery, delivered, order cancelled, refund succeeded) additionally create a `PENDING` `SMS` row, picked up by the `dispatch-pending-notifications` sweep within a minute and delivered on the `notifications` queue.
- Delivery outcomes are recorded with a **null actor** and the job named in the audit reason, because the worker made the attempt rather than a person. A message suppressed by preference is recorded as a failed attempt with `SUPPRESSED_BY_PREFERENCE`, never as sent.
- **Every transport is still `mock`.** A mock delivery is permanently identifiable by its `MOCK-` provider reference. Push has no device-token registration yet and records `NO_DESTINATION`.

## Product Image Endpoint

- `GET /api/v1/marketplace/products/:productId/image`: public, unauthenticated. Redirects (302) to a short-lived storage URL for the product pack shot; 404 when the product is not approved or has no `AVAILABLE` image.
- Discovery list and detail responses carry `primaryImageUrl`, which is this **stable** endpoint rather than a signed URL. Farmer discovery is cached on device for 24 hours, so an embedded signature would expire inside the cache window and turn every cached product into a broken image. The redirect mints a fresh signature per request.
- Product photography is public marketing material. This is deliberately unlike the permission-checked, audited downloads under `/files`, which cover KYC and other private documents.

## File And Document Storage Endpoints

Bytes never pass through the API. The flow is: request a URL, `PUT` directly to storage, confirm, wait for the scan, then request a download URL.

- `POST /api/v1/files/upload-url`: requires `files:upload`. Body takes `purpose`, `filename`, `contentType` and `sizeBytes`. Validates the content type and size against the per-purpose policy, creates a `PENDING_UPLOAD` record and returns `fileId`, `uploadUrl`, `requiredHeaders`, `expiresAt` and `maxSizeBytes`. Rejects `INVOICE_PDF` with 403 — that purpose is platform-generated. Audits `STORED_FILE_UPLOAD_REQUESTED`.
- `POST /api/v1/files/:fileId/confirm`: requires `files:upload`, and only the uploader may confirm. Re-reads the stored object and re-validates its **observed** size and content type — what the client declared when the URL was issued is not trusted. An optional `checksumSha256` is compared with the stored bytes. Failure sets `REJECTED`, deletes the object and returns 400. Success sets `PENDING_SCAN`, audits `STORED_FILE_UPLOAD_CONFIRMED` and enqueues a scan on the `documents` queue.
- `GET /api/v1/files/:fileId`: requires `files:read:own`; `files:read:any` widens scope in the service. Returns metadata and scan status. The object key is never exposed.
- `GET /api/v1/files/:fileId/download-url`: same permissions. Returns a short-lived signed URL, or **409 while the file is not `AVAILABLE`** — a file is undownloadable until a scan clears it. `KYC_DOCUMENT` and `INVOICE_PDF` audit `STORED_FILE_DOWNLOADED` on every issue.

File status is `PENDING_UPLOAD → PENDING_SCAN → AVAILABLE`, with `INFECTED` and `REJECTED` as terminal failures. Read access is: any holder of `files:read:any`; the uploader; or a member of the file's organisation holding `files:read:own`.

`storage/local-object` is provider plumbing for `STORAGE_PROVIDER=local`, authorised solely by a signed expiring token and excluded from the OpenAPI document. Clients must use the URLs the API returns and never construct it themselves.

## Background Job Administration Endpoints

Administrative only. `jobs:read` and `jobs:manage` are granted to `SUPER_ADMIN` and `ADMIN` and to no other role; every other role receives 403, including `OPERATIONS_MANAGER`.

- `GET /api/v1/admin/jobs/queues`: requires `jobs:read`. Returns `queues[]` with `waiting`, `active`, `completed`, `failed`, `delayed` and `deadLetter` counts for every declared queue, plus `scheduledJobs[]` describing the registered repeatable maintenance jobs and their cron patterns. Queues declared for later work packages (`notifications`, `payment-webhooks`, `tally-sync`, `documents`) appear with zero counts until their producers exist.
- `GET /api/v1/admin/jobs/dead-letter`: requires `jobs:read`. Requires a `queue` query parameter naming a declared queue; supports `page` and `limit`. Each entry retains `originalQueue`, `originalJobName`, the full `envelope` (payload plus the originating `requestId`), `failedReason`, `stack`, `attemptsMade` and `failedAt`.
- `POST /api/v1/admin/jobs/dead-letter/:jobId/retry`: requires `jobs:manage`. Body takes the `queue` and an optional `reason`. Re-enqueues the original payload onto its source queue, removes the dead-letter entry and audits `JOB_DEAD_LETTER_RETRIED`. Returns 404 when the entry no longer exists. Replay is audited because it re-runs a side effect that already failed.

Job IDs are BullMQ identifiers, not UUIDs, so `:jobId` is validated as a plain string.

## Authentication Boundary

`AUTH_MODE=mock` remains available for protected local API tests and requires `x-user-id`, `x-user-role` and `x-organisation-id` matching an active membership. `AUTH_MODE=production` requires a Bearer access token issued by the authentication endpoints; the guard revalidates the active user, organisation and membership on every request. Public marketplace discovery endpoints are read-only and unauthenticated.

## Business Portal Contract

The business portal calls the backend from server components and server actions and is configured with:

- `BUSINESS_WEB_API_BASE_URL`
- `BUSINESS_WEB_REFRESH_COOKIE_MAX_AGE_SECONDS` (optional; defaults to 30 days and should match backend refresh-token policy)

The portal requires backend `AUTH_MODE=production`. Login and organisation selection store access and refresh tokens in httpOnly, same-site cookies. Middleware rotates near-expiry tokens, filters routes from access-token permissions and returns `403` for direct unauthorised navigation. The backend remains authoritative and repeats permission and ownership validation.

The portal surfaces:

- `/`: onboarding approval queue with company/distributor/status filters.
- `/onboarding/:organisationId`: onboarding detail, KYC metadata review actions, organisation approval/rejection actions and organisation audit history.
- `/catalogue`: brand and master product catalogue review queues with status/search filters and brand review actions.
- `/catalogue/products/:productId`: master product review detail with brand status, variants, document metadata, readiness badges, product approval/rejection actions and catalogue audit history.
- `/inventory`: distributor warehouse cards and batch stock snapshot rows with warehouse status/search filters.
- `/inventory/ageing`: inventory ageing, low-stock and expiring-batch reporting views.
- `/inventory/warehouses/:warehouseId`: warehouse detail with batch stock, recent append-only movement history and distributor audit preview.
- `/offers`: distributor offer review queue with status/search filters, readiness badges and inventory-derived availability metrics.
- `/offers/:offerId`: distributor offer detail with linked catalogue, warehouse, batch, serviceability, stock snapshot, pause/reactivate/archive controls, approval/rejection actions and distributor audit preview.
- `/orders`: distributor fulfilment order dashboard with status/search filters and seller order metrics.
- `/orders/:orderId`: distributor fulfilment order detail with item snapshots, reservation metadata, status history, invoice summary, durable PDF status, audited signed invoice download, dispatch summary, delivery assignment summary and accept/reject/ready-to-pack/pack/generate-invoice/ready-for-pickup/assign-delivery/out-for-delivery/complete-delivery actions. The signed URL is requested only after an operator clicks Download, not during page rendering.
- `/returns/:returnRequestId`: return detail and guarded operations actions. Successful refunds show the immutable credit-note snapshot, durable PDF status and audited signed credit-note download. Refund, tax and subsidy-reversal values are rendered from the API without portal recalculation; the signed URL is requested only on Download.
- `/finance`, `/finance/commissions`, `/finance/ledger`, `/finance/settlements`, `/finance/settlements/:settlementId`: finance overview, rules, entries, finalisation/reversal, ledger and backend-calculated distributor settlements.
- `/support`, `/support/:ticketId`: permission-scoped ticket queue and validated support lifecycle actions.
- `/audit`: audit log view with action, resource and organisation filters.

The frontend may disable or hide invalid approval and fulfilment actions, but the backend remains authoritative for permission checks, onboarding readiness, catalogue readiness, inventory stock balances, distributor offer availability and product-order status transitions.

## Phase 3D Farmer Mobile Contract

The farmer mobile browse screen calls paginated `GET /api/v1/marketplace/products` for pincode, category and search-filtered marketplace discovery. It uses pull-to-refresh and duplicate-safe load-more behavior; each page is cached under its exact pincode/filter/page key for clearly labelled read-only fallback after a failed live request. Its public detail screen calls `GET /api/v1/marketplace/products/:productId` with the active pincode and renders backend-returned product, variant, public-document and distributor-offer data, including seller-of-record identity, GSTIN, fulfilment, SLA, warehouse, batch, price and derived availability. Its authenticated profile, address and cart screens call the farmer-owned profile/address endpoints plus `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:cartItemId`, `DELETE /cart/items/:cartItemId` and `DELETE /cart/items`. Cart lines are grouped using each response item's `distributorOrganisationId`, clearly identifying the separate seller order and invoice boundary without calculating seller totals on-device. Cart quantity controls use the response's live offer minimum/maximum and availability snapshot to show an effective allowed range; every change still goes through backend validation. Cart snapshots refresh on foreground resume. A rejected detail-to-cart mutation triggers a live detail reread: removed offers are no longer rendered, another eligible offer is selected when present, and an offer whose live availability is below its backend minimum quantity cannot be submitted. When a successful cart response contains a different `priceSnapshotPaise` from the displayed offer price, the app requires the farmer to acknowledge the change and choose whether to review the cart; the returned backend snapshot remains authoritative. Checkout review freshly reloads the active cart and owned addresses, permits only an address matching the cart pincode, and calls `POST /checkout/from-cart` with a locally persisted `Idempotency-Key`. It renders the returned parent checkout, selected address, backend totals, seller-specific child orders and batch reservations. The selected detail offer is added at the backend-defined minimum quantity and no financial values are calculated by the app. Protected calls use centralized Bearer authentication with serialized refresh and a single retry after `401`. Ownership, offer revalidation, inventory reservation, auditing and financial calculations remain backend-enforced.

Farmer mobile mock payment calls `POST /payments/mock-intents`, then `POST /payments/mock-intents/:paymentIntentId/confirm`, followed by authoritative reads of the payment intent and checkout. It exposes success and deliberate failure outcomes only as clearly labelled development-provider actions and does not infer payment success locally. Eligible checkout cancellation calls `POST /checkout/:checkoutId/cancel` after farmer confirmation and renders the server-returned released-reservation state. Checkout, payment creation, payment confirmation and cancellation retain operation-specific idempotency keys across ambiguous failures and disable repeat taps while a mutation is active.

Farmer order history calls paginated `GET /orders` with an optional exact `status` filter. Order detail calls `GET /orders/:orderId` and renders the distributor seller snapshot, delivery address, item/batch snapshots, chronological status history, dispatch and delivery-assignment identifiers, and generated invoice snapshot. When an invoice exists, the app can idempotently request its PDF, check the durable `QUEUED`/`PROCESSING`/`AVAILABLE`/`FAILED` status, obtain a short-lived authorised download URL only when available, and open it in the device browser. Potentially eligible `PENDING_PAYMENT`, `INVENTORY_RESERVED` and `PAYMENT_FAILED` child orders expose a confirmed `POST /orders/:orderId/cancel` action with an order-specific persisted idempotency key. The backend remains authoritative and a status race is rendered as its conflict/error response. List and detail refresh when the app resumes. Active detail uses a non-overlapping 30-second poll only while foregrounded; distributor-rejected, delivered, cancelled, refunded and closed orders stop polling.

Farmer support calls `GET /support/tickets/me`, `POST /support/tickets`, `GET /support/tickets/:ticketId` and `POST /support/tickets/:ticketId/reopen-own`. List/detail are owner-scoped by the authenticated user. An order-linked create request is accepted only when the backend confirms the farmer owns that child order. The mobile app shows status, SLA target and resolution notes, refreshes on foreground resume, and permits reopen only for resolved/closed tickets. It does not call the metadata-only evidence endpoint or present a conversation thread because authorised binary upload and ticket-message APIs do not exist.

Farmer in-app notifications call `GET /notifications/me?channel=IN_APP`, `GET /notifications/:notificationId` and `POST /notifications/:notificationId/read`. The inbox is paginated, supports backend unread-only filtering and refreshes after returning to the foreground or notification detail. Opening an unread notification uses the audited mark-read endpoint. The app allowlists deep links only for `ProductOrder`, `SupportTicket` and `ReturnRequest`; those destination APIs independently revalidate farmer ownership. Seller-order fulfilment, farmer support and return/refund domain events are produced automatically; push token registration, other domain-event producers and production notification transport remain unimplemented.

### Farmer return-request foundation

- `GET /api/v1/returns/eligibility/:orderId` returns farmer-owned child-order eligibility, the actual delivery timestamp, configured window expiry, any existing request ID, and order-line quantities. The server derives this data; the client does not infer eligibility.
- `POST /api/v1/returns` requires `returns:create:own` and `Idempotency-Key`. The body contains `productOrderId`, `reasonCode`, optional `reasonNote`, and one or more `{ productOrderItemId, quantity }` entries. The order must be `DELIVERED`, inside `RETURN_WINDOW_DAYS`, owned by the farmer, and have no existing return request. Quantities cannot exceed the child-order lines. `OTHER` requires a note.
- `GET /api/v1/returns/me` lists farmer-owned requests with pagination and optional exact `status`. `GET /api/v1/returns/:returnRequestId` returns one request only when the actor is its farmer owner, an authorised user in its seller organisation, or an any-return operations user.
- `GET /api/v1/returns` is the operational queue. It supports `status`, `distributorOrganisationId`, `q`, `page` and `limit`. `returns:read:any` may read across sellers; `returns:read:seller-own` is forcibly scoped to the actor's active distributor organisation.
- `POST /api/v1/returns/:returnRequestId/approve` moves `REQUESTED` to `APPROVED` and the child order from `RETURN_REQUESTED` to `RETURN_APPROVED`. Seller-scoped return managers and any-return managers may approve.
- `POST /api/v1/returns/:returnRequestId/reject` moves `REQUESTED` to `REJECTED` and the child order to `RETURN_REJECTED`. A reason is required.
- `POST /api/v1/return-pickups/returns/:returnRequestId/assignment` requires `return-pickups:manage:any`. It assigns an `APPROVED` return to an active, online delivery partner in an active delivery organisation and snapshots the seller, farmer, pickup address and returned items. A rejected assignment may be reassigned in place; active assignments cannot be replaced.
- `GET /api/v1/return-pickups` and `GET /api/v1/return-pickups/:assignmentId` require return-pickup read permission. Delivery partners are forcibly scoped to assignments where they are the assigned partner; operations users with any-read permission may query across partners and statuses.
- `POST /api/v1/return-pickups/:assignmentId/accept` and `/reject` require own-manage or any-manage permission. Only the assigned partner may use own-manage; rejection requires a reason.
- `POST /api/v1/return-pickups/:assignmentId/collect` requires an accepted assignment. Collection atomically moves the assignment to `COLLECTED`, the return from `APPROVED` to `IN_TRANSIT`, and the child order from `RETURN_APPROVED` to `RETURN_IN_TRANSIT`, with histories, audit records and farmer notification.
- `POST /api/v1/returns/:returnRequestId/pickup` remains an operations-only compatibility path only when no return-pickup assignment exists. Once assigned, pickup must be recorded through the assigned-partner collection endpoint.
- `POST /api/v1/returns/:returnRequestId/receive` moves `IN_TRANSIT` to `RECEIVED` and the child order to `RETURNED`. Receipt means held for inspection and does not create sellable inventory.
- `POST /api/v1/returns/:returnRequestId/inspect` requires return-management permission and a non-empty inspection note. Its `dispositions` array allocates the full returned quantity using `{ returnRequestItemId, reservationId, outcome, quantity }`, where `reservationId` must be an original batch reservation for that order line. Supported outcomes are `RESTOCKABLE`, `QUARANTINED`, `DAMAGED_WRITE_OFF` and `REJECTED_RETURN`. Only an active, unexpired original batch may be restocked. The backend calculates `approvedRefundAmountPaise`; rejected quantities are excluded. A fully rejected inspection completes the return and restores the child order to `DELIVERED`; otherwise the return becomes `INSPECTED` pending refund.
- `POST /api/v1/returns/:returnRequestId/cancel` requires `returns:cancel:own` and `Idempotency-Key`. Only the owning farmer may cancel while the return is `REQUESTED` or `APPROVED`; the request becomes `CANCELLED` and the child order returns to `DELIVERED`. Pickup/in-transit returns cannot be cancelled through this endpoint.
- `POST /api/v1/returns/:returnRequestId/evidence` accepts an `AVAILABLE`, scan-cleared `RETURN_EVIDENCE` `storedFileId` plus an optional 300-character caption. The caller must be the file uploader and either the owning farmer, an authorised seller-return manager, or an any-return manager. Attachment and `RETURN_EVIDENCE_ATTACHED` audit are atomic. The file is moved into the return seller's organisation scope while retaining its uploader owner, allowing both farmer and authorised seller users to request signed downloads through `/files/:fileId/download-url`. Repeating the same file/return/uploader request returns the existing attachment without another row or audit event; a file already attached elsewhere returns `409`.

Creation snapshots backend order prices and calculates paise totals. Every operational transition updates return and child-order status together with append-only histories and an audit record in a serializable transaction. Inspection records an immutable disposition for every allocated original-reservation quantity. `RESTOCKABLE` appends a positive `RETURN_RESTOCKED` movement; `QUARANTINED` and `DAMAGED_WRITE_OFF` append zero-delta trace movements because checkout already removed the sold quantity from availability; `REJECTED_RETURN` appends no inventory movement. Approved inspected quantities continue through the separate refund workflow below.

### Refund workflow

- `POST /api/v1/refunds` requires `refunds:create:any` and `Idempotency-Key`. The body contains only `returnRequestId`; amount, farmer, seller order and successful payment intent are resolved by the backend. The return must be `INSPECTED` with a positive approved amount and no existing refund. Creation moves the child order from `RETURNED` to `REFUND_PENDING`.
- `GET /api/v1/refunds` requires `refunds:read:any` and supports exact `status`, `productOrderId`, `returnRequestId`, `page` and `limit` filters.
- `GET /api/v1/refunds/me` requires `refunds:read:own` and is forcibly scoped to the authenticated farmer user. `GET /api/v1/refunds/:refundId` repeats either any-refund permission or farmer ownership in the service.
- `POST /api/v1/refunds/:refundId/confirm` requires `refunds:confirm:mock` and `Idempotency-Key`. It accepts `SUCCEEDED` or `FAILED`; failure requires a reason. This endpoint is development-only and rejects any non-mock provider mode. Success commits a `PROCESSING_STARTED` event, returns the committed `PROCESSING` refund immediately and queues provider execution on `payment-webhooks`; clients poll the existing refund detail endpoint for `SUCCEEDED` or `FAILED`.

The worker calls the provider outside a transaction. Successful execution then atomically appends the primary negative `REFUND` ledger entry, reverses all unreversed order commission entries through new negative linked ledger entries, moves the child order to `REFUNDED`, completes the return, appends refund/order/return histories and writes audit. Financial ledger rows and refund events are immutable. Provider exceptions retry with exponential backoff and enter the existing dead-letter workflow after exhaustion. A five-minute sweep reconstructs missing jobs from durable processing events. Failed mock execution leaves the order `REFUND_PENDING` and may be retried with a new idempotency key. No real provider or real money movement is implemented.

### Product-order disputes

- `POST /api/v1/disputes` accepts `productOrderId`, optional `returnRequestId`, controlled `category` and a 10–2000 character `description`; `Idempotency-Key` is mandatory. Only the owning farmer or the child order's seller organisation may create. The order must be `DELIVERED`, `RETURN_REJECTED`, `REFUNDED` or `CLOSED`; creation snapshots that state, moves the child order to `DISPUTED`, appends dispute/order history, audit and a farmer in-app notification atomically. One non-closed dispute per child order is enforced in PostgreSQL.
- `GET /api/v1/disputes/me` is farmer-user scoped. `GET /api/v1/disputes` supports exact `status`, `category`, seller organisation, assignee and text filters; seller users are forcibly scoped to their active distributor organisation unless they hold any-read permission. `GET /api/v1/disputes/:disputeId` repeats farmer, seller or any-read scope in the service.
- `POST /api/v1/disputes/:disputeId/assign` requires `disputes:manage` and accepts an active Vardhnam support, operations or admin user. It moves an active dispute to `UNDER_REVIEW` and is replay-safe when already assigned identically.
- `POST /api/v1/disputes/:disputeId/notes` accepts a participant-visible note and requires `Idempotency-Key`. Farmers, seller users and platform readers may add notes only while the dispute is not closed. Replaying the same actor/key/note returns the existing state without another event or audit row.
- `POST /api/v1/disputes/:disputeId/request-info` requires `disputes:manage`, a `FARMER` or `DISTRIBUTOR` target and a note. It moves the dispute to the matching awaiting-information state with append-only event and audit.
- `POST /api/v1/disputes/:disputeId/resolve` requires the distinct finance-authorised `disputes:resolve` permission. It accepts `FARMER`, `DISTRIBUTOR` or `SPLIT`, an integer farmer award in paise and a resolution note. Distributor outcomes require zero award; any award is capped by backend child-order farmer payable and appends a negative dispute-linked `ADJUSTMENT` ledger entry. Resolution restores the exact pre-dispute product-order status and emits an audited farmer notification in the same serializable transaction.
- `POST /api/v1/disputes/:disputeId/close` requires `disputes:resolve` and a note. Only a resolved dispute may close; an already-closed replay returns current state. Events and audits are append-only.

Farmer direct-support launchers are client-side operating-system handoffs and do not call an API. `FARMER_SUPPORT_PHONE` and `FARMER_SUPPORT_WHATSAPP` are build-time values, accepted only as E.164 numbers. They open `tel:` and HTTPS `wa.me` destinations respectively. These actions do not send messages automatically, do not represent a WhatsApp provider integration and do not replace the audited support-ticket workflow.

## Kisan Club membership foundation

All routes below are under `/api/v1`, require authentication and return `404 NOT_FOUND` when `KISAN_CLUB_ENABLED=false`.

- `POST /kisan-club/membership` requires `kisan-club-membership:write:own`. The farmer supplies six-digit `homePincode`, optional home locality, non-empty `termsVersion`, literal `termsAccepted: true`, and optional referral membership UUID. The response is a free `PENDING_PROFILE` membership. Duplicate membership returns `409`.
- `GET /kisan-club/membership/me` requires `kisan-club-membership:read:own`. It returns the own membership or `null` when the enabled programme has not been joined.
- `PATCH /kisan-club/membership/me/consents` requires `kisan-club-membership:write:own` and at least one of `advisoryConsent`, `marketingConsent`, or `preciseLocationConsent`. Each changed choice receives its own server UTC timestamp. Suspended or closed membership returns `409`.
- `POST /kisan-club/membership/me/close` requires `kisan-club-membership:write:own`, accepts an optional audit reason, preserves the row, and revokes active optional consents.
- `GET /kisan-club/memberships` requires `kisan-club-memberships:read:any` and supports `status`, staff-only member-number/farmer-name `q`, `page`, and `limit`.
- `GET /kisan-club/memberships/:membershipId` requires `kisan-club-memberships:read:any` and returns the membership with its farmer profile for an authorised staff detail view. Unknown UUIDs return `404`; member numbers are not accepted as route identifiers.
- `POST /kisan-club/memberships/:membershipId/suspend` requires `kisan-club-memberships:manage`, a UUID route identifier and a required reason. A member number is never accepted as a route identifier.

## Farm and crop registry

All routes below are under `/api/v1`, require authentication, use UUID route identifiers, and return `404 NOT_FOUND` when `KISAN_CLUB_ENABLED=false`.

- `GET /farms/reference/crops` is available to authenticated users and returns active controlled crop references with English and Hindi names.
- `GET /farms` requires `farms:read:own` and returns only the authenticated farmer's farms with crop cycles and controlled crop details. An enabled non-member receives an empty list.
- `POST /farms` and `PATCH /farms/:farmId` require `farms:write:own` and an editable Club membership. Farm area is a positive decimal with at most three places and cannot be reduced below an existing cycle's area. Coordinates must be supplied as a pair and require precise-location consent. Withdrawing that consent removes stored farm coordinates and audits their removal without copying the coordinates into audit JSON.
- `GET` and `POST /farms/:farmId/crop-cycles` read or create cycles on an owned farm. `PATCH /farms/:farmId/crop-cycles/:cycleId` enforces ownership, controlled crops, approved optional variety products, area/date validation and the crop-cycle state machine.
- `POST /farms/:farmId/crop-cycles/:cycleId/harvest` changes an active cycle to `HARVESTED`, records actual harvest date and optional yield, and appends a server-authored `HARVEST` activity in the same transaction.
- `GET` and `POST /farms/crop-cycles/:cycleId/activities` list or append diary records for an owned cycle. Optional order links must belong to the same farmer. Activity source and recorder are set by the backend.

Every farm, cycle and activity mutation writes an audit record in the same database transaction. There are no physical-delete endpoints. `POST /farms/surveys` requires `farm-surveys:create`, accepts an assigned membership UUID plus a validated farm and optional first crop cycle, and succeeds only for the authenticated active promoter assignment. Coordinates still require the farmer's precise-location consent. KC-10C partner-mobile submissions deliberately omit `latitude` and `longitude`; a later client may send them only after implementing an explicit authorised consent flow.

`GET /api/v1/promoters/surveys/reference/crops` and `POST /api/v1/promoters/surveys` provide the general WP-13 survey path independently of the Kisan Club feature flag. Creation accepts `farmerProfileId`, a validated farm and an optional first crop cycle, and requires the authenticated promoter/sales partner to hold the active primary attribution for that farmer in the current organisation. The farmer user, farmer membership and organisation must remain active. The resulting farm has `membershipId = null`, remains directly owned by `farmerProfileId`, and does not enter Club advisory generation. General surveys reject latitude and longitude until a separately authorised general precise-location consent model exists.

`POST /api/v1/promoters/visits` requires `promoter-visits:create:own` and accepts exactly one `farmerLeadId` or `farmerProfileId`, a controlled visit purpose, optional notes, UTC occurrence time and an explicit location outcome. Lead targets must belong to the authenticated promoter and organisation; farmer targets require an active primary attribution plus an active farmer identity. Granted location requires latitude, longitude, device accuracy and capture time within 30 minutes of the visit; denied, unavailable and not-requested outcomes reject all coordinate fields. `GET /api/v1/promoters/visits/me` is forced to the current promoter and organisation with pagination and optional target filters. Operations/admin may use the any-scope list permission. Individual reads repeat own-or-any resource checks. Visit records have no update or delete endpoint.

## Kisan Club territories and promoter assignment

All routes below are under `/api/v1/kisan-club`, require authentication and return `404 NOT_FOUND` when `KISAN_CLUB_ENABLED=false`.

- `GET /territories` requires `kisan-club-territories:manage` and supports `status`, `q`, `page` and `limit`. `POST /territories` creates a controlled territory; `PATCH /territories/:territoryId` updates or inactivates it. Active assignments must be reassigned before inactivation.
- `GET /promoter-profiles` requires `kisan-club-promoter-profiles:manage` and supports `territoryId`, exact `clubEnabled`, `page` and `limit`. `POST /promoter-profiles` creates or updates the profile identified by `promoterUserId` after server validation of organisation membership, territory, KYC, capacity and conditional payout eligibility.
- `POST /memberships/:membershipId/reassign-promoter` requires `kisan-club-assignments:manage`, a required `assignmentReason` and audit `reason`. Supplying `promoterUserId` performs an eligibility-checked manual assignment; omitting it requires `AUTO_MATCHED` and uses deterministic matching. The member must have completed the farm profile.
- `GET /promoter/me` requires the farmer's own membership-read permission and returns the active promoter relationship or `null`.
- `GET /promoter/farmers` and `GET /promoter/farmers/:membershipId` require `kisan-club-farmers:read:own` and are hard-scoped to active assignments for the authenticated promoter or sales-partner user. Responses use explicit field allowlists and exclude passwords, consent metadata, bank data, precise coordinates and unrelated order history.

Reassignment serializably ends the prior Club assignment, updates both capacity counters, replaces the standard active `PromoterAttribution`, activates the Club membership and writes audit. The database additionally enforces one active assignment per membership. Match diagnostics contain eligibility exclusions and ordered scoring inputs but no secrets or bank data.

## Kisan Club catalogue programmes

All routes below are under `/api/v1/kisan-club`, require authentication and return `404 NOT_FOUND` when `KISAN_CLUB_ENABLED=false`.

- `GET /programmes` requires `kisan-club-programmes:manage` and supports exact `status`, `productId`, `page` and `limit` filters.
- `POST /programmes` requires the same permission and creates a `DRAFT` programme for an approved Vardhnam-owned product. It accepts optional active `variantId`, UTC `startsAt`/`endsAt`, pincode/district lists, display priority and a required audit reason. Duplicate product/variant or product-wide enrolment returns `409`.
- `PATCH /programmes/:programmeId` updates programme scope or performs a validated lifecycle transition. Status changes require a reason; ended programmes are immutable.
- `GET /products` requires `kisan-club-catalogue:read:own` and uses the normal marketplace list query including required delivery `pincode`, pagination and discovery filters. Only member-region/window-eligible active programme mappings are passed into ordinary marketplace discovery.
- `GET /products/:productId` requires the same permission and returns ordinary safe marketplace detail plus eligible Club programme identifiers. It does not expose private document storage fields.

Club catalogue responses contain current distributor offer prices. Cart responses may include `clubBenefitSnapshotPaise`, aggregate `clubBenefitPaise` and `farmerPayablePaise`, but those values are non-binding. Checkout re-evaluates benefits from backend state and returns binding gross subtotal, Club benefit and farmer payable at checkout, child-order and line levels.

## Kisan Club benefit administration and checkout binding

All benefit administration routes are under `/api/v1/kisan-club`, require `kisan-club-benefits:manage`, are audited and return `404 NOT_FOUND` while the Club flag is disabled.

- `GET /benefit-rules` supports exact `status`, `programmeId`, `page` and `limit` filters.
- `POST /benefit-rules` creates a `DRAFT` rule. It accepts programme UUID, benefit type, the matching paise or basis-point field, optional cap, minimum quantity, pincode/crop UUID scope, UTC window, usage limits and a required reason.
- `PATCH /benefit-rules/:ruleId` changes rule terms before first redemption or performs `DRAFT -> ACTIVE`, `ACTIVE -> PAUSED|EXPIRED`, or `PAUSED -> ACTIVE|EXPIRED`. Expired rules and redeemed financial/eligibility terms are immutable.

`POST /checkout/product-orders` accepts no benefit amount. During its existing serializable transaction the backend evaluates active membership and rules against current offer price, programme scope, delivery pincode and active registered crops; enforces usage limits; stores one redemption per benefited order line; and derives all totals. Payment intents charge checkout `farmerPayablePaise`. Successful confirmation appends farmer-payment and subsidy ledger entries. Return and refund APIs expose allocated benefit paise and never refund more than the backend-derived farmer-paid amount.

## Kisan Club fulfilment coordination

All routes are under `/api/v1/kisan-club/fulfilment/assignments`, require authentication, return `404 NOT_FOUND` while Club is disabled, and enforce own-or-any resource scope in the service.

- `GET /` lists assignments. Promoter/sales-partner results are forced to the authenticated `promoterUserId`; staff with read-any may filter by `status`, `promoterUserId`, `membershipId` or `productOrderId`.
- `GET /:assignmentId` repeats own-or-any access against the stored promoter.
- `POST /:assignmentId/accept|decline|product-ready|farmer-contacted|ready-for-pickup|out-for-delivery|complete|fail` performs one validated coordination transition. Decline and failure require a reason.
- `POST /:assignmentId/reassign` requires manage-any authority, a different active Club-enabled promoter and a reason. It retains both reassignment history events.
- `POST /:assignmentId/cancel` requires manage-any authority and a reason.

Successful mock payment confirmation invokes idempotent assignment creation inside the existing serializable payment transaction. Missing active promoter assignment is a non-error and never blocks payment. Coordination endpoints do not mutate the product order or delivery assignment and do not constitute proof of delivery.

The business portal exposes `/kisan-club/fulfilment` and `/kisan-club/fulfilment/:assignmentId` only when the server-derived session has read-own or read-any authority. Action controls reflect the current coordination state, but the API independently enforces every transition and own-or-any resource boundary. The detail view links to the separate seller-order record and displays only backend-returned paise amounts.

The partner app exposes the same contract only to promoter and sales-partner sessions. Its inbox sends exact `status`, `page` and `limit` filters and merges pages by assignment ID. Detail displays coordination status/history separately from the seller-order status, offers only promoter-valid transitions, requires a reason for decline/failure, excludes operations-only cancel/reassign, and performs an authoritative detail read after every mutation. The app does not mutate product-order or delivery state.

## Kisan Club intelligence

Both routes require authentication, the Club feature flag and `kisan-club-intelligence:read`. They expose aggregate operational data only and do not imply access to individual farm, farmer, membership or fulfilment records.

- `GET /api/v1/kisan-club/intelligence/crop-summary` accepts optional exact case-insensitive `state`, `district` and `season` filters plus `cropId` and crop-cycle `status`. It returns backend-rounded acreage and cycle counts by crop, district, crop/district, season, lifecycle status and recorded sowing month. Only active farms for active or promoter-awaiting memberships are included.
- `GET /api/v1/kisan-club/intelligence/promoter-performance` accepts `territoryId`, `promoterUserId`, `clubEnabled`, `page` and `limit`. It returns current active farmer counts, capacity and current-holder coordination outcomes. Resolved completion is returned in integer basis points and is `null` when there are no resolved records. Page summary values cover only the returned page.

The business portal exposes `/kisan-club/intelligence` behind the same permission. It displays operational tables and backend-returned aggregates. Demand forecasting has no endpoint and is explicitly deferred until completed-season conversion history and an approved contract exist.

## Kisan Club benefit tokens and assisted checkout

All routes are under `/api/v1/kisan-club/benefit-tokens`, require authentication, are rate-limited, and return `404 NOT_FOUND` while Club is disabled.

- `POST /` requires `kisan-club-benefit-tokens:create:own` and accepts only an approved distributor `offerId` and integer `quantity`. The backend verifies active membership, member-pincode serviceability, live stock and a live benefit. It returns a `VKC-<reference>-<secret>` bearer code once; subsequent reads never return that code.
- `GET /me` requires `kisan-club-benefit-tokens:read:own` and supports `status`, `page` and `limit`. It returns safe quote metadata and derives expiry for issued tokens without exposing token hashes or salts.
- `POST /redeem` requires `kisan-club-assisted-orders:create`, an `Idempotency-Key`, `code`, `membershipId`, and an optional farmer-owned delivery address. Only the member's active assigned promoter may redeem the token. A default farmer address is used when none is supplied.

Redemption never treats quoted amounts as binding. In one serializable checkout transaction it re-reads the offer, current price, serviceability, stock, programme and benefit rule; reserves inventory; creates the normal seller child order for the farmer; links the benefit redemption and token; and records the promoter as actor in audit and order status history. A non-empty farmer cart is preserved and causes `409` rather than being overwritten. Successful redemption returns a pending-payment checkout with `paymentRequiredInApp=true`; it neither records cash collection nor confirms payment. Replay, expiry and five failed secret attempts make the bearer credential unavailable.

The farmer app issues a token from Club product detail and shows the complete bearer code only in the successful one-time response dialog. Its benefit history uses the backend `status`, `page` and `limit` contract with duplicate-safe pagination and displays safe metadata only; it cannot recover a bearer code or calculate a benefit quote.

The partner app exposes this mutation only inside a `PROMOTER` or `SALES_PARTNER` Club route reached from an assigned farmer returned by `/kisan-club/promoter/farmers`. It sends the complete code with a stable operation idempotency key, displays backend-returned benefit and farmer-payable paise values, and states that payment remains required in the farmer app. It does not accept cash, confirm payment, calculate a benefit, or broaden the promoter's farmer scope.
