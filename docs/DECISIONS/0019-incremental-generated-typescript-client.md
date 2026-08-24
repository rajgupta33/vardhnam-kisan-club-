# ADR 0019: Incremental generated TypeScript API client migration

**Status:** Accepted
**Date:** 2026-08-23

## Context

`packages/api-client` contains a large hand-written client already imported throughout the business portal. Replacing it in one change would combine hundreds of contract decisions with a runtime transport migration. The committed OpenAPI document also has strong request DTO coverage but many endpoints do not yet declare response schemas, so generated response types cannot safely replace every domain interface at once.

## Decision

Use `openapi-typescript` to generate committed runtime-free path and schema types at `packages/api-client/src/generated/openapi.ts`. CI runs `npm run check:api-client` after `npm run check:openapi`, creating a sequential gate from Nest metadata to OpenAPI to TypeScript.

Use the small `openapi-fetch` runtime for path-, parameter-, body- and response-aware requests. Keep the existing client during migration. For each vertical slice, first document an accurate global success-envelope response in Swagger, regenerate both artifacts, then migrate a read-only call before related mutations. The business portal `GET /api/v1/admin/jobs/queues` call is the pilot.

The pilot expanded on 2026-08-24 to cover the whole Admin Jobs domain: queue depths, the typed paginated dead-letter list, and the audited retry mutation. This establishes the expected endpoint-by-endpoint sequence without requiring a large replacement change.

The Notifications portal workflow followed in the same incremental form: its delivery-log filters and paginated response are generated, and the permission-gated failed-delivery retry uses the generated dispatch path and acknowledgement. Provider execution remains asynchronous and backend-owned.

The Tally portal workflow then migrated its filtered list, detail with attempt history, reconciliation aggregates, and manual mock-outcome mutation. Generated enums exposed `SYNCING` as a valid backend status that the former hand-written portal union and filter had omitted; the generated contract now prevents that drift from recurring. No real Tally adapter is implied by this migration.

The Dashboard portal workflow then migrated both permission-scoped summary reads and the separately permissioned, audited export read. The portal continues to render and export only backend-calculated counts; generation does not move aggregation or scope enforcement into the frontend.

Support ticket list and detail reads followed as a deliberately read-only slice. Generated query types now cover pagination and ticket filters, and generated response enums replace the portal's duplicated ticket model. The next slice documented and migrated the related portal assignment, waiting, resume, escalation, resolution, closure and reopening actions together; backend permission checks, state transitions, validation and audits remain authoritative.

Payout account list, reviewer detail, self-account and self-statement reads followed without initially migrating writes. The generated account schema captures the backend-provided reviewer role omitted by the former portal model, while account masking and statement totals remain backend-owned. The next slice migrated audited self-upsert and finance verification/rejection together; raw account details remain request-only and every returned account number is still backend-masked.

Organisation list and detail reads followed. Defining the response contract exposed that the previous Prisma includes could serialize full reviewer and membership `User` records, including `passwordHash`. The service now selects an explicit safe identity projection (ID, email, phone, status and display name), the OpenAPI response models contain only that projection, and regression tests reject password-hash selection or schema exposure.

User list and detail reads followed. This exposed a more direct version of the same issue: list, detail, create and update previously returned Prisma `User` records with every scalar field. All four backend operations now use a shared safe response projection, while the portal read calls consume generated pagination, filter, path and response types. User mutations remain on the older portal transport until their next deliberate migration slice.

## Consequences

- Existing portal workflows continue to use the proven client until migrated.
- New generated calls cannot silently invent paths, query parameters or documented response shapes.
- Response-schema omissions become visible and are repaired endpoint by endpoint.
- Two small dependencies are added: `openapi-typescript` for development-time generation and `openapi-fetch` for runtime transport.
- TypeScript duplication remains temporarily and must be removed as consumers migrate.
- This decision does not select a Dart generator; both Flutter applications keep their current transport until that boundary is reviewed separately.
