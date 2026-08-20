# ADR 0005: Kisan Club is an additive platform layer

- Status: Accepted
- Date: 2026-08-11

## Context

Kisan Club adds free programme membership, farm relationships, scoped catalogue benefits, promoter coordination and advisory. The existing platform already owns products, distributor offers, inventory, checkout, seller child orders, invoices and finance.

## Decision

Kisan Club is implemented in additive `kisan-club`, `farms` and later `advisory` backend modules inside the existing API and applications. It composes existing marketplace services and never creates a second catalogue, order pipeline, seller model, inventory pool or financial ledger. Membership is free. A default-off feature flag makes Club routes indistinguishable from unavailable routes and later checkout hooks must short-circuit while disabled.

## Consequences

- Existing seller-of-record, backend pricing, inventory reservation and invoice invariants remain authoritative.
- Club-specific records refer to existing farmer, product, offer and order UUIDs.
- Club rollout can be disabled without changing ordinary marketplace requests.
- Any future change that forks checkout or finance requires a separate ADR and explicit product approval.
