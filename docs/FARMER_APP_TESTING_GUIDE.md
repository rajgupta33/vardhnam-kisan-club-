# Testing the Farmer App and Kisan Club

**Date:** 2026-08-18
**Purpose:** get the farmer app running against a seeded backend, with the Kisan Club module populated, in about ten minutes.

Everything below has been run end to end on Windows with Docker Desktop and Flutter 3.44.9.

---

## 1. Start the backend

```bash
docker compose up -d
```

```bash
npm install
```

```bash
npm --workspace @vardhnam/marketplace-api run prisma:generate
```

Create `.env` from `.env.example` if you have not already, then **check these four values** — the Club module is invisible without the first, the farmer app cannot log in without the second, and integration tests must never use the development database:

```
KISAN_CLUB_ENABLED=true
AUTH_MODE=production
SMS_PROVIDER=mock
TEST_DATABASE_URL=postgresql://vardhnam:vardhnam_dev_password@localhost:5432/vardhnam_agrotech_test?schema=public
```

`AUTH_MODE=production` is correct here despite the name: it means "real JWT bearer tokens", which is what the mobile app uses. `AUTH_MODE=mock` is only for header-based API testing and the app cannot use it.

The API workspace migration, seed and integration-test scripts automatically load the root `.env`. CI may omit the file and inject the same variables through its environment.

Apply migrations and seed:

```bash
npm --workspace @vardhnam/marketplace-api run prisma:deploy
```

```bash
npm --workspace @vardhnam/marketplace-api run seed
```

```bash
npm --workspace @vardhnam/marketplace-api run seed:demo
```

The demo seed prints every login it created. Keep that output.

Start the API:

```bash
npm run dev:api
```

Start the worker in a second terminal. **Without it, SMS notifications are never sent, advisories are never generated and confirmed refunds remain `PROCESSING`** — the API enqueues but does not consume:

```bash
npm --workspace @vardhnam/marketplace-api run start:worker:dev
```

Confirm it is up:

```bash
curl http://127.0.0.1:3001/api/v1/health
```

### Verify the backend before app testing

Run the backend checks against the dedicated test database:

```bash
npm --workspace @vardhnam/marketplace-api run typecheck
npm --workspace @vardhnam/marketplace-api run lint
npm --workspace @vardhnam/marketplace-api run test -- --runInBand
npm --workspace @vardhnam/marketplace-api run test:integration
```

Verified on 2026-08-19: 46 unit suites / 249 tests and 34 integration suites / 133 tests passed. The compiled API also passed its build; the earlier API/worker OTP smoke remains valid, and the WP-15A demo reseed completed successfully.

---

## 2. Point the app at your machine

The app defaults to `http://127.0.0.1:3001`, which is correct for a desktop or web target but **wrong on an Android emulator**, where `127.0.0.1` is the emulator itself.

| Target                           | Base URL                              |
| -------------------------------- | ------------------------------------- |
| Android emulator                 | `http://10.0.2.2:3001`                |
| Physical phone on the same Wi-Fi | `http://<your-machine-LAN-IP>:3001`   |
| Desktop / Chrome                 | `http://127.0.0.1:3001` (the default) |

```bash
cd apps/farmer-mobile
```

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001
```

To exercise the approved, non-diagnostic Crop Doctor photo-guide shell, add its feature flag:

```bash
flutter run --dart-define=MARKETPLACE_API_BASE_URL=http://10.0.2.2:3001 --dart-define=CROP_DOCTOR_SHELL_ENABLED=true
```

The flag exposes only the entry screen and photo-quality guide. Camera/gallery controls remain disabled, and the active action opens human support; there is no upload or automated diagnosis backend.

For a physical device, find your LAN IP (`ipconfig` on Windows) and use that. The phone must be on the same network, and Windows Firewall must allow inbound connections on port 3001 — that is the usual reason a physical device shows a connection error while the emulator works.

---

## 3. Log in

The demo farmer is **+919000000042**.

1. Enter the phone number.
2. The API returns the OTP in its response because `SMS_PROVIDER=mock`. Read it from the API terminal, or call the endpoint directly:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/auth/farmer/otp/request -H "content-type: application/json" -d "{\"phone\":\"+919000000042\"}"
```

