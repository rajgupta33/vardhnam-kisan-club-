# Vardhnam Farmer Mobile

Flutter farmer application for Vardhnam Agrotech.

The current verified baseline includes Android and iOS runner projects,
Riverpod-owned application state, named `go_router` routes, generated
English/Hindi localisation with a persisted runtime language choice, API-backed
marketplace product browsing by pincode/category/search, farmer OTP onboarding,
secure session persistence with serialized token refresh/retry, signed-in route
guards, API-backed farmer profile and delivery-address management, public
product detail with distributor-offer selection, an authenticated API-backed
cart, address-selected idempotent checkout with child-order review, backend
mock payment confirmation, eligible checkout cancellation, seller-specific
order history/detail, fulfilment timeline, invoice snapshots and authorised PDF
download, return/refund tracking with credit-note download, farmer-owned
support ticket create/list/detail/order-link/reopen, and the bilingual Kisan
Club member journey with farms, crops, advisories, promoter details and benefit
tokens.

The UI foundation follows `VARDHNAM_FARMER_UI_CODEX_IMPLEMENTATION.md`: a
central green/saffron Material theme, farmer-friendly spacing and tap targets,
reusable bordered cards and image placeholders, and a farm-first authenticated
home with five primary destinations. Its header uses the API-backed farmer name
and default delivery address, with a non-blocking generic fallback and a direct
route to address management. The supplied circular Vardhnam Agro mark is bundled
at `assets/branding/vardhnam_logo_full.png` and is used on language selection,
login and the authenticated home. Live weather and final lifestyle,
crop, product and programme imagery remain explicit unavailable/placeholder
states; the app does not fabricate provider data or use remote stock imagery.
Kisan Club now has a dedicated free-programme landing, a four-step location,
farm, searchable-crop and confirmation join flow, and a blueprint-ordered member
dashboard with the API-backed farmer name, active crop and current approved
advisory. Partial profile writes resume from the saved pending membership instead
of duplicating it. Crop problems route to human support without fabricating a
diagnosis. A reusable promoter card and
consistent responsive loading, empty and failure states are included. Membership,
promoter, consent, catalogue and benefit information remains API-authoritative.
Farm management now uses farmer-friendly farm cards plus dedicated farm and
crop-detail views. These views separate current and previous crop cycles,
retain the existing create/edit and activity-diary workflows, and explicitly
withhold crop-stage, weather and seven-day actions when no approved backend
guidance exists.
The marketplace visual refresh adds a delivery-location header, search and
backend-provided category/brand/crop filters, a reusable responsive product
card, and a product-detail image frame. Product images remain labelled
placeholders until the public catalogue contract supplies approved media.
Backend prices, stock, fulfilment SLA, distributor selection and the legal
seller/invoice relationship are unchanged and remain explicit in the UI.
Orders now use seller-first tracking cards with farmer-readable status labels
and a shop action in the designed empty state. Notifications display localized
backend event categories, while Account uses grouped navigation rows for farms,
addresses, language, Kisan Club, support, notifications and logout above the
existing profile form. No unapproved legal/privacy destination was fabricated.

Product discovery/detail, seller-of-record offer information, farmer profile
read/write and farmer-owned delivery-address list/create/edit/default selection
are API-backed. The cart loads and mutates farmer-owned server state; checkout
revalidates against the selected owned address, creates backend child orders
with inventory reservations and renders backend totals. Mock payment
creation/confirmation and eligible checkout cancellation are API-backed, use
persisted idempotency keys and re-read server state after payment confirmation.
The mock provider is clearly labelled and never handles real money.

Discovery supports debounced search, category, brand and crop filtering,
pull-to-refresh and duplicate-safe backend pagination. Filter choices come from
the public pincode-scoped backend options endpoint and include only approved,
active, serviceable products with sellable stock. Every page has an exact
pincode/filter/page cache key.

The cart groups lines by the backend-returned distributor organisation ID and
labels each group as a separate seller order and invoice. It refreshes backend
price and availability snapshots on foreground resume. Checkout review always
loads the cart again before allowing order creation; the app does not calculate
seller totals or trust cached discovery data for commerce mutations.

