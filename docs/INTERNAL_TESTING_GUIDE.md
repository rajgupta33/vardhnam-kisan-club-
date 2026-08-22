# Internal Testing Guide: Farmer App, Partner App, and Business Portal

**Environment:** Railway project `creative-insight`, environment `production`

**Use:** internal testing with demo data only

**Last verified:** 2026-08-21

This document is the shared runbook for testing the complete Vardhnam marketplace across the farmer app, partner app, and business portal. Although the Railway environment is named `production`, it is an **internal test environment**. Do not enter real farmer data, bank details, KYC documents, payment credentials, or other personal information.

## 1. Live environment

| Component | Address | Expected state |
| --- | --- | --- |
| Business portal | <https://business-web-production-5714.up.railway.app> | Login page opens |
| Marketplace API | <https://marketplace-api-production-70ac.up.railway.app> | Online |
| API liveness | <https://marketplace-api-production-70ac.up.railway.app/api/v1/health> | HTTP 200 |
| API readiness | <https://marketplace-api-production-70ac.up.railway.app/api/v1/health/ready> | HTTP 200; database, Redis, and queues ready |
| PostgreSQL | Railway private service | Online |
| Redis | Railway private service | Online |

The two mobile apps must be launched with the live API address shown above. A phone or emulator does not need `10.0.2.2` when it uses this HTTPS Railway address.

## 2. Test accounts and data

### Business portal accounts

All seeded portal accounts use the internal demo password `Demo@12345`.

| Role | Email | Main areas to test |
| --- | --- | --- |
| Super administrator | `admin@example.local` | Full navigation, users, organisations, jobs, audit |
| Operations manager | `operations@example.local` | Orders, fulfilment, returns, support |
| Catalogue reviewer | `catalogue@example.local` | Catalogue review and approval controls |
| Finance manager | `finance@example.local` | Finance, settlements, payouts, Tally |
| Company owner | `company@example.local` | Own company catalogue and related records |
| Distributor owner | `distributor@example.local` | Own offers, inventory, orders, invoices |
| Distributor staff | `distributor-staff@example.local` | Restricted distributor operations |

These credentials are only for this seeded internal environment. Do not reuse the password anywhere else.

### Mobile accounts

The Railway environment currently uses the mock SMS provider. After requesting an OTP, the app displays a clearly labelled mock OTP. Use it immediately because the code expires.

| App/role | Phone |
| --- | --- |
| Farmer app — seeded farmer | `+919000000042` |
| Partner app — promoter | `+919000000051` |
| Partner app — delivery partner | `+919000000032` |

### Seeded marketplace data

- Primary test pincode: `302001`
- Other serviceable pincodes: `302002`, `302012`
- Seven approved products and eight distributor offers are seeded.
- Kisan Club membership: `KC-DEMO-0001`
- Club territory: Jaipur East
- Seeded farm: Rampura North Field, 4.5 acres, wheat
- Seeded club benefit: Rs 25, platform-funded

Use new fictional phone numbers only when testing farmer self-registration. Never use a real person's number or details.

## 3. Before each test session

1. Open the API readiness URL. Continue only if it returns a successful response.
2. Open the business portal in an incognito/private window and confirm the login screen loads.
3. If a previously saved login suddenly returns `401`, sign out or clear the app/browser session and log in again. A JWT secret rotation intentionally invalidated older tokens.
4. Record the tester name, date, platform, app build/commit, device/browser, and start time.
5. Use a separate browser profile for each business role to avoid mixing sessions.
6. Do not run the seed again during an active shared test session; seeding can reset or overwrite demo records.

## 4. Prepare the mobile test devices

Run these checks once from PowerShell:

```powershell
flutter doctor -v
flutter devices
```

The device should appear in `flutter devices`. Enable USB debugging for a physical Android phone, or start an Android emulator. Internet access to `*.up.railway.app` is required.

For repeatable results, record:

- Android version and device model
- Flutter version
- Wi-Fi or mobile network
- English or Hindi locale
- Any accessibility settings, especially large text

## 5. Farmer app

### 5.1 Run the app against Railway

```powershell
Set-Location "E:\vardhnam ad images\vardhnam agro app\apps\farmer-mobile"
flutter pub get
flutter run -d <device-id> --dart-define=MARKETPLACE_API_BASE_URL=https://marketplace-api-production-70ac.up.railway.app --dart-define=CROP_DOCTOR_SHELL_ENABLED=true
```

Replace `<device-id>` with a value from `flutter devices`.

To create an installable internal debug APK:

