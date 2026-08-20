# Business Rules

## Kisan Club Advisory

- Farmer-visible agronomy content must be bilingual, human-authored, versioned and approved by a different named user holding the `AGRONOMIST` role.
- Advisory selection is deterministic over approved rules and farmer-consented active crop cycles; no generated or inferred prose is served.
- Editing approved advice creates a new draft version. Existing events continue to identify the exact version the farmer saw.
- Advisory consent is optional and may not block Club membership. Withdrawing consent prevents new generation and farmer advisory reads.
- The MVP does not attach crop-protection products or make pesticide recommendations. That capability remains prohibited without explicit legal and licensed-agronomist approval.

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
- Generic OTP login never self-registers an unknown user. Farmer self-registration requires the explicit farmer OTP purpose and backend endpoint.
- Verified farmer self-registration creates or reuses only a `FARMER` membership in the active Vardhnam shared farmer context. It must not grant business roles or silently reactivate suspended users/memberships.
- Farmer account, farmer profile and membership creation after OTP verification must be atomic and audited.

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
- Checkout snapshots the active variant's HSN code and GST rate onto each child-order item. A later catalogue edit must never rewrite that order snapshot.
- Product submission is blocked until every active variant has HSN and GST-rate metadata. These catalogue classifications are subject to administrator review and require chartered-accountant approval before live commerce.
- Invoice generation requires the distributor seller's verified GSTIN/state snapshot and the immutable delivery address's place-of-supply state code.
- Farmer-facing selling prices remain tax-inclusive. The backend extracts tax per order line in integer paise: intra-state supply records CGST plus SGST, while inter-state supply records IGST. Every invoice must reconcile `taxable + tax = subtotal = total` and `CGST + SGST + IGST = tax`.
- Each distributor seller owns a separate sequential invoice-number series per Indian financial year. Replaying an existing order invoice must return the same invoice and must not consume another sequence number.
- WP-15A invoices snapshot distributor seller legal/display/GSTIN/state details, place of supply, farmer name, delivery address, line-level HSN/rate/tax values, reservation batch references and backend-calculated paise totals.
- Invoice generation audits `PRODUCT_INVOICE_GENERATED` and does not create dispatch records, delivery assignments, delivery OTPs, finance ledger entries, settlements, refunds, invoice PDFs, credit notes or Tally records.
- Phase 4D dispatch readiness is allowed only for packed child product orders with a generated invoice and creates at most one `ProductDispatch` per child order.
- Phase 4D dispatch readiness moves the child order to `READY_FOR_PICKUP`, snapshots invoice number, seller, delivery address, warehouse quantities and reserved item batches, and audits `PRODUCT_ORDER_READY_FOR_PICKUP` plus `PRODUCT_DISPATCH_CREATED`.
- Phase 4D does not assign delivery partners, create delivery OTPs, send notifications, create finance ledger entries, settlements, refunds, invoice PDFs or Tally records.
- Phase 4E delivery assignment is allowed only for `READY_FOR_PICKUP` child product orders with a ready `ProductDispatch` and creates at most one `ProductDeliveryAssignment` per child order and dispatch.
- Phase 4E delivery assignment requires an active `DELIVERY_PARTNER` user with an active delivery-partner membership and an `ONLINE` `DeliveryPartnerProfile` in that organisation context. Offline partners cannot receive new assignments. Assignment snapshots dispatch, invoice, seller, delivery address, pickup and item data and audits `PRODUCT_DELIVERY_ASSIGNED`.
- Phase 4E stores delivery OTPs only as hash plus salt with expiry and failed attempt count. The local/mock assignment response may expose a transient `mockOtpCode` once for development completion flows, but the raw OTP must not be stored or audited.
- A pending `ASSIGNED` delivery must be explicitly accepted or rejected by its assigned partner before pickup. Acceptance moves only the assignment to `ACCEPTED`; rejection requires a reason, moves only the assignment to `REJECTED`, and leaves the product order `READY_FOR_PICKUP`.
- Only operations with manage-any authority may reassign a rejected delivery. Reassignment requires a reason, a different active online partner, a fresh delivery OTP, and an audit trail; the seller order and dispatch are not recreated.
- The seller or authorised operations user issues the dispatch package QR. Only its hash is stored. Reissue invalidates the prior label and is forbidden after pickup verification.
- The assigned partner must verify the package QR after accepting and before pickup. Invalid attempts are counted and audited; manual code entry is only a camera fallback and uses the same backend verification.
- Phase 4E moving out for delivery requires order status `READY_FOR_PICKUP`, assignment status `ACCEPTED` and recorded package pickup verification. Success moves the order and assignment to `OUT_FOR_DELIVERY` and audits `PRODUCT_ORDER_OUT_FOR_DELIVERY` plus `PRODUCT_DELIVERY_OUT_FOR_DELIVERY`.
- Phase 4E delivery completion requires order status `OUT_FOR_DELIVERY`, assignment status `OUT_FOR_DELIVERY`, a valid backend OTP and an explicit location-proof outcome. `GRANTED` requires latitude, longitude, device accuracy and capture time; `DENIED` and `UNAVAILABLE` require those values to be absent and must not block completion. Success stores the proof metadata, moves the order and assignment to `DELIVERED` and audits `PRODUCT_ORDER_DELIVERED` plus `PRODUCT_DELIVERY_DELIVERED`; invalid OTP attempts increment the attempt counter and audit `PRODUCT_DELIVERY_OTP_FAILED`.
- A failed delivery may be recorded only while both the child order and assignment are `OUT_FOR_DELIVERY`, and only by the assigned partner or manage-any operations. It requires a controlled reason code and a future retry time no more than seven days away; success moves both records to `DELIVERY_FAILED`, increments the durable failure count and records order history plus audit.
- A failed delivery can return to `OUT_FOR_DELIVERY` only after its backend-stored retry time is due. Retry preserves failure metadata, issues a fresh hashed OTP with a reset attempt limit, records actor/time and writes order history plus audit. The raw OTP remains transient in mock mode only.
- Phase 4E does not send real SMS/WhatsApp messages, store delivery photos, create settlements, refunds, invoice PDFs or Tally records. Photo proof remains dependent on authorised private file storage.
- Backend must calculate and validate all financial amounts.

