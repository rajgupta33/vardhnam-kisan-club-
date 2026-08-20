# ADR 0017: GST credit notes for succeeded return refunds

**Status:** Accepted for sandbox testing; tax treatment requires CA approval
**Date:** 2026-08-19

## Context

A refund must not delete, rewrite or void the distributor's original invoice. Accepted returned goods require a separately numbered credit note linked to that invoice. Kisan Club orders add an accounting distinction: the farmer receives the net amount paid, while the seller's taxable supply and the platform-funded subsidy are reversed separately.

## Decision

A successful return refund creates exactly one immutable `CreditNote`, enforced by a unique `refundId`. Its consecutive seller/financial-year number uses a credit-note-specific series no longer than sixteen characters. The record snapshots the original invoice number/date, seller legal details and address, farmer/delivery details, reason, place of supply, accepted quantities, HSN/rate and all tax components.

The gross GST credit is calculated only from accepted inspection dispositions and original invoice line classifications. Tax is extracted per credited line with the same integer-paise inclusive calculation used by invoices. `grossCreditPaise = taxableAmountPaise + taxPaise`. The farmer refund remains `farmerRefundPaise`; any Kisan Club difference is `subsidyReversalPaise`, and both must sum to the gross credit. Existing ledger entries continue to represent the cash refund and subsidy reversal separately.

Credit-note creation and its queued document row occur inside the same serializable, row-locked refund-success transaction. Redis receives only the document UUID after commit. Stable job IDs, idempotent claiming and a scheduled recovery sweep prevent duplicate issue or loss around retries and process crashes. PDFs use embedded Devanagari fonts, private storage, checksums, signed URLs and audited access.

## Consequences

- The original invoice remains immutable and traceable after a return.
- A retry cannot consume another credit-note number or create another credit note for the refund.
- Rejected inspection quantities receive no GST credit.
- Credit notes cannot currently be issued for refunds without a return request and original product invoice.
- The classifications, rounding and final legal presentation remain sandbox/provisional until chartered-accountant approval.

## Primary references

- [CBIC CGST Rules — Rule 53 credit/debit note particulars](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf)
- [CBIC sectoral FAQ — credit notes for goods returns under Section 34](https://cbic-gst.gov.in/sectoral-faq.html)