## Verified toolchain

- Flutter `3.44.9` stable
- Dart `3.12.2`
- Java `17`
- Android SDK and target SDK `36`
- Android application ID `com.vardhnam.agrotech.farmer`

iOS runner sources are committed, but an iOS build requires macOS and Xcode.

## Run

```bash
flutter pub get
flutter gen-l10n
flutter analyze --fatal-infos
flutter test
flutter run
```

By default product browsing calls `http://127.0.0.1:3001/api/v1`. For the
standard Android emulator, use the host-loopback alias:

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

Approved support contacts are build-time configuration and are never embedded
as production-looking placeholders. Supply one or both as E.164 numbers:

```bash
flutter run \
  --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001 \
  --dart-define=FARMER_SUPPORT_PHONE=+911122334455 \
  --dart-define=FARMER_SUPPORT_WHATSAPP=+919988776655
```

The example numbers above are placeholders and must be replaced with
business-approved contacts. Missing or invalid values disable the corresponding
external action while the in-app support-ticket flow remains available.

Privacy, terms and account-deletion destinations are also build-time
configuration. The Account screen always shows these entries, but opens them
only when each value is a valid public HTTPS URL:

```bash
flutter run \
  --dart-define=FARMER_PRIVACY_POLICY_URL=https://www.your-approved-domain.example/privacy \
  --dart-define=FARMER_TERMS_URL=https://www.your-approved-domain.example/terms \
  --dart-define=FARMER_ACCOUNT_DELETION_URL=https://www.your-approved-domain.example/delete-account
```

The example destinations are intentionally rejected placeholders. Replace
them with stable, business-approved public pages. The deletion destination
must lead to the real request and data-deletion workflow, not merely an
informational page.

The debug Android manifest permits clear-text traffic for local development.
The main/release manifest does not enable clear-text traffic; staging and
production API origins must use HTTPS.

## Build Android debug APK

```bash
flutter build apk --debug \
  --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

The generated APK is written to
`build/app/outputs/flutter-apk/app-debug.apk`.

On Windows, this repository and the configured Flutter package cache are on
different drive roots. Kotlin incremental compilation is disabled in
`android/gradle.properties` because Kotlin's cache path conversion does not
support that layout. This changes Android build speed only.

## Build a signed Play bundle

Release builds never use the Android debug key. Copy
`android/key.properties.example` to the ignored `android/key.properties`, point
it to the approved Farmer Play upload keystore outside the repository and fill
the local passwords. A release task fails with an actionable error when that
configuration or keystore is missing; debug builds remain unchanged.

Build an Android App Bundle only with an approved HTTPS production or staging
API origin:

```bash
flutter build appbundle --release \
  --dart-define=MARKETPLACE_API_BASE_URL=https://api.example.invalid \
  --dart-define=FARMER_PRIVACY_POLICY_URL=https://www.your-approved-domain.example/privacy \
  --dart-define=FARMER_TERMS_URL=https://www.your-approved-domain.example/terms \
  --dart-define=FARMER_ACCOUNT_DELETION_URL=https://www.your-approved-domain.example/delete-account