```powershell
flutter build apk --debug --dart-define=MARKETPLACE_API_BASE_URL=https://marketplace-api-production-70ac.up.railway.app --dart-define=CROP_DOCTOR_SHELL_ENABLED=true
```

The APK is normally created at `build\app\outputs\flutter-apk\app-debug.apk`. Share it only with authorised internal testers.

### 5.2 Farmer login and basic navigation

1. Launch the app and select English.
2. Enter `+919000000042` and request an OTP.
3. Confirm a clearly labelled mock OTP appears.
4. Enter that OTP and confirm login succeeds.
5. Close and reopen the app; confirm the secure session is restored.
6. Change the language to Hindi and confirm the main navigation and important actions are translated.
7. Switch back to English if the tester cannot review Hindi accurately.
8. Sign out and confirm protected pages cannot be reopened with the Back button.

Expected result: the farmer sees only farmer functions; no promoter, delivery, finance, catalogue-review, or administrator functions are visible.

### 5.3 Marketplace and product discovery

1. Set or select an address using pincode `302001`.
2. Open the marketplace and confirm products load.
3. Search for a product and use any available category/filter controls.
4. Open a product detail page.
5. Confirm the product shows seller/distributor information, price, availability, delivery information, and offer details.
6. Compare multiple offers if the product has them.
7. Try an unsupported pincode and confirm the app gives a useful unserviceable message rather than silently accepting it.

Expected result: the agriculture company is shown as brand/catalogue owner where relevant, while the selected distributor is the seller for the order.

### 5.4 Cart, checkout, and order creation

1. Add one in-stock offer to the cart.
2. Change quantity and confirm the backend-calculated totals update.
3. Add an offer from another distributor when available.
4. Confirm the checkout clearly shows delivery address, seller, item totals, fees/discounts, and final total.
5. If the club benefit is applicable, confirm it appears as a separate benefit and is not silently merged into the product price.
6. Place the order once. Do not repeatedly tap the final button.
7. Record the parent order number and every child order number.
8. Confirm items supplied by different distributors become separate child orders.
9. Open order details and confirm each child order has one seller and its own fulfilment status.
10. Confirm the same order appears in the business portal under Orders.

Expected result: totals come from the backend, one checkout is not duplicated, and seller/order separation follows the marketplace rules.

### 5.5 Orders, invoice, returns, and support

1. Open the order history and the newly created order.
2. Confirm the status timeline, seller information, delivery address, and line items are correct.
3. After the portal moves an eligible order forward, refresh the app and confirm the new status appears.
4. When an invoice exists, open or download it and verify the distributor legal identity is the seller—not Vardhnam or the brand owner by default.
5. For an eligible delivered order, start a return request with a fictional reason; do not submit duplicate requests.
6. Open Support and create a low-priority test ticket whose subject starts with `[INTERNAL TEST]`.
7. Confirm the ticket appears in the business portal and any reply becomes visible in the app.
8. Check notifications and mark one as read, if present.

### 5.6 Kisan Club, farms, and advisories

1. Open Kisan Club and confirm membership `KC-DEMO-0001` is active.
2. Confirm the assigned promoter and Jaipur East territory are visible where designed.
3. Open Rampura North Field and verify the seeded acreage and wheat crop.
4. Open the seeded advisory and mark it read if the action is available.
5. Confirm the Rs 25 club benefit is displayed separately from product price and commission.
6. Open Crop Doctor.
7. Confirm it is explicitly a development shell: photo guidance is visible, capture/upload actions are disabled, and the working route is human support.

Do not treat Crop Doctor as an agronomy diagnosis feature; it must not produce pesticide or crop-treatment recommendations.

### 5.7 New farmer registration

Use this only after the seeded-account tests pass.

1. Sign out and choose farmer registration rather than login.
2. Enter a reserved fictional Indian phone number not used by another tester.
3. Request and enter the displayed mock registration OTP.
4. Enter fictional name, preferred language, and test address.
5. Confirm registration completes and the new farmer session opens.
6. Sign out and log in again with the same fictional number.
7. Confirm the new account cannot see another farmer's orders, farms, addresses, tickets, or club membership.

Record the fictional number in the session report so other testers do not reuse it.

## 6. Partner app

### 6.1 Run the app against Railway

```powershell
Set-Location "E:\vardhnam ad images\vardhnam agro app\apps\partner-mobile"
flutter pub get
flutter run -d <device-id> --dart-define=MARKETPLACE_API_BASE_URL=https://marketplace-api-production-70ac.up.railway.app
```

