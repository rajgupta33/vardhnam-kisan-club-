# Business Rules

## Marketplace Model

- Farmer is buyer.
- Distributor is normally seller of record.
- Distributor invoices farmer.
- Company owns master catalogue and brand information.
- Vardhnam operates marketplace technology, customer experience, commissions and optional fulfilment.
- Service bookings are separate from product orders.

## Access and Onboarding

- A user may hold different roles in different organisations.
- A request role is valid only when backed by an active organisation membership.
- Company, distributor and service-provider organisations begin in `PENDING_VERIFICATION` unless explicitly created otherwise.
- Company onboarding details must be stored separately from distributor onboarding details.
- Company profile endpoints may only be used for `COMPANY` organisations.
- Distributor profile endpoints may only be used for `DISTRIBUTOR` organisations.
- Company and distributor onboarding queues are derived from organisation status, matching profile presence and KYC document metadata; queue records are not a separate source of truth.
- Approval readiness requires the matching onboarding profile and at least one approved KYC document metadata record.
- KYC submissions in Phase 1B are metadata-only. Real document upload, private storage and authorised document retrieval are future work.
- Same-organisation submitters may create KYC document metadata and resubmit rejected metadata, but approval, rejection and expiry decisions require a reviewer permission.
- Approved or expired KYC document metadata may not be edited by the submitting organisation.
- Approval sets an organisation to `ACTIVE`; rejection sets it to `REJECTED`.
- Company and distributor organisation approval must be enforced by the backend and must fail until the matching profile and at least one approved KYC document metadata record exist.
- Approval and rejection decisions must store reviewer, timestamp, reason where applicable and audit history.
- Memberships are status-managed and should be marked `REMOVED` rather than physically deleted.

## Product and Offer Model

- Company organisations own brand records and master product catalogue data.
- A brand or master product starts as `DRAFT`, may be moved to `SUBMITTED`, and may then be `APPROVED` or `REJECTED` by an authorised catalogue reviewer.
- Catalogue approval and rejection are allowed only for `SUBMITTED` records.
- A company may resubmit a `REJECTED` catalogue record after correction.
- Updating an approved brand or master product reopens it as `DRAFT` and clears prior reviewer metadata.
- Vardhnam approves product masters only after the owning brand is approved.
- A product must have at least one active variant/pack size and at least one product document metadata record before it can be submitted or approved.
- Product documents in Phase 2A are metadata-only. Real upload validation, private file storage and authorised document downloads are future work.
- Distributor creates offers against approved products.
- One product may have multiple distributor offers.
- Distributor offers belong to distributor organisations and must be linked to approved master products, active variants and distributor-owned warehouses.
- A distributor offer may be pinned to one batch or may derive available quantity from all eligible batches for the same distributor, warehouse, product and variant.
- Offer selling prices must be stored in paise as integers.
- Offer availability must be derived on the backend from active, unexpired, non-blocked batch inventory and latest inventory movement balances.
- Distributor offers must be submitted before Vardhnam approval or rejection.
- Approved distributor offers become farmer-visible only when the linked catalogue is approved, the distributor and warehouse are active, the requested pincode is serviceable and backend-derived availability is greater than zero.
- Approved offers may be paused for operational reasons. Paused offers are not farmer-visible but may be reactivated after backend readiness checks pass.
- Archived offers are retired without physical deletion. Archived offers are not farmer-visible and cannot be changed through normal offer update flows.
- Marketplace discovery may expose seller legal/display name, GSTIN, warehouse location metadata, fulfilment mode, delivery SLA metadata, price in paise and available quantity. It must not expose private product document storage keys, review-only notes or unapproved records.
- Phase 2E did not implement cart, checkout, payment, delivery execution, finance, settlement or Tally. Phase 3A adds cart only. Phase 3B adds checkout and product order foundations with inventory reservation. Phase 3C adds backend-confirmed mock payment intents only. Phase 3D adds eligible unpaid and payment-failed cancellation with reservation release. These phases still exclude real payment capture, delivery execution, invoices, finance, settlement, refunds and Tally.