```

Every value in that example is a placeholder and must be replaced before a
release build is accepted for distribution.

Never commit signing files or credentials. Follow
`docs/PLAY_STORE_RELEASE_CHECKLIST.md` before uploading any bundle.

## Current boundary

Farmer OTP request/verification uses the API and persists access/refresh tokens
in platform secure storage. Product discovery and product detail remain public;
dashboard, cart and checkout routes require a local farmer session. Product
detail shows backend-returned prices, availability, seller legal identity,
GSTIN, warehouse, fulfilment, SLA, batch, variants and public document metadata
without calculating commerce values locally. `mockOtpCode` is shown only
as an explicitly labelled development-provider value.

Protected farmer API calls attach the access token centrally. One `401` starts
a serialized refresh, persists the rotated token pair and retries each request
once; a terminal authentication failure clears secure credentials and returns
the app to login. Farmer-only multiple-membership selection is supported.
Logout always removes local credentials and attempts server revocation. Real
SMS is not configured, and device/emulator testing against the local API is
still required. Consent-based device-location assistance remains open. Order history,
child-order tracking, invoice snapshots and authorised invoice PDF download are
API-backed. The app requests generation, checks durable status and opens only the
short-lived signed download URL returned by the backend. Order list and detail support pull-to-refresh and
foreground refresh. Active order detail also polls conservatively every 30
seconds while the app is active; terminal orders stop polling.

Support tickets are API-backed and owner-scoped. The app can link a ticket to
an owned child order and reopen its own resolved/closed ticket. Attachments and
conversation replies remain unavailable until secure upload and ticket-message
contracts exist.

Phone and WhatsApp support actions use the centrally supplied
`FARMER_SUPPORT_PHONE` and `FARMER_SUPPORT_WHATSAPP` build values. Only valid
E.164 values produce launcher actions. Launch failures are reported in-app and
do not interfere with support tickets.

Privacy policy, terms and account-deletion entries are available from Account
in English and Hindi. Their public HTTPS destinations come only from the
`FARMER_PRIVACY_POLICY_URL`, `FARMER_TERMS_URL` and
`FARMER_ACCOUNT_DELETION_URL` build values. Missing, insecure, local or
placeholder destinations stay disabled with an honest in-app message.

The in-app notification inbox is API-backed and authenticated-user scoped. It
supports pagination, an unread-only filter, pull/foreground refresh and audited
mark-read when detail opens. Related-resource actions are allowlisted to product
orders, support tickets and return requests, whose APIs independently enforce
farmer ownership. Mock-payment outcomes, seller-order fulfilment, farmer support
and return/refund lifecycle events now create automatic, locale-aware in-app
notifications. Checkout-level payment references remain informational because a
checkout may contain multiple seller child orders. Unknown resource types remain informational. Push registration, other
business-event producers and production delivery providers are not yet
implemented.

Network transport failures are classified centrally. Discovery, cart,
checkout, order, support and notification screens show bilingual offline and
timeout messages with retry paths instead of raw runtime exception text.
Discovery also retains at most five exact pincode/filter result sets for 24
hours. Cached results appear only after a failed live request and show their age
plus a warning that price and stock may have changed. Product detail and all
cart/checkout mutations remain live-only. Primary read flows now use shared
list/detail skeletons with localised
screen-reader announcements and decorative placeholders excluded from
semantics. Automated accessibility checks cover Android minimum action targets,
text contrast, explicit login keyboard focus order, live-region validation
errors, and English/Hindi narrow displays at 200% text. The large-text suite now
covers dashboard, login, discovery, orders, returns, support and notifications;
marketplace and status-filter dropdowns use constrained expanded layouts. Full
TalkBack/VoiceOver and manual focus/contrast audits still require real devices;
this environment currently has no connected Android device or configured AVD.

## Kisan Club

The authenticated dashboard reads the farmer's own Club membership and hides
the entry when the backend feature flag returns `404`. Enabled farmers can join
the free programme using profile-prefilled locality data, explicit versioned
terms acceptance and independent advisory, marketing and precise-location
choices. The Club home shows membership progress and keeps suspended, inactive
and closed memberships read-only. Club copy is generated from both English and
Hindi ARB catalogues. Members can open an authenticated, pincode-scoped Club
catalogue, inspect eligible programme products and continue through the normal
seller-offer cart flow. Exact Club savings and farmer payable amounts shown in
the cart come from backend snapshots; the app does not calculate benefits.
Checkout review replaces that estimate with the backend's binding Club benefit
and payable totals at checkout, child-order and item level.

Members can create and edit farmer-owned farms and active crop cycles, record
activities and harvest completion, view their assigned promoter, and read or
dismiss consent-gated advisories. Club product detail can issue a one-time
benefit token; its complete bearer code is displayed only in the success
dialog. Token history exposes safe metadata with exact backend status filters,
load-more pagination and duplicate suppression. The app never reconstructs a
token or calculates its quote locally.
