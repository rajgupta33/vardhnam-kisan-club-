# Farmer Mobile Application Implementation Plan

**Status:** Approved planning baseline  
**Prepared:** 2026-08-07  
**Primary scope:** `apps/farmer-mobile` and only the backend work required to complete a farmer-facing vertical slice

## Implementation progress

As of 2026-08-07, the Phase 0 baseline is substantially complete and the first
Phase 1 foundation slice is implemented:

- Flutter 3.44.9 and Dart 3.12.2 are installed and verified.
- Android SDK 36, Build Tools 36.0.0, Platform Tools and Temurin JDK 17 are configured.
- Android and iOS runner projects are generated with application identifier
  `com.vardhnam.agrotech.farmer`.
- Dependency resolution, localisation generation, fatal-info analysis and all
  existing widget tests pass.
- A debug APK builds successfully and was inspected for its package ID, SDK
  levels, application label and Internet permission.
- ADR 0003 records the target Flutter architecture.
- `MaterialApp.router`, named `go_router` routes and Riverpod-owned locale state
  replace direct `MaterialPageRoute` navigation and hardcoded English state.
- Generated English/Hindi localisation is active at runtime. The app selects a
  valid saved preference first, then a supported device locale, then English;
  the dashboard language control persists changes in non-sensitive preferences.
- Hinglish placeholders and visible preview category/payment/order statuses are
  localised.
- Dedicated farmer OTP endpoints now self-register verified farmers atomically
  in the active shared farmer context, without changing generic partner OTP
  login. Identity, farmer profile, membership and verification events are
  audited and a Prisma migration adds the isolated registration purpose.
- The mobile app now has a bilingual OTP onboarding screen, request/verify and
  resend states, secure token storage, local session restoration, serialized
  access-token refresh/retry, logout cleanup and signed-in route guards. Product
  discovery remains public.
- The authenticated farmer profile screen reads and updates the existing profile
  fields. Delivery addresses support list, create, edit and backend-enforced
  default selection. Farmer-owned farms, acreage, crop cycles, activities and
  harvest completion are connected to audited backend endpoints.
- Product detail, server cart and address-selected checkout are API-backed.
  Checkout creates and displays seller-specific child orders and reservation
  snapshots. Backend mock-payment success/failure, safe retry and eligible
  checkout cancellation are implemented with persisted idempotency keys.
- The current automated baseline passes 106 Flutter tests and 108 API unit tests.
  All 21 API integration suites pass against local PostgreSQL (84 tests total),
  with the production-authentication suite run separately under its required
  `AUTH_MODE=production` configuration.

Remaining Phase 0 work is an Android emulator/physical-device launch against
the local API. Farmer CI is pinned and strengthened, but the separately isolated
partner baseline still has an existing dependency-resolution failure outside
this farmer plan. The machine has no Android emulator system image yet, and iOS
compilation still requires macOS/Xcode. Remaining Phase 1 work is farmer-only selection for genuinely
multiple farmer memberships, first-launch
language onboarding, a real approved SMS provider and device/API integration
testing. The current mock OTP exposure is explicitly development-only.

## 1. Outcome

Deliver a production-shaped Flutter application in which a farmer can:

1. register or sign in with OTP;
2. select English or Hindi;
3. maintain their farmer profile, farm/crop information and delivery addresses;
4. discover only approved, stocked and pincode-serviceable distributor offers;
5. inspect the actual seller, fulfilment method, delivery SLA and price returned by the backend;
6. maintain a server-authoritative cart;
7. create a multi-distributor checkout and complete the MVP mock/sandbox payment flow;
8. track every child order independently, including its seller and status timeline;
9. cancel when the backend says cancellation is eligible;
10. view and download the distributor invoice when available;
11. request and track a return/refund;
12. create and follow support tickets;
13. receive in-app and push notifications; and
14. remain usable on slow or intermittent mobile networks.

The partner app, business portal expansion and unrelated backend modules are frozen while this plan is executed. Backend work is permitted only when it directly unlocks a farmer-app slice or protects a marketplace business rule.

## 2. Non-negotiable product rules

