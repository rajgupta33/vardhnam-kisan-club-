# ADR 0016: Durable invoice PDF generation and private storage

**Status:** Accepted for sandbox testing
**Date:** 2026-08-19

## Context

The immutable GST invoice snapshot must be downloadable by its farmer and seller without making financial documents public or treating Redis as durable storage. PDF generation can fail or be interrupted independently of invoice creation.

## Decision

Each `ProductInvoice` has at most one `ProductInvoiceDocument`. The database row records `QUEUED`, `PROCESSING`, `AVAILABLE` or `FAILED`, attempts and the last error. The documents queue carries only that row's UUID and uses a stable job ID. A five-minute maintenance sweep re-enqueues queued documents and processing jobs stale for fifteen minutes, closing the database-commit/Redis-enqueue and worker-crash gaps.

The worker renders only immutable invoice snapshots, embeds IBM Plex Sans Devanagari (OFL-1.1), writes trusted bytes through the storage-provider interface and records size plus SHA-256 checksum in `StoredFile`. Generated documents are marked available without client upload or malware scanning because their bytes originate inside the trusted renderer. The object remains private; the API returns short-lived signed download URLs.

The `StoredFile` owner is the invoice's farmer user and its organisation is the distributor seller. Existing file rules therefore permit that farmer, active users of that seller organisation and authorised `files:read:any` operators while preventing cross-seller access. Every issued PDF and every signed download is audited.

## Consequences

- Invoice creation remains committed even if PDF generation is temporarily unavailable.
- Retries overwrite the same object key and cannot create a second document row for one invoice.
- The PDF is a rendering of financial data, never a source for recalculation.
- Local disk remains development/CI-only; production must supply a private durable object-storage provider before launch.
- Credit notes and CA approval of the final legal template remain separate WP-15B work.
