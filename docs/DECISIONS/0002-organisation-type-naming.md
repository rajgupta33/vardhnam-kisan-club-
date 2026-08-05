# ADR 0002 - Organisation Type Naming and the Missing Delivery Partner Organisation

## Status

Accepted

## Context

`docs/PRODUCT_REQUIREMENTS.md` section 5 defines five organisation types:

- `VARDHNAM`
- `COMPANY`
- `DISTRIBUTOR`
- `SERVICE_PROVIDER_ORGANISATION`
- `DELIVERY_PARTNER_ORGANISATION`

The Prisma `OrganisationType` enum introduced in Phase 0 declared only four, and shortened the service-provider value to `SERVICE_PROVIDER`. `DELIVERY_PARTNER_ORGANISATION` had no equivalent at all.

This was not noticed earlier because Phase 4E assigns deliveries to a `User` holding a `PlatformRole.DELIVERY_PARTNER` membership, and that membership may currently point at any active organisation. Delivery partner organisations therefore had no way to be modelled as first-class sellers-of-service, which blocks Phase 6 partner onboarding and Phase 5 delivery payouts, both of which need an organisation to settle against.

## Decision

Add the missing value to `OrganisationType`, named `DELIVERY_PARTNER`.

Keep the abbreviated form for both partner types (`SERVICE_PROVIDER`, `DELIVERY_PARTNER`) rather than the `_ORGANISATION` suffix used in the product requirements. The enum is already named `OrganisationType`, so the suffix is redundant, and `SERVICE_PROVIDER` is referenced throughout existing Phase 0-4E code and migrations. Renaming it would produce a wide, purely cosmetic diff across the schema, services and integration tests.

The change ships as an additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS` migration, so no existing row is affected.

## Consequences

- Delivery partner organisations can be onboarded, approved and settled against using the same organisation, membership, KYC and approval machinery as companies and distributors.
- `OrganisationType` values differ in name, not meaning, from `docs/PRODUCT_REQUIREMENTS.md` section 5. This ADR is the record of that deviation.
- Phase 5 delivery payouts and Phase 6 partner onboarding can attach to an organisation rather than a bare user.

## Explicit Non-Decisions

This ADR does not introduce delivery partner onboarding profiles, payout bank details, vehicle records or service zones. It only makes the organisation type expressible.