- The farmer is the buyer and the distributor is normally the seller of record.
- Every product/order screen must identify the distributor seller; the company/brand must not be presented as the seller.
- One checkout may split into multiple child product orders. Each child order has its own seller, invoice and fulfilment timeline.
- Product orders and service bookings remain separate domain models and flows.
- Prices, totals, taxes, discounts, refunds and eligibility decisions come from the backend in integer paise. The app may format values but must not calculate authoritative amounts.
- Checkout, payment and cancellation retries reuse a stable idempotency key. A button retry must not silently create a new business operation.
- The app never treats a payment redirect, local success screen or client callback as proof of payment.
- Hindi and English are MVP requirements. Error codes remain machine-readable and are mapped to localised messages in the app.
- GPS is optional and consent-based. Manual pincode/address entry always remains available.
- No production SMS, WhatsApp, payment or push provider is enabled without explicit approval and a production-readiness review.

## 3. Audited starting point

This section records the state found before Phase 0 and is retained as an audit
baseline. The implementation progress section above is the current state.

### 3.1 Flutter application

The app initially was an early prototype:

- It contains `lib/`, `test/`, `pubspec.yaml` and localisation source files, but no checked-in Android or iOS runner projects and no `pubspec.lock`.
- Flutter has not been installed or run in the current environment, so compilation and device behaviour are unverified.
- Only marketplace product listing uses the backend (`GET /api/v1/marketplace/products`).
- Mock payment and cancellation screens use hardcoded preview data. Cart and checkout are API-backed.
- OTP login, profile and support dashboard items have no action.
- Navigation uses direct `MaterialPageRoute` calls and there is no application state, dependency injection, guarded routing or deep-link handling.
- The HTTP layer is a hand-written `dart:io` client with duplicated response models and no authentication, refresh, idempotency, request cancellation or consistent error mapping.
- ARB files exist, but the app reads `AppStrings.en` directly. Hindi is largely Hinglish, several visible values are hardcoded, and generated Flutter localisation is not wired into `MaterialApp`.
- The test suite contains four widget tests for the prototype and has never been executed here.

### 3.2 Backend capability map

| Farmer capability                            | Backend status            | Delivery decision                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product list and detail by pincode           | Ready                     | Connect during discovery slice.                                                                                                                                                                      |
| OTP request/verify and token refresh         | Partial                   | Sign-in works only for an existing active user with an eligible active membership. Add a controlled farmer-registration/onboarding flow. SMS remains mock/sandbox for MVP.                           |
| Farmer profile and farm registry             | Ready and connected       | Name, locale and crop interests use the profile API; structured farms, acreage, crop cycles, activities and harvests use separately owned and audited farm APIs.                                    |
| Address list/create/edit/default             | Ready                     | Connect during profile slice. Add optional device-location assistance in the app; server data remains authoritative.                                                                                 |
| Server cart                                  | Ready                     | Replace the static cart completely.                                                                                                                                                                  |
| Multi-seller checkout and batch reservations | Ready                     | Connect with stable idempotency keys and display returned child orders.                                                                                                                              |
| Payment                                      | MVP ready                 | Mock intent create/confirm is available. Production provider/webhook flow is not ready and is not required for the current MVP.                                                                      |
| Order list/detail/status history             | Ready                     | Build farmer list, detail and timeline.                                                                                                                                                              |
| Seller invoice data                          | Complete                  | JSON invoice snapshot plus authorised asynchronous PDF request, durable status and short-lived signed download are wired in Order detail.                                                          |
| Delivery tracking                            | Partial                   | Order/assignment status is available; real-time tracking, ETA and geolocation are not. Use refresh/polling and honest status labels.                                                                 |
| Cancellation                                 | Ready for eligible states | Let the backend decide eligibility; handle conflicts after status changes.                                                                                                                           |
| Support tickets                              | Partial                   | Create/list/detail/evidence metadata exist. There is no binary evidence upload or customer-agent conversation thread.                                                                                |
| In-app notifications                         | Partial                   | Read/list/mark-read APIs and transactional, locale-aware payment/order/support/return/refund event producers exist. Other domain triggers and production delivery providers remain incomplete.       |
| Returns and refunds                          | Partial                   | Return lifecycle, original-batch inspection and idempotent mock refund/immutable ledger processing are implemented; the app shows refund status. Evidence, disputes and a real provider remain open. |
| Product reviews                              | Blocked                   | No review model or endpoints. Build after delivered-order verification rules are agreed.                                                                                                             |
| Push notifications                           | Blocked                   | No device-token registration and no production push provider/event integration.                                                                                                                      |
| Service browsing/booking                     | Blocked and deferred      | No separate service marketplace model or endpoints. Implement only after the product-order farmer MVP is stable.                                                                                     |

