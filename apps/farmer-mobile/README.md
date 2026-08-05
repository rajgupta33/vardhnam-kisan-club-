# Vardhnam Farmer Mobile

Flutter farmer application for Vardhnam Agrotech.

Phase 3D includes app structure, simple dashboard, English/Hinglish string scaffolding, API-backed marketplace product browsing by pincode/category/search, cart preview screens, checkout review preview screens, mock payment preview states, cancellation preview states and widget tests. Real payment providers, refunds and delivery execution flows are intentionally out of Phase 3D.

## Run

```bash
flutter pub get
flutter run
```

By default product browsing calls `http://127.0.0.1:3001/api/v1`. Override the backend URL when needed:

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```
