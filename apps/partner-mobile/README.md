# Vardhnam Partner Mobile

Flutter application shared by promoters, sales partners, service providers and
delivery partners.

Promoters and sales partners can record append-only field visits against their own leads or actively attributed farmers and review their recent visit history. Visit purposes are controlled, English/Hindi copy is available, and current location is requested only when the promoter explicitly enables it for that submission; background tracking is not used.

The verified shell uses the existing partner-eligible OTP endpoints, filters
out farmer and business-portal memberships, supports explicit organisation
selection, stores access/refresh credentials in platform secure storage and
routes each session to exactly one role workspace. Access-token refresh is
serialized and authenticated requests retry once after a `401` before the
local session is invalidated.

Generated English/Hindi localisation, device-locale fallback and persisted
runtime language switching are enabled. Android and iOS runners use
`com.vardhnam.agrotech.partner`; iOS compilation still requires macOS/Xcode.

## Run

```bash
flutter pub get
flutter gen-l10n
flutter analyze --fatal-infos
flutter test
flutter run
```

For the standard Android emulator:

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

The debug Android manifest permits clear-text traffic for local development.
Release builds retain Internet permission but require an HTTPS API origin.

## Build Android debug APK

```bash
flutter build apk --debug \
  --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

The APK is written to `build/app/outputs/flutter-apk/app-debug.apk`.

## Current boundary

This completes the shared WP-12 authentication, session, localisation and
role-routing foundation. KC-10A adds a promoter/sales-partner-only Kisan Club
workspace backed by the scoped assigned-farmer list/detail APIs. It displays
only the backend allowlist of member, locality, farm and crop data and can redeem
a complete one-time farmer benefit token through an idempotent assisted checkout.
The result clearly remains pending farmer in-app payment.

KC-10B adds the promoter's own Club fulfilment inbox with exact status filters,
duplicate-safe pagination, assignment detail and coordination history. Available
actions mirror the backend transition graph, decline/failure require a reason,
operations-only cancellation/reassignment are not exposed, and assignment state
is re-read after every mutation. Coordination remains explicitly separate from
the displayed seller-order status.

KC-10C adds assigned-farmer farm surveys with controlled crop references,
farm-only or farm-plus-current-crop submission, backend-aligned validation and
an authoritative farmer-detail refresh after save. The app does not collect or
send precise coordinates because this slice has no explicit location-consent flow.

KC-10D adds the recipient-scoped earnings statement with exact status filters,
duplicate-safe pagination and backend-provided totals. The shared WP-12 surface
makes earnings and own payout-account setup/editing available to every supported
partner role. Full account details are sent only to the authenticated own-account
endpoint, IFSC is normalised to uppercase, edits reset verification to pending,
and the app only renders the server-returned account-number mask. Provisional
earnings are explicitly shown as not yet payable and the app does not calculate
commission.

The WP-12 delivery workspace includes audited, organisation-scoped online/offline
availability. Missing profiles default offline and only online partners can receive
new assignments. It also provides a backend-scoped assignment inbox and detail
view for `DELIVERY_PARTNER`, package/address snapshots, explicit accept or
reason-required reject actions, the accepted-only out-for-delivery transition and
farmer-OTP completion. Operations can reassign rejected work to a different online
partner with a fresh OTP. Another delivery partner cannot list or read the
assignment. Seller-issued package QR scanning has a manual fallback, is verified
by the backend before delivery can start, and records pickup actor/time. External
maps navigation and pilot `tel:` farmer calling are available without collecting
partner location. Delivery completion now asks for foreground location permission,
records coordinates, device accuracy and capture time when granted, and records
`DENIED` or `UNAVAILABLE` without blocking the farmer-OTP path. An assigned partner
can record a controlled failed-delivery reason, optional note and retry time; the
backend enforces a seven-day scheduling window, preserves the failure count/audit
trail and allows a due retry with a fresh OTP. Approved returns now have a separate
own-scoped pickup inbox and detail flow with accept, reason-reject, navigation,
calling and collection actions. Collection advances the backend return and child
order together; the app performs no financial calculations. Photo proof remains
deferred until authorised private storage exists.

Shared KYC documents and the service marketplace remain later vertical slices.
Real SMS and device/emulator verification also remain open.

Promoters and sales partners have a read-only, bilingual territory view. It
reads only the active organisation context; authorised operations staff own
assignment changes, and general assignment does not implicitly enable Kisan
Club work.

Converted leads with an active promoter attribution can be surveyed outside
Kisan Club using the same validated farm and crop form. These general surveys
collect coarse locality and acreage only; the client sends no precise location.

WP-13 has started with a promoter/sales-partner farmer-lead pipeline. Farmer
registration can now be completed with the present farmer's OTP directly from a
contacted lead. The backend derives the phone and name from the owned lead,
returns no farmer login tokens to the partner app, and converts the verified
farmer under the existing single-primary promoter-attribution rule. Contact
capture uses controlled sources and an explicit privacy notice, list reads are
forced to the authenticated promoter, and status actions mirror the backend's
audited `NEW → CONTACTED → LOST` graph.