## 4. Target application architecture

Use a feature-first Flutter structure with thin UI widgets, testable application state and repositories hiding transport details:

```text
lib/
  app/
    app.dart
    bootstrap.dart
    router.dart
    theme/
  core/
    config/
    errors/
    network/
    storage/
    localisation/
    widgets/
  api/
    generated/
  features/
    auth/
    onboarding/
    profile/
    addresses/
    discovery/
    product_detail/
    cart/
    checkout/
    payments/
    orders/
    invoices/
    returns/
    support/
    notifications/
    settings/
```

Each feature owns its presentation, application state, repository interface and transport-to-domain mapping. Generated API types stay inside `api/generated`; UI code must not depend directly on generated transport classes.

### 4.1 Proposed dependencies and reasons

Add dependencies in the foundation slice and record them in `docs/DECISIONS/0003-flutter-app-architecture.md`:

- `flutter_riverpod`: explicit dependency injection and testable asynchronous feature state.
- `go_router`: authenticated routing, nested bottom navigation and notification deep links.
- `dio`: interceptors, timeouts, cancellation, upload/download progress and consistent API error handling.
- `flutter_secure_storage`: access/refresh tokens only.
- `shared_preferences`: non-sensitive preferences such as language and onboarding hints.
- `uuid`: client operation IDs/idempotency keys.
- `connectivity_plus`: network-change hints. It must not be treated as proof that the API is reachable.
- `url_launcher`: authorised phone/WhatsApp support entry points.

Add later only when its slice starts:

- a small persistent database/cache after the discovery cache contract is defined;
- `image_picker` only when evidence upload exists;
- Firebase messaging packages only when device-token and notification event APIs exist;
- a maintained image caching package only when product image URLs are actually served.

Do not add a general-purpose service locator, duplicate state libraries or speculative plugins.

### 4.2 API and session rules

- Generate a Dart client from a committed OpenAPI document after response DTO schemas are completed. Use a small repository adapter over the generated client.
- Until generation is ready, do not expand the current hand-written `marketplace_api.dart` into more duplicated models.
- Add `Authorization: Bearer <access token>` in one interceptor.
- On one `401`, perform a single-flight refresh. Queue concurrent failed calls, retry once, then clear the session and route to sign-in if refresh fails.
- Never log OTPs, access tokens, refresh tokens, personal addresses or support evidence.
- Use environment-defined HTTPS API origins for dev/staging/production. Release builds must reject clear-text production endpoints.
- Preserve `x-request-id` from API errors and expose a short reference in support-friendly error UI.
- Classify errors into validation, unauthenticated, forbidden, conflict/stale state, rate limited, offline/timeout, server and unknown.

### 4.3 Navigation model

```text
Bootstrap
  -> language (first launch only)
  -> phone -> OTP -> farmer onboarding (when profile is absent)
  -> main shell
       Home
       Browse -> product detail -> cart -> checkout -> payment status
       Orders -> child order detail -> timeline -> invoice / cancel / return
       Account -> profile -> farms/crops -> addresses -> language -> support
```

Notifications deep-link only to resources the authenticated farmer can read. Unknown or unauthorised links fall back to a safe notification detail screen.

## 5. Delivery sequence

Work in vertical slices. A slice is complete only when the UI, API integration, loading/empty/error states, English/Hindi copy, tests and documentation are all present.

### Phase 0 — Toolchain and truthful baseline

**Target:** an installable Android debug application and a reproducible Flutter build.

1. Pin the Flutter channel/version after `flutter --version` and `flutter doctor -v` are available.
2. Generate and commit Android/iOS runner projects with an approved application ID; do not overwrite existing Dart sources.
3. Add environment configuration for emulator, physical-device, staging and production API origins.
4. Run and repair `flutter pub get`, `flutter gen-l10n`, `flutter analyze --fatal-infos` and `flutter test`.
5. Launch on an Android emulator/device against the local API (`10.0.2.2` for the standard Android emulator).
6. **Complete:** the dedicated farmer Flutter CI job pins Flutter 3.44.9,
   resolves dependencies, generates localisation, enforces Dart formatting,
   runs analysis with `--fatal-infos` and executes the full test suite. The
   unverified partner app remains isolated in a separate baseline job.
7. Write the Flutter architecture ADR and replace prototype README claims with verified commands/results.

