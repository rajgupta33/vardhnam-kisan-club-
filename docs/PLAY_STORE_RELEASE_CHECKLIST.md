# Farmer App Play Store Release Checklist

This checklist covers the Farmer Android app. Completing it does not authorise a production deployment, real messages, real payments or a Play Console release.

## 1. Source and release ownership

- Commit, review and push the complete working tree before producing a release candidate.
- Protect the release branch and require the Node and Flutter CI jobs.
- Confirm that `com.vardhnam.agrotech.farmer` is the approved permanent application ID.
- Confirm the Play Console developer account and legal developer name.

## 2. Signing and bundle

- Create the Farmer Play upload key outside the repository and store it in the approved secret manager.
- Copy `apps/farmer-mobile/android/key.properties.example` to `key.properties` locally and replace every placeholder.
- Never commit `key.properties`, `.jks`, `.keystore`, passwords or certificates.
- Enrol the app in Play App Signing and securely back up the upload-key recovery material.
- Set an approved version name and monotonically increasing version code in `pubspec.yaml`.
- Build the release candidate with the approved HTTPS API URL:

  ```powershell
  flutter build appbundle --release `
    --dart-define=MARKETPLACE_API_BASE_URL=https://api.example.invalid `
    --dart-define=FARMER_PRIVACY_POLICY_URL=https://www.your-approved-domain.example/privacy `
    --dart-define=FARMER_TERMS_URL=https://www.your-approved-domain.example/terms `
    --dart-define=FARMER_ACCOUNT_DELETION_URL=https://www.your-approved-domain.example/delete-account
  ```

  Every URL above is a deliberately invalid placeholder. Replace all four with
  approved production values.

- Inspect and test the generated `build/app/outputs/bundle/release/app-release.aab`; do not upload a debug APK as a production release.

## 3. Production services

- Deploy the API, worker and migrator with production PostgreSQL and Redis.
- Configure TLS, secret management, monitoring, alerting, backups and a restore drill.
- Replace mock SMS, payment/refund, storage and virus-scanning providers before processing real data or money.
- Verify OTP throttling, webhook signatures, idempotency, signed document downloads and background-job recovery.

## 4. Legal and Play policy

- Publish approved Terms and Privacy Policy pages at public, stable HTTPS URLs. The bilingual Account entries are implemented; supply their release build values and verify them.
- Implement and verify the required user-account deletion request and data-deletion workflow. The bilingual Account entry is implemented, but its URL must lead to the real public workflow before release.
- Complete Play Console Data safety, ads, target audience, content rating and app-access declarations.
- Obtain chartered-accountant approval for GST classifications, rounding and invoice/credit-note templates.
- Replace placeholder return-window, commission and support-SLA values with approved values.

## 5. Store listing and review access

- Prepare the app name, short/full descriptions, icon, feature graphic, phone screenshots and Hindi/English listing copy.
- Provide a monitored support email/website and reviewer instructions for OTP-protected functionality.
- Confirm country availability, pricing and whether the launch is staged.

## 6. Release validation

- Run Flutter formatting, analysis and tests on the exact release commit.
- Test the Play-delivered build on representative low-, mid- and high-tier Android devices and slow networks.
- Exercise registration, login, profile, marketplace, checkout, payment, orders, invoice download, returns, support and account deletion against the release environment.
- Complete internal testing, then the required closed testing period for the developer account.
- Resolve all blocker/high-severity findings before a staged production rollout.
- Monitor crashes, API errors, queues, payment reconciliation and support contacts throughout rollout.