The response contains `mockOtpCode`. **That field disappears the moment a real SMS provider is configured** — it is gated on the provider, not on the environment.

3. Enter the code.

The farmer's language is seeded as Hindi, so the app opens in Hindi. Switch from the language control on the dashboard to check both.

---

## 4. What you can exercise

### Marketplace

Discovery is scoped to pincode **302001**. The **real Vardhnam Agro catalogue** is seeded with pack shots, live offers and stock:

| Product          | Crop    | Pack | Price |
| ---------------- | ------- | ---- | ----- |
| Adiyogi          | Paddy   | 5 kg | ₹560  |
| Aman Plus        | Paddy   | 5 kg | ₹580  |
| Gauri            | Paddy   | 5 kg | ₹540  |
| Basant Gold 9180 | Maize   | 4 kg | ₹850  |
| Chanakya-4590    | Maize   | 4 kg | ₹890  |
| VM Lakshmi-1246  | Mustard | 2 kg | ₹420  |

> **Pack sizes, prices and tax classifications are placeholders.** Product names, crops and images come from the real packaging; the commercial and HSN/GST figures do not, because approved source data was not supplied. Replace them in `vardhnamSkus` in `prisma/seed-demo.ts` and obtain chartered-accountant approval before showing tax invoices outside the team.

A company-owned "Hybrid Bajra Seed" is also seeded — it exists so the MVP acceptance scenario keeps working and to prove the Club catalogue correctly excludes non-Vardhnam products.

Browse → product detail → add to cart → checkout → mock payment → order tracking all work, and the seller of record is the distributor.

### Kisan Club

The demo farmer is already an **ACTIVE member** with:

| Thing             | Seeded value                                              |
| ----------------- | --------------------------------------------------------- |
| Membership        | Active, advisory consent granted                          |
| Assigned promoter | Demo Promoter, territory "Jaipur East"                    |
| Farm              | Rampura North Field, 4.5 acres, tube-well irrigated       |
| Crop cycle        | Wheat HD-2967, sown 40 days ago, Rabi season              |
| Club catalogue    | Vardhnam Wheat Seed HD-2967, 10 kg, ₹420                  |
| Club benefit      | ₹25 off, platform funded                                  |
| Advisory          | Crown-root irrigation, bilingual, matches the seeded crop |

The Club catalogue only ever shows **Vardhnam-owned** products — that is the rule keeping Club benefits platform-funded rather than a discount taken from a third-party company. The other two demo products are company-owned and will never appear there, by design.

### Advisories