**Exit gate:** clean analysis/tests, a reproducible debug build, and a successful API health/product request from a device. iOS compilation remains a separate macOS/Xcode gate.

### Phase 1 — App shell, localisation and secure authentication

**Backend enabler:** implement explicit farmer self-registration/onboarding after verified OTP, or document and enforce an approved promoter-created-user prerequisite. Do not silently create broad organisation access.

1. Wire generated `AppLocalizations` into `MaterialApp.router` with English/Hindi delegates.
2. **Complete:** device-locale detection supplies the initial display language;
   when no supported preference has been saved, a guarded first-launch screen
   requires an explicit English or Hindi choice and persists it even when it
   matches the device default. Existing dashboard/login switches remain
   available, and a restored authenticated session survives the choice flow.
3. Replace all `AppStrings.en`, hardcoded category/status/payment strings and Hinglish placeholders.
4. Add bootstrap/splash, signed-out and signed-in route guards.
5. Build phone input, OTP request, six-digit verification, resend countdown and rate-limit/attempt-limit states.
6. Store tokens securely, restore session, refresh silently and log out with server revocation plus local cleanup.
7. **Complete:** farmer OTP verification returns a typed selection flow only
   when at least two active farmer memberships are eligible. The app filters and
   renders farmer organisation names without role choices, and the short-lived
   backend selection token is cryptographically bounded to the exact eligible
   membership IDs so another business membership cannot be selected directly.

**Exit gate:** a seeded farmer and a newly onboarded farmer can sign in, restart the app without losing a valid session, switch language and log out. No token appears in logs or ordinary preferences.

### Phase 2 — Farmer profile, farms/crops and addresses

**Backend enabler:** add structured farm and crop entities/fields for farm name/location, acreage plus unit, owned/leased status where required, crop and season. Add migration, validation, ownership checks and audit records.

1. Build first-login profile completion and later edit screens. **Complete for
   the structured Club MVP:** the existing farmer profile fields have an
   authenticated bilingual edit screen. After Club join, a resumable guided
   flow uses server-saved farm and crop-cycle state, requires the first farm and
   crop cycle, and exits only after the backend advances the membership from
   `PENDING_PROFILE`. Pending members can resume from the Club status action.
2. Build farms/crops list, add and edit flows without mixing service availability
   or product inventory into those models. **Complete:** farmer-owned farm
   list/create/edit and crop-cycle create/edit/activity/harvest flows are
   connected to audited, farmer-owned backend endpoints. Historical harvested
   and abandoned cycles remain read-only in the app.
3. Build address list, add/edit and default selection. **Complete:** manual
   address management is API-backed; optional consent-based device-location
   assistance remains deferred.
4. Offer device location only after consent; convert it into editable address/pincode suggestions. The farmer must confirm before saving.
5. Make the selected/default pincode the discovery and cart context.

**Exit gate:** all resources are owned by the authenticated farmer, invalid pincodes are rejected inline, and changing the cart address revalidates serviceability on the server.

### Phase 3 — Discovery and product detail

**Backend enablers:** add explicit crop/problem filters if the approved taxonomy requires them; provide authorised public product image URLs or signed URLs.

1. **Complete:** category chips use the backend's public pincode-scoped filter
   options rather than a hardcoded mobile taxonomy.
2. **Complete:** debounced search, authoritative category/brand/crop filters,
   pull-to-refresh and duplicate-safe backend pagination are complete. Each
   additional page uses its exact cache key and may use a bounded cached page
   only after a failed live request.
3. **Complete:** product detail loads by product ID + pincode and shows description, variants, offer selection, seller legal/display identity, GSTIN when present, fulfilment mode, delivery SLA, availability, pack size, batch metadata, public document metadata and backend price.
4. **Complete:** cart rejection triggers an authoritative product-detail refresh,
   removes withdrawn/expired or no-longer-stocked seller data, reselects another
   live offer when available, and disables offers whose live stock is below the
   backend minimum quantity. If the cart response accepts the item at a changed
   backend price, the farmer must explicitly stay or review the repriced cart.
5. **Complete:** cache a bounded last-good discovery result by pincode/filter
   and page for read-only offline display. Cached data shows its age and stale
   stock/price warning; product detail and cart/checkout mutations require live
   backend validation.

**Exit gate:** an approved offer appears only for a serviceable pincode; seller identity is unambiguous; changing pincode refreshes availability; offline cached results cannot be mistaken for live stock.

### Phase 4 — Server cart, checkout and MVP payment