To create an internal debug APK:

```powershell
flutter build apk --debug --dart-define=MARKETPLACE_API_BASE_URL=https://marketplace-api-production-70ac.up.railway.app
```

### 6.2 Promoter role

1. Log in with `+919000000051` and the displayed mock OTP.
2. Confirm the role is Promoter and promoter navigation loads.
3. Confirm delivery-only screens, delivery earnings, and delivery assignment controls are absent.
4. Review assigned territory, farmer leads, visits, Kisan Club members, surveys, fulfilment support, earnings, and payout areas that are available to this seeded role.
5. Open the seeded club member and confirm the displayed farmer/territory data is consistent with the farmer app and portal.
6. Add a clearly labelled fictional lead or visit note if the UI permits it.
7. Test assisted farmer onboarding using a reserved fictional number; use the displayed mock OTP only in this internal environment.
8. If assisted ordering is available, create an order for the fictional/seeded farmer and record the order number.
9. Confirm the order remains a farmer-to-distributor transaction and promoter attribution is separate.
10. Confirm earnings are not finalised merely because an order was placed; they should follow delivery and commission rules.

### 6.3 Delivery partner role

1. Sign out completely.
2. Log in with `+919000000032` and the displayed mock OTP.
3. Confirm the role is Delivery Partner.
4. Confirm promoter leads, promoter commission, club surveys, and assisted farmer controls are absent.
5. Set availability online if the app provides the control.
6. Ask an operations tester to assign a ready-for-pickup order in the portal.
7. Refresh assignments and open the assigned delivery.
8. Verify pickup address, seller/distributor, delivery address, items, and contact data shown for the assignment.
9. Accept the assignment, start pickup/out-for-delivery steps, and verify the status in both the farmer app and portal after each transition.
10. Complete delivery using the one-time mock delivery OTP shown to the authorised operations flow in mock mode.
11. Test one controlled failure path on a separate order, such as customer unavailable, and record the retry state.
12. Test a return pickup only when the portal has created an eligible return assignment.
13. Confirm completed delivery earnings/payout data is separated from promoter commission.

Never paste delivery OTPs into the defect report. Record only whether the OTP flow passed or failed.

## 7. Business portal

Open <https://business-web-production-5714.up.railway.app> in a desktop browser. Test Chrome or Edge first, then one secondary browser. Use private windows or different browser profiles for simultaneous roles.

### 7.1 Authentication and permission isolation

For every seeded account:

1. Log in with the email and `Demo@12345`.
2. Confirm the dashboard loads without an error.
3. Record the visible navigation items.
4. Confirm pages outside the role's permission set are hidden.
5. Try one known restricted URL copied from an administrator session.
6. Confirm the server rejects access; hiding a menu alone is not sufficient.
7. Sign out and confirm browser Back does not reveal protected data.

### 7.2 Super administrator

Using `admin@example.local`:

1. Review dashboard counts and operational action lists.
2. Open Organisations and Users; verify seeded roles and memberships.
3. Confirm role and organisation boundaries are visible and no raw password or secret is shown.
4. Review Jobs and Audit.
5. Confirm important changes made during testing produce append-only audit records with actor, action, resource, and time.
6. Avoid deleting seeded organisations, users, financial records, invoices, settlements, or audit entries.

### 7.3 Catalogue reviewer and company owner

Using `company@example.local` and `catalogue@example.local` in separate sessions:

1. As the company owner, open the company's catalogue and review or submit an eligible draft listing if available.
2. Confirm the company user cannot approve its own listing unless explicitly authorised.
3. As catalogue reviewer, open the review queue and inspect product data.
4. Approve or reject only an item created for this test and enter a clear reason.
5. Confirm the company session sees the updated state after refresh.
6. Confirm an approved master product does not automatically become sellable without a distributor offer.
7. Review the audit log for submission, approval/rejection, and product changes.

### 7.4 Distributor owner and staff

Using the distributor accounts:

1. Review warehouses, batches, inventory, offers, orders, and invoices belonging to the seeded distributor.
2. Create or edit only a clearly labelled test offer against an approved product.
3. Confirm selling price, quantity, batch, expiry/validity, warehouse, serviceable pincodes, delivery SLA, and fulfilment mode are captured where applicable.
4. Confirm expired or blocked inventory cannot be allocated.
5. Make a small test stock adjustment and verify an inventory movement and audit record are created.
6. Confirm distributor staff has less access than the owner where permissions differ.
7. Attempt to access another organisation's resource through a copied URL or identifier and confirm access is denied.