## Returns

- A return is requested against one distributor seller-specific child product order, never the parent checkout.
- Only the owning farmer may request a return, and only after the order reaches `DELIVERED` and before the configured return window expires.
- Return creation is idempotent. Requested lines must belong to the child order and quantities must not exceed ordered quantities.
- Return/refund snapshots are calculated by the backend in integer paise; the mobile app must not calculate or override them.
- The initial request moves the child order to `RETURN_REQUESTED` and creates append-only return and order histories plus an audit record in the same transaction.
- Seller-scoped distributor users may read and decide only requests belonging to their active seller organisation. Operations users with any-return permission may work across sellers.
- The supported pre-inspection sequence is `REQUESTED` to `APPROVED` or `REJECTED`, then `APPROVED` to `IN_TRANSIT`, then `IN_TRANSIT` to `RECEIVED`. Each transition updates the matching child-order state and writes append-only histories and audit in the same serializable transaction.
- Rejection requires a reason. Operations may assign an approved return only to an active, online delivery partner in an active delivery organisation. The assigned partner must accept before recording collection; own-scope permissions cannot expose or mutate another partner's pickup. Collection moves the return and child order to their in-transit states atomically. The legacy operations pickup transition is allowed only when no return-pickup assignment exists.
- The owning farmer may idempotently cancel a `REQUESTED` or `APPROVED` return before pickup. Cancellation returns the child order to `DELIVERED` and appends return/order history and audit; it does not delete the request.
- A submitted, approved, shipped or received return never creates sellable inventory. `RECEIVED` means held for inspection. Inspection must allocate every returned unit to its original batch reservation as restockable, quarantined, damaged/write-off or rejected. Only an explicit `RESTOCKABLE` decision for an active, unexpired original batch creates sellable stock. Approved refund value is calculated by the backend from non-rejected quantities. Real-provider execution remains a later audited workflow.
- A refund can be initiated only from an inspected return with a backend-approved positive amount. The client never supplies the refund amount. Confirmation first commits `PROCESSING` and an immutable execution event, then a worker calls the provider outside the transaction. Successful worker completion appends refund and commission-reversal ledger entries, completes the return and moves the seller child order to `REFUNDED` in one serializable transaction. The current confirmation provider is explicitly mock-only; real-provider signed status webhooks remain a later workflow.
- A product-order dispute may be raised only by the owning farmer or the child order's seller organisation, and only after the order reaches `DELIVERED`, `RETURN_REJECTED`, `REFUNDED` or `CLOSED`. Opening a dispute snapshots and replaces that terminal order status with `DISPUTED`; resolution restores the exact prior status and records both transitions in order history.
- Only one non-closed dispute may exist for a child order. Creation and participant notes are idempotent. Farmer reads are user-scoped, distributor reads are seller-organisation-scoped, and platform support/operations access requires explicit any-dispute permission.
- Support and operations may investigate and request information, but only finance-authorised users may resolve or close a dispute. A farmer monetary award cannot exceed the backend-stored child-order farmer payable and must append a negative `ADJUSTMENT` financial-ledger entry linked to the dispute; resolution never edits an existing payment, refund, commission or ledger entry.

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

## Kisan Club Membership

