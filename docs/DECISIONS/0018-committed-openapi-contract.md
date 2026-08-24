# ADR 0018: Committed OpenAPI contract and drift gate

**Status:** Accepted
**Date:** 2026-08-23

## Context

The API exposed Swagger only from the listening non-production bootstrap. Frontends could not consume a stable file, `packages/api-client` drifted from the backend, and CI had no way to detect a controller or DTO change that was not reflected in a committed transport contract.

Generating the document by directly executing TypeScript is unsafe for this Nest application because lightweight transpilers do not emit the decorator metadata required by dependency injection. Starting the normal API just to download Swagger would also claim a network port and couple contract generation to a running service.

## Decision

Swagger metadata is built by a shared `createOpenApiDocument` function used by both the non-production documentation route and a dedicated exporter. The exporter runs from Nest's compiled output so decorator metadata matches the real application, constructs the application module graph, scans Swagger metadata, writes `apps/marketplace-api/openapi.json`, closes the application and never calls `listen`.

The generated JSON is committed. `npm run check:openapi` regenerates the document in memory and fails when it differs from the committed file; CI runs this gate after Prisma client generation. The local storage-provider object route remains deliberately excluded because it is signed provider plumbing rather than a public client contract.

## Consequences

- API route and schema drift is visible in code review and fails CI.
- Contract generation cannot interfere with an API already using the configured port.
- Runtime Swagger and the committed document share title, description, version and scanning logic.
- The exporter builds the API first, which is slower than direct TypeScript execution but preserves required Nest decorator metadata.
- This decision does not select a TypeScript or Dart client generator. The current hand-written client remains unsupported until a later slice generates and migrates consumers from this committed contract.
