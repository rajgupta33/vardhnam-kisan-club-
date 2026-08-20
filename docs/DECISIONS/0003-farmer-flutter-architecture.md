# ADR 0003 - Farmer Flutter Application Architecture

## Status

Accepted

## Context

The farmer Flutter application began as a small screen prototype. Product
discovery has a hand-written HTTP repository, while cart, checkout, payment and
cancellation use static preview data. Navigation is imperative, localisation is
not connected to Flutter's generated ARB runtime, and there is no secure session
storage or shared application state.

The completed farmer journey must support OTP authentication, token refresh,
English/Hindi runtime switching, deep links, multi-distributor checkout,
idempotent retries, slow networks and farmer-owned resource access. Expanding
the prototype without an application structure would duplicate transport types
and scatter security-sensitive state across widgets.

## Decision

Use a feature-first Flutter structure with these boundaries:

- `app/` owns bootstrap, routing, themes and the signed-in application shell.
- `core/` owns configuration, network policy, secure/non-sensitive storage,
  localised error mapping and shared widgets.
- `api/generated/` contains generated OpenAPI transport models and clients.
- `features/<feature>/` owns presentation, application state, repository
  interfaces and transport-to-domain mapping for one farmer capability.

Adopt dependencies only when their first consuming slice is implemented:

- `flutter_riverpod` for dependency injection and testable asynchronous state;
- `go_router` for guarded navigation, nested navigation and deep links;
- `dio` for authenticated HTTP, timeouts, cancellation and upload/download
  progress;
- `flutter_secure_storage` for access and refresh tokens only;
- `shared_preferences` for non-sensitive preferences such as locale;
- `uuid` for persisted client operation and idempotency keys; and
- `connectivity_plus` as a network-change hint, never as proof of API reachability.

Generate API transport types from the backend OpenAPI document. Feature UI and
domain state must depend on repository/domain models rather than directly on
generated transport classes.

Use `com.vardhnam.agrotech.farmer` as the Android application ID and iOS bundle
identifier. Permit clear-text HTTP only in the Android debug manifest for local
emulator development. Staging and release configurations require HTTPS.

## Consequences

- Authentication, locale and route state have one explicit owner and can be
  replaced in tests.
- HTTP authentication/refresh/idempotency policy is enforced once rather than
  reimplemented in every feature.
- Features remain reviewable vertical slices and can represent multi-seller
  child orders without a single-seller UI assumption.
- Initial setup requires repository adapters and generated-client work before
  most prototype screens are promoted to production flows.
- Adding packages is incremental; this ADR does not justify unused speculative
  dependencies.

## Explicit Non-Decisions

- This ADR does not select a production payment, SMS, WhatsApp or push provider.
- It does not permit client-side financial calculations.
- It does not combine product orders with future service bookings.
- It does not select the offline database; that choice will be made with the
  bounded discovery-cache slice.