- Kisan Club membership is free and has no membership payment, subscription or billing cycle.
- Only a farmer with a farmer profile may join, and one farmer profile may have at most one Club membership.
- Joining requires explicit acceptance of a named terms version. Advisory, marketing and precise-location consent are separate optional choices with separate timestamps.
- Membership begins in `PENDING_PROFILE`. Farm/profile completion and promoter assignment move it through later states; KC-01 does not manufacture an active assignment.
- Member numbers are display references generated with random content. Farmer and promoter resource endpoints must use UUIDs; only authorised staff search may query a member number.
- Suspended membership is read-only. A farmer may still close it. Closing revokes active optional consents and preserves the membership and audit history.
- All membership creation, consent changes, suspension and closure are audited. Membership records are not physically deleted.
- When `KISAN_CLUB_ENABLED=false`, every Club route returns not found and ordinary marketplace behaviour is unchanged.

## Kisan Club Farm Registry

- A farmer must have an editable Kisan Club membership before creating or changing farm records. Suspended, inactive and closed members retain read-only access.
- Farm, crop-cycle and activity access is checked against the authenticated farmer profile on the backend. Knowing another farmer's UUID does not grant access.
- Crop identity comes from the active crop reference table; free-text aliases are not accepted as crop identifiers.
- A crop-cycle area may not exceed its farm area. Expected harvest cannot precede sowing, and actual harvest cannot precede sowing or be in the future.
- Crop-cycle transitions are explicit: `PLANNED` to `ACTIVE` or `ABANDONED`, and `ACTIVE` to `HARVESTED` or `ABANDONED`. Harvested and abandoned cycles are terminal.
- Saving precise farm coordinates requires current precise-location consent and both latitude and longitude. Withdrawing consent removes stored coordinates transactionally. Audit snapshots record whether location existed but never copy coordinates into the audit log.
- Farm activities are append-only. Farmer-created activities are server-stamped with source `FARMER` and the authenticated recorder; clients cannot select their own source or actor.
- Creating the first crop cycle completes the initial farm profile and moves `PENDING_PROFILE` membership to `AWAITING_PROMOTER`. Assignment and activation remain KC-03 responsibilities.

## Kisan Club Promoter Assignment

- A Club promoter must be an active user with an active `PROMOTER` or `SALES_PARTNER` membership in the selected active organisation, an active territory, approved non-expired organisation KYC, available capacity and Club enablement.
- A verified payout account is additionally required whenever the configured Club promoter commission is greater than zero. A zero placeholder rate does not manufacture a payout requirement.
- Auto-matching is deterministic: same village, same pincode, territory pincode coverage, capacity headroom, then promoter user UUID. Ineligible candidates and exclusion reasons are saved in the assignment's diagnostic snapshot.
- No eligible promoter does not cancel or reject Club membership. The member remains `AWAITING_PROMOTER` for later operational matching.
- One membership may have only one active Club promoter. Reassignment ends the prior record, decrements its promoter count, increments the new count, creates the new assignment and replaces the existing active `PromoterAttribution` in one serializable transaction.
- Club assignment drives the existing standard promoter attribution; it does not create a second commission system. In-flight order fulfilment assignments are not transferred by relationship reassignment.
- Suspending or closing Club membership ends its active promoter assignment, decrements capacity and revokes the linked active attribution. Historical records remain available for audit.
- Promoters and sales partners can read only farmers with an active assignment to their own authenticated user ID. Farmer UUID or member-number knowledge never grants access.

## Promoter Farmer Leads

- A farmer lead is a consent-noticed contact record owned by exactly one promoter user and the promoter's active organisation context. It is not a farmer account, Club membership, promoter attribution or order authority.
- Lead conversion cannot create an identity from unverified contact data. The farmer must first complete OTP registration. Conversion atomically links that verified farmer profile, closes the lead as `CONVERTED` and applies the existing single-primary promoter-attribution rule; replay does not create duplicate attribution or audit writes.
- Promoters and sales partners may create, read and update only their own leads. Operations may read and manage any lead through explicit any-scope permissions; knowing a lead UUID never grants access.
- The initial lifecycle is `NEW` to `CONTACTED` to `LOST`. `CONVERTED` is reserved for the later farmer-onboarding transaction and cannot be set through the generic lead update endpoint.
- Marking a contacted lead lost requires a reason. Converted and lost records remain preserved and read-only.
- A promoter cannot keep two open (`NEW` or `CONTACTED`) leads with the same normalized phone number. Audit snapshots mask the phone number.

## Kisan Club Catalogue

