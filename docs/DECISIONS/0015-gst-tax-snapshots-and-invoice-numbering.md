# ADR 0015: GST tax snapshots and seller invoice numbering

**Status:** Accepted for sandbox testing; tax classifications require CA approval
**Date:** 2026-08-18

## Context

Product prices and order totals are already presented to farmers as final amounts in integer paise. The invoice foundation stored a zero-tax placeholder and used a random invoice number, so it could not preserve the product tax classification, determine intra- versus inter-state supply, or provide a seller-specific financial-year sequence.

## Decision

An active catalogue variant must have an HSN code and GST rate before its master product can be submitted for administrator review. Checkout snapshots both fields onto each child-order line so a later catalogue edit cannot rewrite an existing transaction. Distributor approval snapshots the GSTIN-derived registered state, and farmer addresses store the place-of-supply state code.

Prices remain tax-inclusive. Invoice generation extracts tax once per order line using integer `BigInt` arithmetic and half-up paise rounding. An intra-state line divides tax into CGST and SGST, assigning any odd paise to SGST so the persisted components reconcile exactly. An inter-state line records the full amount as IGST. Invoice header totals are sums of the immutable line snapshots, and database constraints enforce `taxable + tax = subtotal = total` and `CGST + SGST + IGST = tax`.

Each distributor organisation has an `InvoiceSequence` row per Indian financial year, calculated at the Asia/Kolkata boundary. Invoice creation increments that row inside the same serializable transaction as the immutable invoice, then formats `<stable-four-character-seller-series>/<FY-end-suffix>/<six-digit-sequence>` within the 16-character Rule 46 limit. A failed transaction rolls back both the increment and invoice. Replaying invoice generation returns the existing invoice without consuming another number.

## Consequences

- Tax rates and HSN codes are controlled catalogue data, not frontend calculations or distributor-offer overrides.
- Historical orders and invoices retain their original tax classification and place-of-supply evidence.
- One seller's sequence is isolated from every other seller and resets at the financial-year boundary.
- Existing prices do not increase when GST metadata is added because tax is extracted from the farmer-approved gross amount.
- The implemented rate values, HSN classifications, rounding policy and invoice presentation are not approved production tax advice. A chartered accountant must approve them before legal invoices or live commerce are enabled.
- This decision does not generate an invoice PDF, credit note, e-invoice/e-way-bill payload or accounting export; those remain separate work.

## Primary references

- [CBIC CGST Rules — Rule 46 tax-invoice particulars](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf)
- [CBIC IGST Act — place of supply for goods involving movement](https://cbic-gst.gov.in/hindi/IGST-bill-e.html)
