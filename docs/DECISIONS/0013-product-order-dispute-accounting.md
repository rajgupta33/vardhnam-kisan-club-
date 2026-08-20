# ADR 0013: Product-order dispute lifecycle and adjustment accounting

**Status:** Accepted
**Date:** 2026-08-18

## Context

The product-order enum already contained `DISPUTED`, but no model or workflow could create, investigate or resolve a dispute. A dispute may follow delivery, a rejected return, a completed refund or an already-closed order. Resolution may award value to the farmer, but existing payments, refunds, commissions and ledger entries are immutable records and cannot be edited to manufacture that award.

## Decision

Product disputes use dedicated `Dispute` and append-only `DisputeEvent` models. Only the owning farmer or seller organisation may raise one, and PostgreSQL permits only one non-closed dispute per seller child order. Opening snapshots the current terminal product-order status and moves the order to `DISPUTED`; resolution restores the exact snapshot.

Investigation (`disputes:manage`) is separated from financial resolution (`disputes:resolve`). Support and operations can assign, add notes and request information. Finance-authorised users resolve and close. A positive farmer award is capped at the backend child-order farmer payable and creates a new negative `ADJUSTMENT` financial-ledger entry linked to the dispute. It does not mutate a payment, refund, commission entry or earlier ledger movement.

## Consequences

- Seller-of-record and child-order boundaries remain intact.
- Every lifecycle change has an event and audit record; order transitions remain independently traceable.
- Financial awards are visible in the immutable ledger but do not claim that a real gateway transfer occurred.
- The future real refund provider may execute a corresponding transfer, but it must preserve the dispute-linked adjustment rather than rewriting it.
- Service-booking disputes remain separate and will be designed with the service marketplace.