- Club enrolment is an operations-managed programme mapping, never a company-editable boolean on the master product.
- Only an approved master product whose owning organisation has type `VARDHNAM` may be enrolled. This ownership and approval rule is checked at creation, activation and every Club discovery read.
- Product-wide and variant-specific programmes are supported. A variant programme may reference only an active variant belonging to that product.
- Programme lifecycle transitions are `DRAFT` to `ACTIVE`, `ACTIVE` to `PAUSED` or `ENDED`, and `PAUSED` to `ACTIVE` or `ENDED`. `ENDED` is immutable and status changes require a reason.
- Club discovery includes only active programmes inside their UTC window and matching the member's home pincode and district when restrictions exist. It then reuses ordinary marketplace offer, seller, warehouse, batch, expiry, serviceability and live-stock validation.
- Club programme enrolment never makes Vardhnam the seller. Every displayed offer remains a distributor offer and the distributor remains seller and invoice issuer.
- A suspended member retains read-only catalogue access. A closed membership cannot use Club discovery.
- An actively assigned promoter may submit a farm survey only for that assigned farmer. The backend repeats membership, location-consent, crop-reference, area and date validation and audits the promoter as actor.
- Outside Kisan Club, a promoter or sales partner may submit a farm/crop survey only for a farmer covered by that promoter's active primary attribution in the active organisation context. The farm remains owned by the farmer profile and has no Club membership link. General surveys do not accept precise coordinates until a separate explicit consent record is approved and implemented, and they do not produce Club advisory events.

## Kisan Club Benefits and Finance

- Only an `ACTIVE` Club member can receive a benefit. The product programme and benefit rule must both be active, inside their UTC windows and match product, optional variant, pincode, district, crop and quantity restrictions.
- Flat and quantity-threshold benefits are configured as per-unit paise amounts. Percentage benefits use integer basis points. All calculations use integers and a benefit may never exceed the gross line value.
- When multiple rules qualify, the backend selects the highest total benefit. Ties prefer crop-specific, then pincode-specific, then general rules, followed by earliest start time and rule UUID.
- Cart benefit values are informational snapshots. Checkout re-reads the live offer and evaluates the rule inside the same serializable transaction that creates orders, reserves inventory, increments usage and records one redemption per order line.
- `subtotalPaise` remains the distributor's gross goods value. `clubBenefitPaise` is platform-funded and `farmerPayablePaise` is their difference. Distributor payable and marketplace commission continue to use gross subtotal.
- Successful payment appends the farmer payment and a separate positive `CLUB_BENEFIT_SUBSIDY` entry for each benefited child order. No frontend may calculate or submit a financial benefit amount.
- Returns allocate the original line benefit proportionally using integer paise arithmetic. The farmer is refunded only the accepted quantity's net paid amount, and successful refund appends the corresponding negative subsidy movement.
- A benefit rule that has redemptions cannot change financial or eligibility terms. Rules and redemptions are preserved; usage and ledger records are never physically deleted.

## Kisan Club Fulfilment Coordination

- Successful payment creates at most one Club fulfilment assignment per Club child order, using the active promoter relationship captured at confirmation time. If no active eligible promoter exists, payment and the product order still succeed without an assignment.
- Relationship reassignment never silently transfers an in-flight order assignment. Operations must explicitly reassign it with a reason; both the `REASSIGNED` and new `ASSIGNED` history events are retained.
- Promoters and sales partners may read and manage only assignments whose `promoterUserId` is their authenticated user ID. Operations may read/manage any assignment; support may read but not mutate.
- The coordination lifecycle is explicit and independently validated. Decline, failure, cancellation and reassignment require the applicable reason and authority. Completed and cancelled assignments are terminal.
- A Club fulfilment status never changes `ProductOrderStatus`, inventory, invoice, payment, refund, commission, delivery proof or delivery payout.
- Physical pickup and delivery remain subject to the existing `ProductDeliveryAssignment` role checks and OTP proof. A promoter must separately be an authorised delivery partner to perform that workflow.
- Fulfilment assignment and status-history records are preserved. Every creation, transition, cancellation and explicit reassignment is audited.

## Kisan Club Intelligence

- Intelligence routes require `kisan-club-intelligence:read` and return aggregate operational data only. They do not grant access to individual membership, farm or fulfilment records.
- Crop intelligence includes active farms belonging only to `ACTIVE` or `AWAITING_PROMOTER` memberships. Suspended, inactive and closed memberships are excluded from aggregates.
- Acreage comes from backend `FarmCropCycle.areaAcres` records and is rounded to three decimal places. The portal must not recalculate or replace these totals.
- Promoter metrics count live active assignment rows rather than trusting the denormalised profile counter. Coordination outcomes belong to each assignment's current holder and must not be presented as historical commission, payout or permanent performance attribution.
- A resolved completion rate uses integer basis points and includes completed, failed, promoter-declined and cancelled coordination records in its denominator. No rate is returned when no work is resolved.
- Crop and promoter aggregates never expose farmer identity, member number, farm UUID, farmer UUID, precise coordinates or delivery address.
- Demand forecasting is deferred until completed-season conversion history is sufficient and an approved forecasting contract exists.
