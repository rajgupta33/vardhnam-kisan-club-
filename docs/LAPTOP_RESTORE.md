# Laptop backup and restoration

Audit date: 2026-10-22. This is a recovery snapshot, not a release certification.

## GitHub source backup

Repository: https://github.com/rajgupta33/vardhnam-kisan-club-

Use branch `backup/pre-format-2026-10-22` for the pre-format snapshot. It includes
the previously uncommitted farmer launcher icons/configuration, both Gradle
wrappers, and both Flutter dependency lockfiles. The existing `master` branch is
left unchanged. Dockerfiles, Compose configuration, migrations, npm lockfile,
OpenAPI contract, application assets, source, tests and documentation belong in Git.

This does not back up installed programs, secrets, databases or uploaded files.
Do not format until the private backup below exists on another physical device
or in confirmed cloud storage and has been verified there.

## Private backup required before formatting

Keep these outside Git, in encrypted storage with recovery access independent
of this laptop. A private GitHub repository is not a secret vault.

| Item | Original location / action |
| --- | --- |
| Environment settings | Root `.env`, and any additional deployment environment settings in the hosting provider |
| Farmer upload signing key | `apps/farmer-mobile/android/upload-keystore.jks` and `android/key.properties`; preserve passwords and alias |
| Partner debug signing identity | `%USERPROFILE%/.android/debug.keystore`; partner release currently uses debug signing |
| Uploaded objects | `apps/marketplace-api/.storage/` (286 files, 9,371,655 bytes observed); also preserve any configured external storage root |
| PostgreSQL | Export local database with `pg_dump -Fc`; source migrations do not contain existing records |
| Redis | Preserve queues/persistence if pending work matters; do not replay old jobs against live providers without review |
| Existing test installers | `artifacts/internal-testing/` contains farmer and partner APKs, each over GitHub's normal 100 MB file limit |
| Account recovery | Ensure independent access to GitHub, hosting, Play Console and any provider accounts; retain 2FA recovery codes securely |

Docker was initially unavailable. Its local data disk exists at
`%LOCALAPPDATA%/Docker/wsl/disk/docker_data.vhdx` (about 31.4 GB).
Existence of this disk is NOT proof of a usable database backup. Do not copy a
live database disk as your only backup. Prefer logical database exports and a
tested restore. Do not run `docker compose down -v` during recovery.

If a `.private-backup/` folder exists, it is a local staging area only, deliberately
ignored by Git. It does not survive formatting unless copied elsewhere.

## Reinstallable tools

Observed local paths are informational; they need not remain identical:

- Flutter **3.44.9**, Dart **3.12.2**, formerly `D:/development/flutter`.
- JDK 17, formerly `D:/development/jdk-17`.
- Android SDK, formerly `D:/Android/Sdk`; installed platforms 35, 36 and 37.0,
  build-tools 36.0.0, NDK 28.2.13676358.
- Gradle **9.1.0**, selected by committed wrapper properties. The wrappers
  download Gradle; no global Gradle installation or cache backup is required.
- Node **22.13.0** is the CI baseline; use at least the repository's declared
  minimum. Local Node was 22.12.0, below that minimum.
- npm 10 or newer, Git with Git LFS, Docker Desktop with WSL2, Android Studio/SDK tools.
- PostgreSQL 16 Alpine and Redis 7 Alpine are declared in Compose.
- iOS builds require macOS and Xcode; Windows cannot validate iOS release builds.

`node_modules`, `.dart_tool`, `.gradle`, build outputs, Docker images and SDK
caches are regenerable with internet access. They are intentionally not in Git.
`local.properties` contains machine-specific SDK paths and must be recreated.

## Restore source and dependencies (PowerShell)

```powershell
git lfs install
git clone --branch backup/pre-format-2026-10-22 https://github.com/rajgupta33/vardhnam-kisan-club-.git
Set-Location vardhnam-kisan-club-
git lfs pull
git status --short
npm ci
npm run prisma:generate
```

Restore the private `.env`, key and signing properties to their original relative
locations. Correct absolute paths inside signing properties for the new laptop.
For a completely new local environment, copy `.env.example` to `.env` and supply
local values instead. Never overwrite the only copy of the old `.env`.

```powershell
docker compose up -d postgres redis
npm --workspace @vardhnam/marketplace-api run prisma:deploy
```

For existing data recovery, restore the dump to a **new empty database first**,
restore its matching uploaded objects, then apply newer migrations if needed.
Do not seed over a restored database as part of recovery. For a fresh demo only:

```powershell
npm run seed
npm run seed:demo
```

In separate terminals start `npm run dev:api`, `npm run dev:web`, and
`npm --workspace @vardhnam/marketplace-api run start:worker:dev`.
Keep real SMS/payment/email providers disabled during recovery verification.

For each mobile app:

```powershell
Set-Location apps/farmer-mobile
flutter doctor -v
flutter pub get
flutter gen-l10n
flutter analyze
flutter test
flutter build apk --debug
Set-Location ../partner-mobile
flutter pub get
flutter gen-l10n
flutter analyze
flutter test
flutter build apk --debug
```

Run from the repository root: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run check:openapi`, `npm run check:api-client`, and `npm run test:scaffold`.
Integration tests must use a separate test database: they erase test tables.
See README.md and docs/FARMER_APP_TESTING_GUIDE.md for runtime settings.

## Limits of this snapshot

The source snapshot `c44524c` was pushed and cloned back from GitHub. Seventeen
scaffold tests and both apps' translation-key parity checks passed. This backup
task did not run the complete application lint/typecheck/build/test suites.
The fresh clone passed `git fsck --full`; Docker/lockfile text matched after
normalizing Git line endings and both Gradle wrapper JAR hashes matched. Four
older APKs in `artifacts/` are tracked through Git LFS. `git lfs push --all`
succeeded, but their fresh-download verification stalled and was cancelled;
their remote download recovery remains unverified.
The private local copies of `.env`, farmer signing key/properties, both internal
test APKs and the user's Android debug keystore were compared with their originals
using SHA-256. No off-device private destination has been supplied or verified.
Docker remained unresponsive after starting Desktop, so PostgreSQL/Redis were
not exported or restore-tested.

Windows antivirus blocked reading some files in local `.storage/return_evidence/`
during backup checksum verification. These may be scanner-test fixtures, but that
has not been established for each file. Do not disable antivirus to copy them.
Any manifest entries without a SHA-256 hash are unverified, not successful backups.

Preserving a working tree does not certify that every app builds. Existing farmer
iOS project settings include `ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS
= AppIcon`; this existing change is preserved and needs review on a Mac.
External hosting configuration, remote database contents, account credentials,
editor settings and files outside this repository are not backed up by Git.
Check the backup task's final report for which exports and restore checks actually ran.
