# ADR 0006: Kisan Club benefits are platform-funded

- Status: Accepted
- Date: 2026-08-11

## Context

Kisan Club may reduce the amount paid by an eligible farmer for an enrolled Vardhnam-owned product. The distributor created the approved offer and did not consent to funding that programme benefit. Reinterpreting the existing order subtotal as a discounted value would also reduce distributor payable and marketplace commission implicitly.

## Decision

The distributor's current offer price remains the gross goods value and `ProductOrder.subtotalPaise` keeps that meaning. The backend records `clubBenefitPaise` separately and derives `farmerPayablePaise = subtotalPaise - clubBenefitPaise`. Vardhnam funds the difference through append-only `CLUB_BENEFIT_SUBSIDY` ledger entries. Distributor payable and marketplace commission continue to use the gross subtotal.

Benefits are evaluated again inside serializable checkout using current rules, membership, programme scope, delivery pincode, active crops, live offer price and usage limits. Cart benefit values are display snapshots only. Successful returns refund only the allocated farmer-paid amount and append a proportional negative subsidy entry; prior ledger entries are never edited.

## Consequences

- Existing distributor commercial terms and seller-of-record rules remain unchanged.
- Non-Club orders retain zero benefit and farmer payable equal to subtotal.
- A future distributor-funded benefit requires explicit distributor consent and a new funding-source contract.
- Financial reporting must treat Club subsidy as a separate platform marketing cost, not a seller discount or commission.