Generation runs automatically at 05:30 (`SCHEDULER_TIMEZONE`, default Asia/Kolkata) when the worker is running. To see one immediately, trigger it as operations:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/auth/login -H "content-type: application/json" -d "{\"identifier\":\"operations@example.local\",\"password\":\"Demo@12345\"}"
```

Take `accessToken` from that response and:

```bash
curl -X POST http://127.0.0.1:3001/api/v1/advisory/generate -H "authorization: Bearer <accessToken>"
```

It reports how many it generated. Re-running the same day generates nothing further — event uniqueness covers crop cycle, rule and version.

### Notifications

In-app notifications appear immediately. Five events additionally send SMS — payment succeeded, out for delivery, delivered, cancelled, refund succeeded — picked up by a sweep **within a minute** and delivered by the mock transport, so they land as `SENT` with a `MOCK-` provider reference rather than actually reaching a phone.

---

## 5. Registering a fresh farmer

To test join and profile completion rather than the already-active demo member, register a new phone through the app. Any Indian-format number works; the OTP comes back the same way. A new farmer starts with no membership, so the dashboard shows the join card, then the two-step farm-profile flow.

---

## 6. Known gaps you will notice

These are real and expected, not misconfiguration:

- ~~No product images anywhere.~~ **Fixed 2026-08-18** — the six real pack shots are seeded through the storage layer and render in the product list and detail. Products without photography still show a labelled placeholder.
- **No push notifications.** Device-token registration is not built; a push notification records `NO_DESTINATION` by design.
- **Invoice PDF download is wired in the farmer app.** From Order detail, tap **Prepare invoice PDF**. The API queues the embedded-font PDF and stores it privately. While it is queued or processing, tap **Check PDF status**; when available, **Download invoice PDF** obtains an audited short-lived URL and opens it in the device browser.
- **Credit-note download is wired in the farmer app.** A succeeded inspected-return refund exposes **View credit note** on Return detail. The app shows the backend-issued credit-note number, original invoice, refund and credited-tax values; when the private PDF is available it obtains an audited short-lived URL and opens it in the device browser.
- **GST invoice values are sandbox-only.** The backend now snapshots HSN/rate data, derives place of supply, extracts tax-inclusive CGST/SGST or IGST and allocates seller/FY invoice numbers, but the seeded classifications and rounding policy require chartered-accountant approval before live commerce.
- **Crop Doctor has no diagnosis or upload.** A feature-flagged photo-guide shell is available, but camera/gallery controls stay disabled and route to human support because `PRODUCT_REQUIREMENTS.md` §26 puts automated AI crop diagnosis out of MVP scope.
- **Weather shows "unavailable".** There is no weather provider; the card is honest rather than faked.
- **The core numbered UI alignment is complete.** The design foundation, shared components, persistent five-tab shell, Home, Kisan Club, farm/crop, advisory, marketplace, order, notification and account surfaces are rebuilt. WP-17 remains partial while production asset coverage, broader golden coverage, weather-provider choice and approved legal/privacy destinations remain open.

## 6a. What the home screen shows

Home now summarises what needs attention, in blueprint order: weather (honest "unavailable"), the Kisan Club card, quick actions, **your active crop** with days since sowing, **an order still in flight**, and a short **four-product strip** with real pack shots.

The Home header greets the signed-in farmer by name and shows the default delivery locality and pincode. Tap that location row to open Delivery addresses and change the default address; returning Home refreshes the header. If the profile cannot be loaded, the dashboard remains usable with a generic greeting and location prompt.

Each of the last three hides itself when it has nothing to say. With the demo seed you should see the wheat crop card (sown 40 days ago) and the product strip; the order card appears only once you place an order and disappears again when it is delivered.

## 6b. What changed in navigation

The five tabs — Home, Shop, Kisan Club, Orders, Account — are now always visible and **each keeps its own place**. Open a product under Shop, switch to Orders, come back, and you are still on that product. Tapping the tab you are already on returns it to the top.

Cart, checkout, raising a return, writing a support ticket, joining the Club and completing your farm profile deliberately cover the tab bar while you are in them, so a stray tap cannot abandon a half-finished task. Use the back arrow to leave.

## 6c. What the Kisan Club member dashboard shows

For the seeded active member, the Club tab now starts with the farmer name and membership status, then shows the real active crop and first current approved advisory returned by the API. Crop help opens a human support ticket and explicitly does not claim an automatic diagnosis. Promoter support, Club benefits/products and farm management follow in that order. If no advisory is due, or the advisory API is unavailable, the rest of the Club dashboard remains usable.

For a farmer who has not joined, registration is now four short steps: confirm the profile-backed location, add the farm, search and select an approved crop with its sowing date, then review everything and accept the programme terms. Membership, farm and crop are not written until the final Join action. If membership succeeds but a later farm/crop request fails, the app opens the saved profile-completion route so the farmer can resume without joining twice.

## 6d. What the farm and crop screens show

My Farms uses stacked cards rather than a dense table. Open a farm to see current crops separately from previous crop cycles; add/edit farm, add/edit crop, crop diary and harvest actions continue to use the existing validated APIs.

An active crop shows its authoritative day since sowing. Its crop-health screen filters approved advisory events by the exact crop-cycle ID: guidance due today appears under **Today**, and any server-returned guidance due in the next seven days appears as a simple timeline. The current backend normally publishes advice only when it becomes due, so the future section may honestly say no approved scheduled guidance is available; the app does not generate a plan locally.

## 6e. What advisories and Crop Doctor show

The advisory list highlights new and due-today guidance while retaining the server-authored title, body, crop, date and approval status. Advisory detail leads with the approved action, then the due date, optional source details and a promoter/expert contact action. It does not invent severity, confidence or product recommendations that the API did not return.

With `CROP_DOCTOR_SHELL_ENABLED=true`, Crop Doctor appears from crop help and crop detail. It shows three photo-quality tips and an explicit development state. **Take photo** and **Choose photo** are intentionally disabled; the working action opens a human support ticket. No image is uploaded and no diagnosis is generated.

## 6f. What changed in Shop and cart

Shop keeps the delivery pincode and search at the top, then shows **Shop by crop**, **Shop by category** and **Shop by brand** using only filter values returned by the marketplace API. There is deliberately no “Shop by need” section because no authoritative need taxonomy exists yet. Selecting a chip sends the same backend query fields as before; pagination and exact-query offline cache behaviour are unchanged.

Product cards use real pack shots where available and show backend price, stock and delivery information. In the Club catalogue, **Kisan Club Benefit** appears only when the backend returned a Club programme; the app does not calculate or advertise a fake percentage saving.

Product detail keeps the selected distributor visibly responsible as seller of record and invoice issuer, including its legal name and GSTIN where returned. At narrow width with large text, the price moves below the seller identity so the legal name remains readable. The cart uses the same card language and continues to group items by seller, explaining that each group becomes a separate child order and invoice. All displayed totals remain backend-calculated.

## 6g. What changed in Orders, notifications and Account

Order history now uses horizontally scrollable status chips instead of a dropdown. Each chip still sends the existing backend status query, and each result remains an independently traceable seller child order with its seller, date, status and backend-calculated total. Opening an order exposes its timeline, distributor-issued invoice data and the authorised prepare/status/download PDF flow; checkout splitting and order lifecycle rules did not change.

Notification list and detail now use the same category labels and icons based only on categories returned by the API. The unread-only switch, mark-as-read behavior and related-resource navigation remain unchanged. Related actions are still restricted to the existing allowlist rather than trusting arbitrary notification destinations.

Account now starts with an identity summary, followed by the existing grouped account destinations, editable profile details and saved delivery-address cards. The default-address marker is textual as well as visual. There is deliberately no Legal & Privacy row until approved content and a real destination exist.

## 6h. Visual regression baselines

The lightweight golden suite covers all seven key screens named by the UI blueprint: Home, Kisan Club Join, the active-member Kisan Club Dashboard, Crop Detail, Advisory Detail, Shop and Product Detail. Each is covered in English at a standard phone viewport and in Hindi at 320dp width with 200% text. Shop has discovery, result, loading, empty and retryable-network-error frames. Product Detail has summary, seller/invoice, loading and error frames; Advisory Detail has content, loading and error frames. Detail routes have no empty state because absence is an error response rather than a successful empty collection. Shared error cards stack the retry action at narrow width with large text. All use fixed local data, Flutter's built-in comparator and committed PNG baselines; no new package or external service is involved.

Run the comparison from `apps/farmer-mobile`:

```powershell
flutter test test\golden
```

Only regenerate an approved intentional visual change, then inspect both PNG files before committing them:

```powershell
flutter test --update-goldens test\golden
```

Flutter's deterministic test font makes these baselines suitable for layout, spacing, colour, wrapping and overflow regression checks. Production English and Devanagari font rendering still requires real-device verification.

---

## 7. If something does not work

| Symptom                                  | Cause                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection error on emulator             | Base URL is `127.0.0.1`; use `10.0.2.2`                                                                                                                                            |
| Connection error on a physical device    | Wrong LAN IP, different network, or Windows Firewall blocking port 3001                                                                                                            |
| 404 on every Club screen                 | `KISAN_CLUB_ENABLED` is not `true`                                                                                                                                                 |
| Login rejected with a bearer-token error | `AUTH_MODE=mock`; the app needs `production`                                                                                                                                       |
| No `mockOtpCode` in the response         | `SMS_PROVIDER` is not `mock`                                                                                                                                                       |
| Advisory list stays empty                | Worker not running, or generation not yet triggered                                                                                                                                |
| SMS notifications stay `PENDING`         | Worker not running                                                                                                                                                                 |
| Club catalogue empty                     | Programme points at a non-Vardhnam product                                                                                                                                         |
| Product images missing                   | Seed was run with `STORAGE_PROVIDER` set to something other than `local`, or the API is running from a different working directory than the seed, so `.storage` resolves elsewhere |
