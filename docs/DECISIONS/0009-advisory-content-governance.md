# ADR 0009: Kisan Club Advisory Content Governance

**Status:** Accepted

**Date:** 2026-08-13

## Decision

Kisan Club advisories are bilingual, human-authored, versioned records selected by deterministic crop-cycle rules. A distinct `AGRONOMIST` role approves content, and an author cannot approve their own rule. Editing approved content creates a new draft version.

The MVP excludes advisory product mappings and all automatic pesticide recommendations. Pest and disease content may only be non-product monitoring guidance that has passed the same human review.

## Consequences

- Every farmer-visible sentence traces to an approved rule version and named reviewer.
- Advisory generation can be replayed safely because event uniqueness includes crop cycle, rule and version.
- ~~A manual generation endpoint is an explicitly temporary scheduler boundary until the queue/worker package is implemented.~~ **Resolved 2026-08-18:** WP-04 delivered the queue, and `generate-advisories` now runs daily at 05:30 in `SCHEDULER_TIMEZONE` — early enough that an irrigation or spraying advisory reaches a farmer before the working day. The manual endpoint remains for deliberate off-cycle runs and for proving a newly approved rule behaves as expected. A scheduled run is audited with a null actor and the job named in the reason, since no person triggered it.
- Product-linked crop-protection advice still requires a later explicit legal and professional approval decision.
