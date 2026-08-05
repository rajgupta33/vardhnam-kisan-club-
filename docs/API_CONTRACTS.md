# API Contracts

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

Creates an organisation in pending verification by default. Requires `organisations:create`.

### `GET /api/v1/organisations`

Lists organisations with pagination. Requires `organisations:read:any`.

### `GET /api/v1/organisations/:organisationId`

Reads one organisation. Users with `organisations:read:any` may read any organisation. Users with `organisations:read:own` may read only the organisation in their active request context.

### `PATCH /api/v1/organisations/:organisationId`

Updates organisation profile fields. Requires `organisations:update:any`.

### `POST /api/v1/organisations/:organisationId/review`

Approves or rejects an organisation. Requires `organisations:approve`. Approval sets status to `ACTIVE`; rejection sets status to `REJECTED`. The reviewer, timestamp and reason are persisted and audited. For `COMPANY` and `DISTRIBUTOR` organisations, approval is rejected unless the matching onboarding profile exists and at least one KYC document metadata record is `APPROVED`.

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

Reads one master product with brand, company, variant, document and reviewer metadata. The response includes `missingRequirements`, which can contain `APPROVED_BRAND`, `ACTIVE_VARIANT` or `PRODUCT_DOCUMENT`.

### `PATCH /api/v1/catalogue/products/:productId`

Updates master product metadata. Updating an approved product moves it back to `DRAFT` and clears reviewer metadata. Writes `MASTER_PRODUCT_UPDATED` audit history.

### `POST /api/v1/catalogue/products/:productId/variants`

Creates variant and pack-size metadata for one master product. `mrpPaise`, when provided, is an integer amount in paise. Writes `PRODUCT_VARIANT_CREATED` audit history. Adding a variant to an approved product reopens the product as `DRAFT`.

### `POST /api/v1/catalogue/products/:productId/documents`

Creates product document metadata for one master product. Supported document types are `LABEL`, `REGISTRATION_CERTIFICATE`, `SAFETY_DATA_SHEET`, `PRODUCT_IMAGE`, `TEST_REPORT` and `OTHER`. Writes `PRODUCT_DOCUMENT_METADATA_CREATED` audit history. Adding document metadata to an approved product reopens the product as `DRAFT`.

### `POST /api/v1/catalogue/products/:productId/submit`

Submits a draft or rejected product for review. The backend rejects submission unless the brand is approved, at least one variant is active and at least one document metadata record exists. Writes `MASTER_PRODUCT_SUBMITTED` audit history.

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

Farmer profile and cart APIs require mock-auth headers for a user with the `FARMER` role and farmer permissions. In Phase 3A the mock auth guard still requires an active organisation membership context, but farmer data ownership is enforced by `actor.userId`, not by distributor or company organisation ownership.

### `GET /api/v1/farmers/me`

Reads the authenticated farmer's profile with owned address records. Requires `farmer-profile:read:own`. Returns `NOT_FOUND` until the farmer profile is created.

### `PUT /api/v1/farmers/me/profile`

Creates or updates the authenticated farmer's profile. Requires `farmer-profile:write:own`. Supported fields are `fullName`, `alternatePhone`, `preferredLocale`, `village`, `district`, `state`, `primaryPincode` and `cropInterests`. Writes `FARMER_PROFILE_CREATED` or `FARMER_PROFILE_UPDATED` audit history.

### `GET /api/v1/farmers/me/addresses`

Lists the authenticated farmer's addresses. Requires `farmer-addresses:read:own`.

### `POST /api/v1/farmers/me/addresses`

Creates an owned farmer address. Requires `farmer-addresses:write:own`. The first address becomes default automatically unless another default is explicitly managed later. Writes `FARMER_ADDRESS_CREATED` audit history.

### `PATCH /api/v1/farmers/me/addresses/:addressId`

Updates an owned farmer address. Requires `farmer-addresses:write:own`. If `isDefault=true`, other addresses for the farmer profile are unset as default. Writes `FARMER_ADDRESS_UPDATED` audit history.

### `GET /api/v1/cart`

Reads or creates the authenticated farmer's active cart after a farmer profile exists. Requires `cart:read:own`. The response includes cart pincode/address context, item snapshots, item count and backend-calculated `subtotalPaise`.

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

For `SUCCESS`, the backend marks the payment intent `SUCCEEDED`, the checkout `PAID`, and all child orders `CONFIRMED`. For `FAILURE`, the backend marks the payment intent `FAILED`, the checkout `PAYMENT_FAILED`, and all child orders `PAYMENT_FAILED`. Both outcomes write payment events and audit records. Inventory reservations remain in place until an eligible Phase 3D cancellation releases them.

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