1. **Complete:** replace static cart data with authenticated `GET/POST/PATCH/DELETE /cart` operations.
2. **Complete:** quantity controls submit mutations to backend validation and
   use the cart response's current offer `minimumOrderQuantity` and
   `maximumOrderQuantity` together with the returned availability snapshot.
   Controls show the effective range, disable invalid directions and can correct
   a previously valid cart quantity directly to a changed live boundary.
3. **Complete:** show seller, warehouse and backend
   price/availability/line-total snapshots with pull-to-refresh. Cart lines are
   grouped by the backend-returned distributor organisation ID and explain that
   each seller creates a separate order and invoice. Cart snapshots refresh on
   foreground resume, and entering checkout performs a fresh backend cart read.
4. **Complete:** build pincode-matched owned-address selection and checkout review from backend cart/address data.
5. **Complete:** create checkout with a persisted idempotency key and display every returned child order, seller, backend total and batch reservation separately.
6. **Complete:** create and confirm the backend mock payment intent for the MVP, then re-read server payment and checkout status rather than inferring success locally.
7. **Complete for checkout-level cancellation:** provide pending, success, failure, retry and eligible cancellation paths. Mutation controls disable repeat taps and persisted idempotency keys support safe retry after ambiguous network failure. Per-child cancellation remains in Phase 5 order detail.

**Exit gate:** the seeded multi-distributor scenario creates one parent checkout, the correct child orders and backend-calculated totals exactly once, even after a timeout/retry.

### Phase 5 — Orders, fulfilment tracking, invoice view and cancellation

1. **Complete:** paginated farmer-owned child-order list with exact backend status filters and pull-to-refresh.
2. **Complete:** child-order detail and chronological status timeline from `ProductOrderStatusHistory`.
3. **Complete:** seller, delivery address, item/batch, dispatch and delivery-assignment snapshots.
4. **Complete:** display generated distributor invoice snapshot data and provide the authorised asynchronous PDF request, status check and short-lived download flow.
5. **Complete:** surface per-child cancellation only for potentially eligible statuses, require confirmation, submit with a persisted idempotency key and render backend conflicts/errors.
6. **Complete:** order list/detail refresh on foreground resume, and active order detail polls every 30 seconds using non-overlapping one-shot timers. Polling pauses outside the foreground and stops for distributor-rejected, delivered, cancelled, refunded and closed terminal states.

**Exit gate:** the farmer can track each seller order independently through delivery, see the distributor invoice data and cancel eligible unpaid/failed orders without duplicate release operations.

### Phase 6 — Support, in-app notifications and resilience

**Backend enablers:** define evidence upload and ticket conversation/thread APIs; create business-event notification producers.

1. **Complete for the current ticket contract:** create, paginated own-list, detail, status/resolution display, foreground refresh and farmer-owned reopen flows. Agent/customer conversation replies remain gated on a thread API.
2. **Complete:** order detail launches a ticket form with the owned child-order ID, and ticket detail links back to that order.
3. **Gated:** add evidence only through authorised uploads with file type/size validation and progress. The mobile app does not call the existing metadata-only evidence endpoint.
4. **Complete for the current in-app contract:** paginated farmer-owned inbox, unread-only filtering, detail, server-audited mark-read, foreground refresh and safe deep links to owned product orders or support tickets. Event producers and push delivery remain gated on backend work.
5. **Complete:** phone and WhatsApp launcher actions use validated E.164 support numbers supplied per environment through build-time configuration. Missing/invalid configuration is shown honestly and ticket creation remains available.
6. **Complete for current farmer flows:** authenticated and public commerce read flows now classify
   offline and timeout failures centrally, show selected-locale English/Hindi
   messages, preserve backend domain errors and avoid exposing unexpected
   exception details. Existing list/detail screens provide retry actions.
   Discovery persists at most five exact pincode/filter query results for 24
   hours and uses them only after a failed live request, with bilingual age and
   stale price/stock warnings. Product detail and every cart/checkout mutation
   remain live-only. Shared semantic list/detail skeletons now cover discovery,
   profile, addresses, cart, checkout, orders, support and notifications.
