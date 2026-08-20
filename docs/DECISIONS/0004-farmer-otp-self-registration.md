# ADR 0004 - Farmer OTP Self-Registration

## Status

Accepted

## Context

OTP login previously worked only for a pre-created active user with an eligible
active membership. Automatically registering every unknown phone presented to
the generic OTP endpoint would blur farmer onboarding with partner login and
could grant an unintended role.

The existing authorisation model requires every request role to be backed by an
active organisation membership. Farmer-owned resources are scoped by user ID,
while the membership supplies the authenticated `FARMER` role and permissions.

## Decision

- Use dedicated `/auth/farmer/otp/request` and `/auth/farmer/otp/verify`
  endpoints with an isolated `FARMER_REGISTRATION` challenge purpose.
- Canonicalise Indian mobile numbers to `+91` before challenge and user lookup.
- After OTP verification, atomically create the user, user profile, farmer
  profile and `FARMER` membership when they do not exist.
- Place self-registered farmers only in the active `VARDHNAM` organisation with
  slug `vardhnam-farmer-context`. This context grants no seller ownership.
- Reuse existing active farmer memberships. Never reactivate suspended users or
  memberships through authentication.
- Store OTPs only as salted hashes, consume a challenge once, bound attempts,
  rate-limit request/verify endpoints and audit identity/membership creation.
- Store mobile access and refresh tokens in platform secure storage. Locale may
  remain in ordinary preferences because it is non-sensitive.

## Consequences

- New farmers can enter through the farmer app without administrator pre-creation.
- Generic OTP remains suitable for existing promoter, delivery and service roles
  without accidentally creating farmer accounts.
- The shared farmer-context organisation must be provisioned and active before
  registration is available.
- Multiple genuine farmer memberships still require a farmer-only selection UI;
  the first mobile slice reports that state without exposing business roles.
- `SMS_PROVIDER=mock` is development/sandbox only. Production launch remains
  blocked on an approved SMS provider and removal of transient mock OTP exposure.