Phase 4A adds distributor-facing product order fulfilment reads and accept/reject transitions. Phase 4B adds picking and packing status transitions. Phase 4C adds one distributor invoice snapshot per packed child product order. Phase 4D adds dispatch readiness for packed, invoiced child orders. Phase 4E adds delivery assignment, out-for-delivery transition and mock OTP completion. These APIs operate on child `PRODUCT_ORDER` records where the distributor is seller of record. They do not send real SMS or WhatsApp messages, capture payments, issue refunds, post finance ledger entries, settle parties, generate invoice PDFs or write Tally records.

Fulfilment APIs require mock-auth headers. Users with `fulfilment-orders:read:own` or `fulfilment-orders:manage:own` may only access orders whose `sellerOrganisationId` matches their active distributor organisation. Vardhnam operations/admin users with `fulfilment-orders:*:any` may access orders across sellers. Delivery assignment creation requires `delivery-assignments:manage:any`; delivery partners with `delivery-assignments:manage:own` may only move and complete assignments where `deliveryPartnerUserId` is their authenticated user ID. Every status transition writes `ProductOrderStatusHistory` and audit records. Invoice generation writes a `ProductInvoice` record and audits `PRODUCT_INVOICE_GENERATED`. Dispatch readiness writes a `ProductDispatch` record, transitions the child order to `READY_FOR_PICKUP`, audits `PRODUCT_ORDER_READY_FOR_PICKUP` and audits `PRODUCT_DISPATCH_CREATED`. Delivery assignment and completion audit `PRODUCT_DELIVERY_ASSIGNED`, `PRODUCT_DELIVERY_OUT_FOR_DELIVERY`, `PRODUCT_DELIVERY_DELIVERED` and failed OTP attempts as `PRODUCT_DELIVERY_OTP_FAILED`.

### `GET /api/v1/fulfilment/orders`

Lists distributor seller product orders. Supports optional `status`, `sellerOrganisationId`, `q`, `page` and `limit`. Non-any users cannot override `sellerOrganisationId` outside their active distributor organisation. Search text matches order number, serviceable pincode and seller snapshot.

### `GET /api/v1/fulfilment/orders/:orderId`

Reads one distributor seller product order with item snapshots, reservation rows, status history, optional `invoice` snapshot, optional `dispatch` snapshot and optional `deliveryAssignment` snapshot.

### `POST /api/v1/fulfilment/orders/:orderId/accept`

Accepts a confirmed product order. The order must currently be `CONFIRMED`; success moves it to `DISTRIBUTOR_ACCEPTED`, writes status history and audits `PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR`. Optional `reason` is recorded.

### `POST /api/v1/fulfilment/orders/:orderId/reject`

Rejects a confirmed product order. The order must currently be `CONFIRMED`; success moves it to `DISTRIBUTOR_REJECTED`, writes status history and audits `PRODUCT_ORDER_REJECTED_BY_DISTRIBUTOR`. `reason` is required. Phase 4A rejection does not release reserved inventory, refund the farmer or reallocate the order.

### `POST /api/v1/fulfilment/orders/:orderId/ready-to-pack`

Marks an accepted product order ready to pack. The order must currently be `DISTRIBUTOR_ACCEPTED`; success moves it to `READY_TO_PACK`, writes status history and audits `PRODUCT_ORDER_READY_TO_PACK`. Optional `reason` is recorded. This action does not create a packing record or invoice.

### `POST /api/v1/fulfilment/orders/:orderId/pack`

Marks a ready-to-pack product order packed. The order must currently be `READY_TO_PACK`; success moves it to `PACKED`, writes status history and audits `PRODUCT_ORDER_PACKED`. Optional `reason` is recorded. This action does not dispatch the order or assign delivery.

### `POST /api/v1/fulfilment/orders/:orderId/invoice`

Generates the distributor invoice snapshot for a packed child product order. The order must currently be `PACKED` unless an invoice already exists, in which case the endpoint returns the existing order detail and invoice. Success creates exactly one `ProductInvoice` for the child order, snapshots seller legal/display name, GSTIN, farmer name, delivery address, item lines, reservation batch references and backend-calculated totals in paise. Phase 4C records `taxPaise = 0` until approved GST breakup rules are implemented. This action does not change order status, generate a PDF, dispatch the order, post finance ledger entries, settle parties, refund payments or write Tally data.

### `POST /api/v1/fulfilment/orders/:orderId/ready-for-pickup`

Marks a packed, invoiced child product order ready for pickup. The order must currently be `PACKED`, must already have a generated `ProductInvoice`, and must not already have a dispatch record. Success creates one `ProductDispatch` for the child order, snapshots invoice number, seller details, delivery address, warehouse quantities and reserved item batches, moves the child order to `READY_FOR_PICKUP`, writes status history and audits `PRODUCT_ORDER_READY_FOR_PICKUP` plus `PRODUCT_DISPATCH_CREATED`. Optional `reason` is recorded as the pickup readiness note.

### `POST /api/v1/fulfilment/orders/:orderId/delivery-assignment`

