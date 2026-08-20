# ADR 0008: Assisted Kisan Club purchase requires in-app payment

- Status: Accepted
- Date: 2026-08-11

## Context

Kisan Club farmers may ask their assigned promoter to prepare an order using a short-lived benefit token. Allowing the promoter to collect cash would introduce platform float, reconciliation, promoter liability and a new settlement ledger that the current `PaymentIntent` model does not support.

## Decision

The pilot assisted-purchase flow creates the farmer's normal seller child order in `PENDING_PAYMENT`/`INVENTORY_RESERVED` state and requires the farmer to complete the existing in-app payment flow. Token redemption cannot mark payment successful, record promoter cash, issue an invoice or complete delivery.

The token is an authorisation credential, not a price lock. Its quoted unit price and benefit are display snapshots. Redemption re-derives price, serviceability, inventory and benefit inside the ordinary serializable checkout transaction. The complete bearer code is returned once and stored only as a salted hash with expiry, attempt limits and atomic one-time consumption.

## Consequences

- Distributor seller-of-record, invoice, inventory, payment and finance rules remain unchanged.
- The promoter is recorded as the actor and the farmer remains the order owner and buyer.
- Assisted orders receive `ASSISTED_PURCHASE` coordination mode after successful payment.
- Cash collection requires a later finance work package and a separate approved decision.