### 7.5 Operations, order, and delivery workflow

Using `operations@example.local`:

1. Find the order created in the farmer app.
2. Confirm parent/child order structure, farmer, seller, item, amount, attribution, and address are correct.
3. Move the order only through actions offered by the UI; do not invent or skip statuses.
4. Prepare/confirm fulfilment and dispatch records as required.
5. Move the child order to ready for pickup.
6. Assign it to the seeded online delivery partner.
7. Record the one-time mock delivery OTP securely for the immediate internal test, then discard it.
8. Follow the status changes from the partner app.
9. Confirm every transition records actor, timestamp, and reason where required.
10. After delivery, confirm invoice/finance/commission effects appear only at the correct lifecycle point.
11. Process the `[INTERNAL TEST]` support ticket and confirm the farmer sees the reply.
12. Test a return/dispute only on a dedicated test order and do not delete the resulting history.

### 7.6 Finance manager

Using `finance@example.local`:

1. Review finance, settlements, commissions, delivery payouts, refunds, and Tally areas.
2. Confirm farmer payment, distributor payable, marketplace commission, fulfilment fee, delivery fee, promoter commission, tax, refund, and adjustment are separate entries where applicable.
3. Confirm monetary amounts use the order's backend values and reconcile to the order total.
4. Confirm promoter commission is not final before successful delivery and the applicable return/dispute window.
5. Confirm delivery earnings depend on completed delivery and approved rules.
6. Do not release a real settlement, send real money, or connect/modify real Tally data.
7. Export only demo data if authorised; confirm sensitive exports are permission-controlled and audited.

## 8. Complete three-platform acceptance scenario

Use this scenario after each platform passes its individual smoke test.

| Step | Platform/role | Action | Evidence to record |
| --- | --- | --- | --- |
| 1 | Farmer app | Log in as seeded farmer and select pincode `302001` | Screenshot of marketplace |
| 2 | Farmer app | Add an in-stock offer and place one order | Parent and child order numbers |
| 3 | Business portal / Operations | Find the order and confirm seller, items, totals, address, and attribution | Order screenshot |
| 4 | Business portal / Distributor | Confirm/reserve stock and prepare fulfilment using available actions | Status and batch/warehouse |
| 5 | Business portal / Operations | Move to ready for pickup and assign the seeded delivery partner | Assignment ID; never record OTP |
| 6 | Partner app / Delivery | Accept, pick up, start delivery, and complete with the immediate mock OTP | Status screenshots |
| 7 | Farmer app | Refresh and confirm delivered state and invoice access | Delivered order screenshot |
| 8 | Business portal / Finance | Verify separate ledger/commission/payout effects | Record IDs and amounts, no secrets |
| 9 | Farmer app and portal | Create and answer an `[INTERNAL TEST]` support ticket | Ticket number |
| 10 | Business portal / Admin | Review audit records for the workflow | Audit event IDs |

Pass only if the same order identity and consistent status are visible across all three platforms, permissions remain role-correct, and financial/seller data follows the business rules.

### 8.1 Kisan Club promoter fulfilment scenario

The scenario above uses an ordinary marketplace product, which by design never
reaches a promoter. Run this second scenario to exercise the promoter's order
surface. **A Club order is the only thing that puts an order on the promoter's
fulfilment screen**, so a session that only places ordinary orders proves
nothing about the promoter app.

An order becomes a Club order only when the item is covered by an active Kisan
Club programme. In the seeded environment that is the Vardhnam **Adiyogi**
paddy seed, 5 kg pack, at pincode `302001`. If the checkout does not show the
Rs 25 club benefit as a separate line, the order is not a Club order and the
rest of this scenario will not produce anything.

| Step | Platform/role | Action | Evidence to record |
| --- | --- | --- | --- |
| 1 | Farmer app | Open Kisan Club and confirm membership `KC-DEMO-0001` is active | Membership screenshot |
| 2 | Farmer app | Open the Club catalogue and add the Adiyogi 5 kg pack to the cart | Cart screenshot |
| 3 | Farmer app | Confirm the checkout shows the Rs 25 club benefit as a separate line | Checkout screenshot |
| 4 | Farmer app | Place the order and complete the mock payment | Order number |
| 5 | Partner app / Promoter | Refresh the fulfilment screen and confirm the new assignment appears | Assignment screenshot |
| 6 | Partner app / Promoter | Accept the assignment, then move it through product ready and farmer contacted | Status screenshots |
| 7 | Business portal / Operations | Confirm the same order and its promoter assignment are visible | Order screenshot |
| 8 | Partner app / Promoter | Complete the assignment and confirm the farmer app reflects the outcome | Status screenshots |