Assigns a ready-for-pickup child order to an active `DELIVERY_PARTNER` user. The order must currently be `READY_FOR_PICKUP`, must have a ready `ProductDispatch`, and must not already have a delivery assignment. Success creates one `ProductDeliveryAssignment`, snapshots dispatch, invoice, seller, delivery address, pickup and item data, stores the delivery OTP as hash plus salt with expiry and attempt count, and audits `PRODUCT_DELIVERY_ASSIGNED`. The local/mock response includes `deliveryAssignment.mockOtpCode` one time so the demo flow can be completed without a real SMS provider. The raw OTP is not stored.

Request body:

- `deliveryPartnerUserId`: active delivery partner user UUID.
- `reason`: optional audit reason.

### `POST /api/v1/fulfilment/orders/:orderId/out-for-delivery`

Moves an assigned delivery out for delivery. The order must currently be `READY_FOR_PICKUP`, the assignment must be `ASSIGNED`, and the actor must have any-assignment manage permission or be the assigned delivery partner. Success moves the child order to `OUT_FOR_DELIVERY`, moves the assignment to `OUT_FOR_DELIVERY`, writes status history and audits `PRODUCT_ORDER_OUT_FOR_DELIVERY` plus `PRODUCT_DELIVERY_OUT_FOR_DELIVERY`.

Request body:

- `reason`: optional audit reason.

### `POST /api/v1/fulfilment/orders/:orderId/deliver`

Completes an out-for-delivery product order after backend OTP verification. The order and assignment must both be `OUT_FOR_DELIVERY`, the OTP must be unexpired, and the maximum failed-attempt count must not have been reached. Success moves the assignment to `DELIVERED`, records OTP verification and completion actor metadata, moves the child order to `DELIVERED`, writes status history and audits `PRODUCT_ORDER_DELIVERED` plus `PRODUCT_DELIVERY_DELIVERED`. Invalid OTP attempts increment the attempt counter and audit `PRODUCT_DELIVERY_OTP_FAILED`. This endpoint does not create payouts, commissions, settlements, refunds, real notifications or Tally records.

Request body:

- `otpCode`: six digit farmer delivery OTP.
- `proofNote`: optional delivery proof note.

## Authentication Boundary

Phase 4E still uses `AUTH_MODE=mock` for protected local development and tests. Mock-authenticated API calls must include `x-user-id`, `x-user-role` and `x-organisation-id`. Those headers must match an active user, active organisation and active membership in the database. Public marketplace discovery endpoints are read-only and do not require mock-auth headers. Production authentication is intentionally not implemented yet.

## Business Portal Contract

The business web portal calls the backend from server components and server actions only. It must be configured with:

- `BUSINESS_WEB_API_BASE_URL`
- `BUSINESS_WEB_MOCK_USER_ID`
- `BUSINESS_WEB_MOCK_ROLE`
- `BUSINESS_WEB_MOCK_ORGANISATION_ID`

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
- `/orders/:orderId`: distributor fulfilment order detail with item snapshots, reservation metadata, status history, invoice summary, dispatch summary, delivery assignment summary and accept/reject/ready-to-pack/pack/generate-invoice/ready-for-pickup/assign-delivery/out-for-delivery/complete-delivery actions.
- `/audit`: audit log view with action, resource and organisation filters.

The frontend may disable or hide invalid approval and fulfilment actions, but the backend remains authoritative for permission checks, onboarding readiness, catalogue readiness, inventory stock balances, distributor offer availability and product-order status transitions.

## Phase 3D Farmer Mobile Contract

The farmer mobile browse screen calls `GET /api/v1/marketplace/products` for pincode, category and search-filtered marketplace discovery. The cart, checkout review, mock payment and cancellation preview skeletons remain sample-data screens wired for the Phase 3A cart contract, Phase 3B checkout/order contract, Phase 3C mock payment contract and Phase 3D cancellation contract. Future API-backed mobile work should call `GET /api/v1/marketplace/products/:productId`, `GET /api/v1/cart`, `POST/PATCH/DELETE /api/v1/cart/items`, `POST /api/v1/checkout/from-cart`, `GET /api/v1/checkout/:checkoutId`, `POST /api/v1/checkout/:checkoutId/cancel`, `GET /api/v1/orders`, `POST /api/v1/orders/:orderId/cancel`, `POST /api/v1/payments/mock-intents`, `GET /api/v1/payments/mock-intents`, `GET /api/v1/payments/mock-intents/:paymentIntentId` and `POST /api/v1/payments/mock-intents/:paymentIntentId/confirm` through typed client generation or equivalent shared contracts. Mobile screens must continue to display seller, fulfilment, backend-derived availability, backend price snapshots, child order grouping, reservation metadata, backend payment status and backend cancellation eligibility rather than calculating stock, price, payment state or inventory release locally.
