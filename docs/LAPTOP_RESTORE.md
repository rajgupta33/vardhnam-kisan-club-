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
older APKs in `artifacts/` are tracked through Git LFS. On the October 22 recheck,
all four downloaded successfully into the fresh clone, passed `git lfs fsck`,
and matched the original local APKs by SHA-256. The earlier stalled download
is resolved. The clone was also updated to the latest backup documentation.
The private local copies of `.env`, farmer signing key/properties, both internal
test APKs and the user's Android debug keystore were compared with their originals
using SHA-256. No off-device private destination has been supplied or verified.
Docker remained unresponsive after starting Desktop, so PostgreSQL/Redis were
initially not exported or restore-tested. This blocker was resolved in the
subsequent Docker recovery check below.

Windows antivirus blocked reading some files in local `.storage/return_evidence/`
during backup checksum verification. These may be scanner-test fixtures, but that
has not been established for each file. Do not disable antivirus to copy them.
Any manifest entries without a SHA-256 hash are unverified, not successful backups.
On the October 22 recheck, 232 uploaded files matched their local backup copies
by SHA-256. Another 54 files of 68 bytes were deliberately left unverified;
the integration suite contains an EICAR antivirus fixture consistent with this
size, but individual blocked files were not inspected. See the private
`STORAGE-VERIFICATION.json` for the per-file result. The five critical file pairs
and Android debug key also passed the repeat checksum comparison. Docker was
retried after launching Desktop and initially still timed out.

## Successful Docker backup recheck — 2026-10-22

After Docker became available, private exports were created under
`.private-backup/pre-format-2026-10-22/data-export/`:

- `vardhnam_agrotech.dump`, `vardhnam_agrotech_test.dump`, `postgres.dump`:
  PostgreSQL custom-format logical backups.
- `postgres-globals.sql`: PostgreSQL roles/settings; contains private information.
- `redis.rdb`: Redis snapshot, 532 keys, no expiring keys at verification time.
- Per-table count reports and `SHA256-MANIFEST.json` for the export files.

All three database dumps restored with `pg_restore --exit-on-error` into fresh,
network-isolated PostgreSQL 16 containers. Public-table row counts matched the
originals: 85 tables in each app database and zero in `postgres`. The globals
export was saved but not replayed in the restore test (the required `vardhnam`
role was provisioned separately). Redis 7.4.10 validated the RDB checksum and
loaded all 532 keys in a network-isolated verification container. Temporary
verification containers were then removed; original services/data were retained.

These are sequential live snapshots, not an atomic cross-database/Redis snapshot.
New work after export is not included. For final recovery, keep workers stopped
until restored queue jobs and provider configuration have been reviewed.
Restore PostgreSQL dumps into empty databases using PostgreSQL 16's `pg_restore`.
To restore Redis, load `redis.rdb` as `dump.rdb` in a fresh Redis data directory
with append-only persistence initially disabled; confirm the keys load before
enabling AOF. Existing AOF files can take precedence over an RDB file.

The backup is STILL LOCAL and must be copied to verified off-device storage
before formatting.

## FieldForce added to the same private folder

At the user's request, the local `vardhnam-fieldforce` Supabase project was added
under `.private-backup/pre-format-2026-10-22/fieldforce/`. It includes 873 verified
source/configuration files (including pending edits and private environments), a
verified complete Git history bundle, three logical database dumps, role exports,
external PostgreSQL configuration, storage and edge-runtime volume archives, and
private Docker container configuration. Four linked worktrees were clean and their
commits are included in the history bundle.

The logical globals replay encountered a role-grant ordering error, so a complete
cold database-volume backup was also taken with the original database briefly
stopped and subsequently restarted. That cluster started successfully in isolation
using the matching Supabase PostgreSQL 17 image. All three databases were readable;
113 main database tables and one vector table matched live counts. The 39 analytics
tables were readable but live counts had changed after capture. This tested cold
archive is the preferred FieldForce database recovery path. Recovery instructions
and a SHA-256 manifest are inside the private FieldForce folder (899 files, about
180.4 MiB before its manifest). No private exports were committed to GitHub.

This covers local Docker data, not separately hosted cloud databases. Upload the
entire `pre-format-2026-10-22` folder once, confirm the upload/download integrity,
and retain it before uninstalling Docker or formatting the laptop. The 54 possible
antivirus-test files in the agriculture app remain unverified as described above.

Preserving a working tree does not certify that every app builds. Existing farmer
iOS project settings include `ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS
= AppIcon`; this existing change is preserved and needs review on a Mac.
External hosting configuration, remote database contents, account credentials,
editor settings and files outside this repository are not backed up by Git.
Check the backup task's final report for which exports and restore checks actually ran.
