# ADR 0007: Club fulfilment is coordination-only

- Status: Accepted
- Date: 2026-08-11

## Context

Kisan Club needs promoter visibility and coordination around confirmed member orders. The existing product-order and delivery-assignment workflows already define the seller's commercial lifecycle, delivery-partner authorisation, OTP proof of delivery and delivery earnings. Allowing a promoter coordination record to mutate those workflows would weaken existing role, proof and finance controls.

Whether promoters will physically deliver Club orders remains a business, KYC and insurance decision.

## Decision

`KisanClubFulfilmentAssignment` is an operational overlay attached one-to-one to a child `ProductOrder`. It has its own explicit state machine and append-only status history. It never changes `ProductOrderStatus`, creates delivery proof, confirms delivery, or creates delivery earnings.

Successful payment confirmation creates the assignment for the active membership-promoter relationship when one exists. Relationship reassignment does not transfer in-flight assignments. Operations may explicitly reassign the fulfilment record with two history transitions and an audit reason.

Actual delivery continues through `ProductDeliveryAssignment`. A promoter who physically delivers must separately hold an authorised `DELIVERY_PARTNER` membership and use the existing OTP/POD workflow.

## Consequences

- Promoter inaction cannot block or rewrite the distributor order lifecycle.
- Club progress labels are coordination claims, not proof of physical delivery.
- Promoter and operations access is resource-scoped in the service, including when route permissions allow own-or-any alternatives.
- A future decision to create promoter-specific physical delivery requires a separate ADR and explicit approval.