The assignment is created at the moment the payment succeeds, not when the
order row is created. An order that was already confirmed before a promoter
became eligible is **not** assigned retroactively; place a new Club order to
retest.

If step 5 shows nothing, the promoter is failing an eligibility rule rather
than hitting a UI bug. All of the following must hold, and the API logs a
warning naming the reason when they do not:

- The farmer's Club membership is `ACTIVE` and has an `ACTIVE` promoter assignment.
- The promoter user is `ACTIVE` and their Club profile has `clubEnabled` set.
- The promoter's organisation is `ACTIVE` **and** holds an approved, unexpired KYC document.
- The promoter holds an `ACTIVE` membership with role `PROMOTER` or `SALES_PARTNER` **in that same organisation** — not in the farmer login context organisation.

The last two are the ones that have actually failed in this environment. The
same rules gate automatic promoter matching, so a promoter who fails them also
shows an unassigned territory on the partner app.

## 9. Defect reporting

Create one defect per problem. Do not combine unrelated failures.

| Field | What to record |
| --- | --- |
| Title | Platform + role + short failure, e.g. `Farmer app / checkout / duplicate order after one tap` |
| Environment | Railway internal test (`production`-named) |
| Build | Git commit, APK date, or portal deployment time |
| Account role | Role only; phone/email may use the seeded identifier |
| Preconditions | Pincode, order state, product/offer, device/browser |
| Steps | Short numbered reproduction steps |
| Expected | The correct business or UX result |
| Actual | What happened, including exact visible error text |
| Evidence | Screenshot/screen recording and safe IDs |
| Time | Local time with timezone |
| Severity | Use the definitions below |

Severity:

- **S1 — Blocker:** security/privacy exposure, cross-organisation access, incorrect seller/financial record, data loss, or all testers unable to use a core platform.
- **S2 — High:** login, checkout, order, fulfilment, delivery, permissions, or finance flow cannot complete and no safe workaround exists.
- **S3 — Medium:** a non-critical feature fails or a safe workaround exists.
- **S4 — Low:** text, spacing, translation, minor visual, or usability issue.

Do not include JWTs, OTPs, database URLs, Redis URLs, cookies, full request headers, private keys, or real personal data in screenshots or reports.

## 10. Known limitations in this Railway internal environment

These are known test-environment gaps, not approval for production use:

1. **No background worker service is deployed.** Queue-backed notification delivery, scheduled advisories, some PDF/refund recovery work, and similar jobs may remain pending. Test synchronous API/UI state separately and label blocked worker-dependent cases.
2. **Seeded product images are bundled only for internal testing.** They survive Railway container redeployment, but new uploads still require durable object storage before a real pilot.
3. **Direct marketplace orders are not promoter-visible.** A promoter sees only Club coordination assigned to that promoter or an explicitly assisted/attributed workflow. Unrelated farmer order history remains private. This is the expected behaviour, not a defect: to see anything on the promoter fulfilment screen, place a Kisan Club order as described in section 8.1.
4. **SMS is mocked.** OTPs are displayed in the app for internal testing. This configuration is forbidden for a real pilot or production release.
5. **Payments and external integrations may be mock/placeholder implementations.** Never use real cards, bank accounts, GST/Tally data, SMS, email, or WhatsApp recipients.
6. **Crop Doctor is intentionally a shell.** Photo actions and diagnosis are not implemented; human support is the valid action.
7. **Commercial configuration values may still be placeholders.** Do not treat test commission/tax/return-window values as approved business policy.
8. **Only seeded roles can be exercised immediately.** Service-provider and sales-partner scenarios may need separately approved demo users/data.

## 11. Daily completion checklist

At the end of each test session:

- Confirm the API and portal remain online.
- Record all new order, ticket, return, and assignment IDs created by the session.
- Mark each planned test Pass, Fail, Blocked, or Not Run.
- Link every Fail to a defect.
- Explain every Blocked case, especially worker/image/mock-integration limitations.
- Sign out of all browser and mobile sessions.
- Do not delete financial, invoice, inventory-movement, order-history, or audit records to “clean up.”
- Share a short summary: platforms tested, pass/fail totals, blockers, and the next retest owner.

The first testing sequence should be: business portal login/permissions, farmer app login and marketplace, partner app role isolation, then the complete three-platform order scenario.