7. **Automated audit complete; manual device audit pending:** shared loading
   states expose one live-region announcement and hide decorative placeholders;
   login uses explicit keyboard traversal and live-region validation feedback;
   key section headings are semantic; decorative navigation/status semantics do
   not duplicate or imply unavailable actions. Automated checks cover Android
   48dp targets, text contrast and English/Hindi at 200% text for dashboard,
   login, discovery, orders, returns, support and notifications. Large-text
   testing found and fixed marketplace/status-filter dropdown overflow. Full
   TalkBack/VoiceOver and manual focus/contrast audits remain device-gated; no
   Android device or AVD is available in the current environment.

**Exit gate:** a farmer can raise and follow a ticket from an order, recover from a dropped network without duplicate mutations, and use all critical flows with large text and screen-reader semantics.

### Phase 7 — Returns, refunds, invoice PDF and push

Build these as end-to-end backend/mobile slices, in this order:

1. **Complete for the request foundation:** farmer-owned child-order eligibility,
   configured-window validation, item/quantity selection, idempotent request
   creation, backend paise snapshots, bilingual mobile submission, order status
   transition and append-only audit/history. Approval and inspection continue in
   the following items;
2. **Partial:** item/reason/quantity selection is complete; authorised evidence
   upload remains gated on WP-08 file storage;
3. **Complete for inspection without pickup assignments:** the app provides a
   paginated, filterable own-return list and detail timeline. Backend and portal
   workflows cover approval, rejection, operations pickup, seller receipt and
   explicit inspection allocation against original reservations. Only approved
   restockable quantities from active, unexpired original batches become
   sellable; quarantine/write-off trace movements and histories are append-only.
   The farmer may idempotently cancel before pickup. Dedicated delivery-partner
   return-pickup assignments remain a later slice;
4. **Complete with the development provider:** refund initiation is idempotent
   and backend-priced; successful mock confirmation appends the primary refund
   and commission-reversal ledger entries, moves the child order to `REFUNDED`,
   completes the return and exposes farmer-safe refund status/reference. The MVP
   HTTP acceptance journey now covers delivery through return, original-batch
   inspection, refund and reversal. Real provider execution remains gated;
5. **Complete:** authorised distributor invoice PDF generation/download and
   successful-refund credit-note summary/status/download in the farmer app;
6. **Partial:** mock-payment outcomes, seller-order fulfilment, farmer support
   and return/refund transitions now create transactional English/Hindi in-app notifications and
   deep-link through allowlisted, farmer-owned order/ticket/return detail routes.
   Checkout-level payment notifications remain informational because one checkout
   may contain multiple seller child orders.
   Device-token registration, invalid-token cleanup, other domain event
   producers and FCM/APNs delivery remain gated on the production provider
   decision.

Inventory must never become sellable merely because the farmer submitted or shipped a return. The backend releases it only after the approved inspection workflow.

**Exit gate:** a delivered eligible order can enter the complete audited return/refund lifecycle, and the farmer receives localised status notifications without exposing another user's resource.

### Phase 8 — Reviews, release hardening and pilot readiness

1. Add reviews only for eligible delivered purchases, with moderation and one-review-per-eligible-line rules agreed first.
2. Remove every remaining preview/demo path from release builds.
3. Add privacy/permission copy, app version display, secure production config and release signing through protected CI secrets.
4. Test upgrade, background/resume, token expiry, device-clock differences, process death during checkout and low storage.
5. Run the complete seeded MVP acceptance journey on a physical Android device.
6. Run iOS build and critical-flow verification on macOS before iOS distribution.

**Exit gate:** release candidate passes the quality matrix and contains no mock UI that appears production-ready. Approved mock/sandbox payment and messaging modes are visibly labelled in non-production builds.

### Phase 9 — Service marketplace (after product-commerce sign-off)

Create a separate plan and separate backend models for service listings, provider availability, quotes/bookings, schedules, service payments, disputes and refunds. Reuse identity, localisation, support and notification infrastructure, but do not reuse product cart, inventory or product order state.

## 6. Quality strategy

### Unit tests

- DTO/domain mapping and unknown enum fallback.
- Localised error-code mapping.
- Auth refresh single-flight and terminal logout.
- Stable idempotency key reuse after timeout/retry.
- Pagination, search debounce and cache expiry.
- Order status-to-presentation mapping.
- Currency formatting from integer paise without authoritative arithmetic.

### Widget tests

- Loading, content, empty, validation, offline, error and retry states for every feature.
- English and Hindi rendering, including long Devanagari strings and large text scale.
- Seller identity and multi-child-order presentation.
- Disabled/double-tap protection for checkout and payment.
- Semantics labels, focus order and minimum target sizes on critical controls.