## Checkout and Orders

- Phase 3A cart APIs are farmer-owned and require the authenticated `FARMER` role.
- A farmer cart must validate items against approved distributor offers, approved catalogue, serviceable pincodes and backend-derived sellable availability.
- Cart item prices and availability are backend snapshots stored in paise and integer quantities.
- Mobile clients may display cart snapshots but must not calculate or override price, subtotal or stock availability.
- Changing the cart pincode while items exist is not allowed; the farmer must clear the cart first.
- A cart item does not reserve inventory and does not create an order, invoice, payment, delivery task, finance record, settlement record or Tally record.
- One checkout can create multiple child orders.
- Phase 3B checkout is idempotent and requires an `Idempotency-Key` header.
- Checkout revalidates every cart item against current approved offers, serviceable pincode, active catalogue and backend-derived stock before creating orders.
- Each child product order has exactly one distributor seller and independent status history.
- Phase 3B creates inventory reservations as append-only `RESERVED_FOR_ORDER` inventory movements at batch level.
- Manual inventory adjustment APIs must not create reservation movement types.
- Phase 3B product orders may reach `INVENTORY_RESERVED` but do not create invoices, payment records, delivery tasks, finance records, settlement records or Tally records.
- Phase 3C mock payment intent creation is idempotent and requires an `Idempotency-Key` header.
- A checkout must have reserved child order inventory before a mock payment intent can be created.
- Existing open mock payment intents must be reused instead of creating duplicate payment attempts for the same checkout.
- Mock payment confirmation is a backend action. Frontend success UI is not proof of payment.
- Successful mock payment confirmation moves the payment intent to `SUCCEEDED`, checkout to `PAID` and child product orders to `CONFIRMED`.
- Failed mock payment confirmation moves the payment intent to `FAILED`, checkout to `PAYMENT_FAILED` and child product orders to `PAYMENT_FAILED`.
- Mock payment failure does not release reserved inventory by itself. Phase 3D releases reserved inventory only when the farmer cancels an eligible unpaid or payment-failed checkout/order.
- Checkout cancellation is allowed only for `PENDING_PAYMENT` or `PAYMENT_FAILED` checkouts. `PAYMENT_PROCESSING` checkouts cannot be cancelled while a mock payment attempt is in flight. `PAID` checkouts cannot be cancelled until a future refund workflow exists.
- Product order cancellation is allowed only for farmer-owned child orders in `PENDING_PAYMENT`, `INVENTORY_RESERVED` or `PAYMENT_FAILED`.
- Cancellation writes child order status history, sets eligible cancelled records to `CANCELLED` and records audit entries for checkout cancellation, order cancellation and inventory release.
- Reservation release must be represented as append-only `RELEASED_FROM_ORDER` inventory movements with positive quantity deltas and `ProductOrderCancellation` references. Original `RESERVED_FOR_ORDER` movements and reservation rows must not be deleted or edited.
- Manual inventory adjustment APIs must not create `RESERVED_FOR_ORDER` or `RELEASED_FROM_ORDER` movement types.
- Phase 3C and Phase 3D records do not create invoices, payment provider captures, webhooks, delivery tasks, finance records, settlement records, refund records or Tally records.
- Phase 4A distributor fulfilment reads are scoped to the seller distributor organisation unless the actor has any-order fulfilment permissions.
- Phase 4A accept/reject actions are allowed only for `CONFIRMED` child product orders. Accept moves the child order to `DISTRIBUTOR_ACCEPTED`; reject moves it to `DISTRIBUTOR_REJECTED` and requires a reason.
- Phase 4A rejection does not release inventory, refund the farmer, reallocate the order, create invoices, create delivery tasks or write finance/Tally records.
- Phase 4B picking and packing actions are allowed only in sequence: `DISTRIBUTOR_ACCEPTED` to `READY_TO_PACK`, then `READY_TO_PACK` to `PACKED`.
- Phase 4B packing does not create invoices, dispatch records, delivery assignments, delivery OTPs, finance records or Tally records.
- Phase 4C invoice generation is allowed only for packed child product orders and creates at most one `ProductInvoice` per child order.
- Phase 4C invoices snapshot distributor seller legal/display/GSTIN details, farmer name, delivery address, item lines, reservation batch references and backend-calculated paise totals.
- Phase 4C invoices audit `PRODUCT_INVOICE_GENERATED`, set `taxPaise = 0` until approved GST breakup rules exist, and do not create dispatch records, delivery assignments, delivery OTPs, finance ledger entries, settlements, refunds, invoice PDFs or Tally records.
- Phase 4D dispatch readiness is allowed only for packed child product orders with a generated invoice and creates at most one `ProductDispatch` per child order.
- Phase 4D dispatch readiness moves the child order to `READY_FOR_PICKUP`, snapshots invoice number, seller, delivery address, warehouse quantities and reserved item batches, and audits `PRODUCT_ORDER_READY_FOR_PICKUP` plus `PRODUCT_DISPATCH_CREATED`.
- Phase 4D does not assign delivery partners, create delivery OTPs, send notifications, create finance ledger entries, settlements, refunds, invoice PDFs or Tally records.
- Phase 4E delivery assignment is allowed only for `READY_FOR_PICKUP` child product orders with a ready `ProductDispatch` and creates at most one `ProductDeliveryAssignment` per child order and dispatch.
- Phase 4E delivery assignment requires an active `DELIVERY_PARTNER` user with an active delivery partner membership. It snapshots dispatch, invoice, seller, delivery address, pickup and item data and audits `PRODUCT_DELIVERY_ASSIGNED`.
- Phase 4E stores delivery OTPs only as hash plus salt with expiry and failed attempt count. The local/mock assignment response may expose a transient `mockOtpCode` once for development completion flows, but the raw OTP must not be stored or audited.
- Phase 4E moving out for delivery requires order status `READY_FOR_PICKUP` and assignment status `ASSIGNED`. Success moves the order and assignment to `OUT_FOR_DELIVERY` and audits `PRODUCT_ORDER_OUT_FOR_DELIVERY` plus `PRODUCT_DELIVERY_OUT_FOR_DELIVERY`.
- Phase 4E delivery completion requires order status `OUT_FOR_DELIVERY`, assignment status `OUT_FOR_DELIVERY` and valid backend OTP verification. Success moves the order and assignment to `DELIVERED` and audits `PRODUCT_ORDER_DELIVERED` plus `PRODUCT_DELIVERY_DELIVERED`; invalid OTP attempts increment the attempt counter and audit `PRODUCT_DELIVERY_OTP_FAILED`.
- Phase 4E does not send real SMS/WhatsApp messages, create geotagged proof capture, calculate delivery payouts, create finance ledger entries, commissions, settlements, refunds, invoice PDFs or Tally records.
- Backend must calculate and validate all financial amounts.

## Inventory

- Inventory is distributor-, warehouse- and batch-specific.
- Warehouses belong to distributor organisations and may only be managed for active distributor organisations.
- Batch metadata must be linked to an approved master product through an active product variant.
- Expired or blocked batches cannot be sold.
- Inventory movements are append-only.
- Current on-hand stock is represented by backend-recorded movement balances.
- Stock adjustments must be recorded as inventory movements and cannot reduce batch stock below zero.
- Manual adjustments require reason and audit entry.
- Low-stock and expiring-batch reports are derived from batch metadata and latest inventory movement balances.
- Blocked and expired batches must not be counted as sellable low-stock inventory.

## Finance

- Use immutable ledger entries.
- Keep farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, taxes, refunds, adjustments and settlements separate.
- Payment webhook processing must be idempotent.
- Frontend payment success redirects are not proof of payment.
- Phase 3C mock payment intents are operational payment-state records only. They are not immutable financial ledger entries and must not be used for settlement.

## Prohibited MVP Features

Credit, lending, insurance, buy-now-pay-later, AI agronomy advice, pesticide prescription, blockchain, cryptocurrency, real-bank settlement automation and real Tally write-back are out of MVP unless separately approved.