### Integration tests

- OTP request/verify/refresh/logout against a disposable backend.
- Farmer ownership enforcement for profile, addresses, cart, orders, invoices, returns and tickets.
- Browse -> detail -> cart -> checkout -> mock payment -> tracking -> cancellation/support.
- Ambiguous network failure during idempotent mutations.
- App restart with pending payment and active order.

### Device and non-functional tests

- Android emulator plus at least one lower-memory physical Android device.
- Network shaping for high latency, low bandwidth, packet loss and offline recovery.
- Cold start, scroll and image-memory checks with a realistic catalogue.
- Accessibility scan and manual TalkBack pass.
- iOS simulator/physical verification on macOS before iOS release.

## 7. Definition of done for every farmer feature

A feature is complete only when:

- acceptance behaviour works against the real local/staging API, not hardcoded data;
- server permissions and farmer ownership are tested;
- external input is validated and errors use machine-readable codes;
- money and eligibility decisions originate from the backend;
- all strings are in complete English and Hindi ARB catalogues;
- loading, empty, offline, timeout, stale and retry states are intentional;
- analytics/logging contain no OTP, token or sensitive personal data;
- unit/widget/integration tests appropriate to risk pass;
- `flutter analyze --fatal-infos` and `flutter test` pass;
- relevant OpenAPI, README, architecture and handover documentation is updated; and
- assumptions, mock providers and remaining limitations are stated honestly.

## 8. Milestones and indicative effort

Effort is in focused developer-weeks and should be recalibrated after Phase 0 verifies the codebase:

| Milestone                                 | Included phases |                             Indicative effort | Demonstrable result                                                                                 |
| ----------------------------------------- | --------------- | --------------------------------------------: | --------------------------------------------------------------------------------------------------- |
| M0: Verified Flutter baseline             | Phase 0         |                                    0.5-1 week | App builds, runs and is checked in CI.                                                              |
| M1: Farmer identity                       | Phases 1-2      |                                     2-3 weeks | OTP session, localisation, profile, farms/crops and addresses.                                      |
| M2: Commerce MVP                          | Phases 3-5      |                                   3.5-5 weeks | Real browse, product detail, cart, checkout, mock payment, tracking, invoice data and cancellation. |
| M3: Supportable pilot                     | Phase 6         |                                   1-1.5 weeks | Tickets, in-app notifications, offline UX and accessibility.                                        |
| M4: Complete product-order farmer journey | Phases 7-8      |              3-5 weeks, shared backend/mobile | Returns/refunds, invoice PDF, push, reviews and release hardening.                                  |
| M5: Farmer service booking                | Phase 9         | Separate estimate after service-domain design | Independent service browse/booking flow.                                                            |

The fastest honest target is **M2**, which demonstrates the authoritative MVP acceptance path with mock payment. M4 cannot be completed by Flutter work alone because its backend domains do not yet exist.

## 9. First execution sprint once Flutter is installed

1. Capture `flutter --version` and `flutter doctor -v`.
2. Confirm Android SDK licences, emulator/device visibility and JDK compatibility.
3. Create the missing Android/iOS runner scaffolds using the approved Vardhnam application ID.
4. Run:

   ```powershell
   Set-Location 'apps/farmer-mobile'
   flutter pub get
   flutter gen-l10n
   dart format --output=none --set-exit-if-changed lib test
   flutter analyze --fatal-infos
   flutter test
   ```

5. Fix every baseline failure before adding architecture dependencies.
6. Start the local PostgreSQL/Redis/API stack, seed the demo farmer and verify product discovery from the emulator.
7. Implement the architecture ADR, router, Riverpod bootstrap, Dio client, environment config and generated localisation.
8. End the sprint with one device-tested path: launch -> select language -> public product discovery, plus automated tests and CI.

## 10. Decisions required before their gated phases

These decisions should not block Phase 0:

- final Android application ID and iOS bundle ID;
- approved Hindi agricultural terminology and reviewer;
- farmer self-registration versus promoter-assisted creation policy;
- farm/acreage fields and units;
- product/problem taxonomy ownership;
- return windows, reasons, evidence and inspection rules;
- invoice GST/PDF format and authorised download retention;
- support phone/WhatsApp numbers per environment;
- push provider/project and privacy wording; and
- review eligibility/moderation policy.

All other implementation should proceed using the authoritative project documents and the smallest complete vertical slice.
