# Vardhnam Kisan Club — Technical Implementation Plan

**Status:** In phased implementation; KC-01 completed, KC-02 registry implemented, KC-03 backend implemented, KC-04 implemented, KC-05 backend implemented, KC-06 backend and dedicated-database coverage completed, KC-07 backend implemented, KC-08 farmer module completed and Flutter-verified, KC-09 advisory vertical slice completed and dedicated-database verified, KC-10 partner mobile completed through assigned-farmer/redemption, fulfilment-coordination, farm-survey and earnings-statement slices, KC-11 business portal completed, KC-12 aggregate intelligence completed
**Date:** 2026-08-11
**Scope:** Kisan Club as a scoped layer inside the existing Vardhnam platform — no new application, no new marketplace, no parallel money ledger.
**Reads with:** `AGENTS.md` (binding engineering and business rules), `docs/BUSINESS_RULES.md`, `docs/HANDOVER.md`, `docs/REMAINING_IMPLEMENTATION_PLAN.md`.

---

## Contents

1. [What this document is](#1-what-this-document-is)
2. [Current-state assessment: what Kisan Club can reuse](#2-current-state-assessment-what-kisan-club-can-reuse)
3. [Binding constraints that shape the design](#3-binding-constraints-that-shape-the-design)
4. [Architectural decisions](#4-architectural-decisions)
5. [Data model](#5-data-model)
6. [Backend modules and endpoints](#6-backend-modules-and-endpoints)
7. [Club pricing and finance — the deep dive](#7-club-pricing-and-finance--the-deep-dive)
8. [Promoter assignment engine](#8-promoter-assignment-engine)
9. [Club order flows — Mode A and Mode B](#9-club-order-flows--mode-a-and-mode-b)
10. [Advisory engine](#10-advisory-engine)
11. [Farmer mobile app](#11-farmer-mobile-app)
12. [Partner mobile app](#12-partner-mobile-app)
13. [Business portal](#13-business-portal)
14. [Permissions matrix additions](#14-permissions-matrix-additions)
15. [Notifications](#15-notifications)
16. [Testing plan](#16-testing-plan)
17. [Work packages KC-01 … KC-12](#17-work-packages-kc-01--kc-12)
18. [Risks and decisions needing business sign-off](#18-risks-and-decisions-needing-business-sign-off)
19. [Explicitly out of scope for the Club MVP](#19-explicitly-out-of-scope-for-the-club-mvp)

---

## 1. What this document is

Kisan Club is a **free** membership programme. There is no membership fee, no subscription, no revenue from membership itself. Nothing in this plan models a payment for joining, a tier price, or a billing cycle. The commercial return is entirely indirect: more Vardhnam product sold, better farm data, stronger promoter network.

The single most important design principle in this plan:

> **Kisan Club is a filter, a benefit layer and a relationship layer placed on top of the existing marketplace. It is not a second marketplace.**

Concretely that means Club orders flow through the _same_ `Cart` → `ProductCheckout` → `ProductOrder` → `ProductInvoice` → fulfilment → `CommissionEntry` machinery that already exists and is covered by ~21 integration specs. A Club order is an ordinary product order that additionally carries a benefit, a programme reference and a promoter assignment. If a Club feature ever requires forking that pipeline, that is a signal the feature is wrong, not that the pipeline is wrong.

---

## 2. Current-state assessment: what Kisan Club can reuse

I inspected the repository rather than relying on `docs/HANDOVER.md`, which is now stale in places (it reports the farmer app at ~35% and returns as unbuilt; both have moved on).

### 2.1 Backend modules that already exist

`apps/marketplace-api/src/` currently contains: `access`, `audit`, `auth`, `cart`, `catalogue`, `checkout`, `common`, `config`, `dashboards`, `farmers`, `finance`, `health`, `identity`, `inventory`, `marketplace`, `notifications`, `offers`, `onboarding`, `organisations`, `payments`, `payouts`, `promoters`, `prisma`, `redis`, `refunds`, `returns`, `support`, `tally`.

Of these, Kisan Club reuses the following **without modification**:

| Module                | What Club gets for free                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `catalogue`           | Master products, brands, variants, documents, approval lifecycle. Club adds no product model.                        |
| `inventory`           | Warehouses, batches, FIFO-by-expiry reservation, append-only `InventoryMovement`. Club stock _is_ distributor stock. |
| `offers`              | `DistributorOffer` remains the only price-and-stock source of truth. Club never invents its own inventory.           |
| `cart`                | Club items go in the same cart.                                                                                      |
| `payments`            | Same mock intent → confirm lifecycle.                                                                                |
| `returns` / `refunds` | Club orders are returnable through the existing path (with one pricing correction — see §7.5).                       |
| `support`             | Club farmers raise ordinary support tickets.                                                                         |
| `audit`               | `AuditService.record` covers every Club state change.                                                                |
| `notifications`       | Existing enqueue → attempt lifecycle; Club adds event types, not a delivery mechanism.                               |
| `payouts`             | Promoter Club earnings appear in the existing `GET /payouts/statements/me`.                                          |

Reused with **additive extension** (no redefinition):

| Module        | Extension                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `marketplace` | A Club-scoped variant of the existing discovery query. See §4 D2.                               |
| `checkout`    | Benefit evaluation injected at one existing seam. See §7.3.                                     |
| `finance`     | One new ledger entry type. See §7.4.                                                            |
| `promoters`   | Club assignment _drives_ the existing `PromoterAttribution`; it does not replace it. See §4 D4. |
| `dashboards`  | Club scopes added to the existing permission-scoped summary.                                    |

### 2.2 Key existing code the plan hooks into

- `apps/marketplace-api/src/marketplace/marketplace.service.ts` — `discoveryOfferInclude`, `findCandidateOffers`, `toEligibleOffers`, `toProductSummaries`. This is the entire farmer-facing discovery engine including live stock derivation. Club discovery reuses it verbatim with one extra `where` constraint.
- `apps/marketplace-api/src/checkout/checkout.service.ts:1827` — `prepareCartItemsForCheckout`, and `:1851` where `unitPricePaise` is taken from `offer.sellingPricePaise`. **This is the single line where Club pricing must attach.** Everything downstream (order items, subtotals, invoices, commissions) derives from it.
- `apps/marketplace-api/src/checkout/checkout.service.ts:1704` — `createChildOrderWithReservations`, one `ProductOrder` per seller, plus inventory reservation. Club adds a fulfilment-assignment side effect here.
- `apps/marketplace-api/src/checkout/checkout.service.ts:1485-1516` — `ensureFulfilmentTransitionAllowed` / `allowedFulfilmentFromStatus`. The Club fulfilment state machine copies this shape rather than inventing a new guard style.
- `apps/marketplace-api/src/finance/finance.service.ts:118` — `recordDeliveryCommission`, and `:184-208` where promoter commission is created as **platform-borne** with an explicit comment that it must not reduce the distributor's payable. This precedent is the direct model for how Club discounts are funded (§4 D3).
- `apps/marketplace-api/src/promoters/promoters.service.ts:53-92` — the "one active attribution per farmer, auto-revoke the previous one" transaction. Club assignment must call into this, not duplicate it.
- `apps/marketplace-api/prisma/schema.prisma:324` — `OtpChallenge` with `otpHash` / `otpSalt` / `expiresAt` / `attemptCount` / `consumedAt`. The Club benefit token copies this security shape exactly (§4 D8).
- `apps/marketplace-api/prisma/schema.prisma:366` — `FarmerProfile`, including `cropInterests String[]`, the free-text precursor that the structured farm registry supersedes.

### 2.3 Farmer app: the pattern to follow

`apps/farmer-mobile/lib/src/` is organised as one folder per domain (`auth`, `cart`, `checkout`, `orders`, `returns`, `support`, `notifications`, `profile`, `addresses`, `payments`, `marketplace`), each containing a `*_repository.dart` plus models, with all screens flat in `screens/` and routes centralised in `routing/app_routes.dart`.

`apps/farmer-mobile/lib/src/app.dart` injects every repository as an **optional constructor parameter** on `FarmerApp` — this is the established test seam. Club repositories must follow it or widget tests cannot stub them.

There are 19 screens and 424 localisation keys across `app_en.arb` and `app_hi.arb`.

### 2.4 What is genuinely missing and must be built

Nothing in the repository currently models: territories, farms, crop cycles, farm activities, advisory content, programme membership, or benefit rules. There is **no** `Territory` model, no `Farm` model, no `AdvisoryRule` model. Every one of these is new.

The partner app originally contained static role tiles only. Its authenticated, localised and role-routed WP-12 shell was completed on 2026-08-14, so KC-10 can now compose the existing promoter-scoped APIs without rebuilding navigation or session handling.

---

## 3. Binding constraints that shape the design

These come from `AGENTS.md`, which is authoritative. They are not preferences.

**C1 — The distributor remains the seller of record** (`AGENTS.md` §2 rules 2, 3, 13). A Club order is still a farmer↔distributor transaction. A promoter assisting or physically handing over the goods does **not** make the promoter the seller and does **not** move the invoice. Any Club design in which the promoter issues the invoice is a change to the seller-of-record model, which `AGENTS.md` §14 explicitly prohibits without approval.

**C2 — Vardhnam's own products follow the same rules** (`AGENTS.md` §2 rule 17). "Vardhnam-only catalogue" does **not** mean Vardhnam sells directly. It means the _brand owner_ is Vardhnam; a distributor still holds the stock, prices the offer and invoices the farmer. If Vardhnam wants to sell its own goods, it must be onboarded as a distributor organisation like anyone else.

**C3 — No financial amount may be computed on the frontend** (`AGENTS.md` §2 rule 20). Club prices, discounts, savings figures and token values are all backend-derived. The app displays what the API returns.

**C4 — Only one primary attribution may receive the standard sales commission** (`AGENTS.md` §2 rule 14). Club promoter commission must extend the existing `PromoterAttribution` + `CommissionEntry` system, not create a second one.

**C5 — Automatic pesticide recommendations and unapproved AI-generated agronomy advice are prohibited** (`AGENTS.md` §14). This is the hardest constraint in the entire Club concept, because §28–§31 of the product brief describe exactly an advisory-to-product recommendation engine. The design in §10 below is built to satisfy this constraint, and it materially changes what "advisory" can ship as. **Read §10 before promising advisory features to the business.**

**C6 — Financial movements are immutable ledger entries, separated by type** (`AGENTS.md` §10). A Club discount is a distinct economic event and needs its own ledger entry type.

**C7 — Use UUIDs or another approved non-sequential public identifier** (`AGENTS.md` §7). The `VKC-ETAH-001245` member number in the brief is sequential and enumerable. See §5.1 for how this is handled.

**C8 — Every completed feature includes tests; a task is not done without them** (`AGENTS.md` §12).

---

## 4. Architectural decisions

Each of these should become an ADR in `docs/DECISIONS/` before implementation starts, per `AGENTS.md` §7.

### D1 — Kisan Club is a scoped layer, not a fork

**Decision:** Club functionality lives in new modules (`src/kisan-club/`, `src/farms/`, `src/advisory/`) that _compose_ existing services. No existing service is copied. `CheckoutService` gains a dependency on `KisanClubBenefitService`; it does not gain a `createClubCheckout` twin of `createCheckoutFromCart`.

**Why:** `createCheckoutFromCart` is ~500 lines of `Serializable`-transaction inventory reservation logic covered by `phase3b-checkout-orders.spec.ts`, `phase4-fulfilment.spec.ts` and `mvp-acceptance.spec.ts`. A parallel Club version would double the surface area of the most correctness-critical code in the system and guarantee drift.

**Consequence:** Club constraints must be expressible as _filters and additive fields_. Where they cannot be, that is a red flag to escalate, not to fork.

### D2 — "Vardhnam product" is a programme mapping, not a boolean

**Decision:** Implement `KisanClubProductProgramme` as the brief proposes (§11), **not** an `isKisanClubEligible` boolean on `MasterProduct`.

Club discovery = the existing marketplace query plus `productId IN (SELECT productId FROM KisanClubProductProgramme WHERE enabled AND window-active AND region-matches)`.

**Why a mapping beats a boolean:**

- Club launches as a **geographic pilot** (Etah/Aliganj per brief §56). A boolean cannot express "this product is Club-eligible in Etah but not yet in Aligarh."
- The brief requires launch/end dates and priority ordering — three more columns on `MasterProduct` that mean nothing to the 95% of products that are not Club products.
- `MasterProduct` is owned by the company organisation and edited through the catalogue approval workflow. Club eligibility is a _Vardhnam operations_ decision. Putting it on the product would mean a company editing its own Club eligibility, or a confusing split of write permissions on one model.

**Why the programme, not just "brand owner is Vardhnam":** brand ownership alone would auto-enrol every Vardhnam SKU the moment it is approved, including ones with no Club stock, no Club price and no promoter coverage. Enrolment must be deliberate.

**Verification of "is actually Vardhnam":** the programme row is only creatable for a `MasterProduct` whose `companyOrganisation.type` is a Vardhnam-owned company organisation. This is validated server-side at programme creation and re-validated at Club discovery time, so a later ownership change cannot silently leak a third-party product into the Club.

### D3 — The Club discount is platform-borne, and pricing fields are added, never redefined

**Decision:** The distributor continues to receive the full `offer.sellingPricePaise` for the goods. The farmer pays less. Vardhnam absorbs the difference as a marketing cost recorded in a new `FinancialLedgerEntryType.CLUB_BENEFIT_SUBSIDY`.

**Why platform-borne:** there is an exact precedent in the codebase. `finance.service.ts:184-189` funds promoter commission from the platform with the reasoning that "the distributor did not engage the promoter, so its payout shouldn't shrink because one exists." The identical logic applies here: the distributor did not agree to a Vardhnam Kisan Club discount. Silently reducing distributor payable to fund a Vardhnam programme would be a unilateral change to the commercial terms of an approved offer.

**Why "add, don't redefine":** the naïve implementation makes `ProductOrder.subtotalPaise` the discounted amount. That single change would silently alter the distributor payable and marketplace commission computed at `finance.service.ts:131-134`, and would move assertions in at least `phase3b`, `phase5-finance`, `phase6-payouts`, `phase6-promoter-attribution` and `mvp-acceptance`. Instead:

- `subtotalPaise` keeps its exact current meaning: **the value of the goods, owed to the distributor**.
- New `clubBenefitPaise` holds the discount.
- New `farmerPayablePaise = subtotalPaise − clubBenefitPaise` is what the farmer is charged.

For every non-Club order `clubBenefitPaise = 0` and `farmerPayablePaise == subtotalPaise`, so existing behaviour and every existing assertion is unchanged. Full mechanics and a worked example in §7.

**Deferred alternative:** a distributor-funded Club offer (where the distributor opts in to bearing the discount in exchange for volume) is a legitimate future model. It is deliberately **not** in scope, because it requires distributor-side consent capture and a different ledger treatment. When it arrives it becomes a `fundingSource` enum on the benefit rule, not a redesign.

### D4 — Separate the relationship record from the money record

**Decision:** Two models, one authority.

- `KisanClubPromoterAssignment` — the **relationship**: territory, assignment reason, score snapshot, history, reassignment audit. Append-only history; never overwritten (brief §50).
- `PromoterAttribution` — the **money**, unchanged. Remains the single record that `finance.service.ts:190` reads when creating `PROMOTER_COMMISSION`.

When a Club assignment becomes active, the Club service calls the existing `PromotersService` attribution logic inside the same transaction. When a farmer is reassigned, the old assignment is closed and a new attribution is created (the existing code at `promoters.service.ts:58-63` already auto-revokes the prior active one).

**Why not one model:** the brief (§40) explicitly requires Club commission to "extend that system rather than creating a second money ledger." But it also requires assignment history, territory linkage and reassignment reasons that have no business being in a record the finance module reads on every delivery. Splitting keeps the finance read path narrow and unchanged, while giving operations the history they need.

**Why not put territory on `PromoterAttribution`:** attribution is created per-farmer and read in a hot path; territory is promoter-scoped configuration. Different lifecycles, different owners.

### D5 — Club fulfilment is a parallel coordination record, not an order status

**Decision:** `KisanClubFulfilmentAssignment` hangs off `ProductOrder` with its own status enum and its own transition guard. The `ProductOrderStatus` state machine (24 states, `schema.prisma:154-180`) is **not extended**.

**Why:** `ProductOrderStatus` is the legal/commercial lifecycle of a distributor sale. Promoter coordination is an operational overlay that can succeed, fail or be reassigned without changing whether the distributor has packed, invoiced or delivered. Merging them would mean a promoter's inaction could block an order's commercial state, and every existing fulfilment transition guard would have to learn about promoters.

**The unresolved part — who physically delivers.** Brief §20 (Mode A) has the promoter delivering to the farmer. The existing delivery path (`ProductDeliveryAssignment`, `schema.prisma:938`) requires a `DELIVERY_PARTNER` and carries the OTP-verified proof of delivery that the finance module keys `DELIVERY_FEE` off. Two options:

1. **Recommended:** a promoter who physically delivers is _also_ given a `DELIVERY_PARTNER` membership. `User` already supports multiple `OrganisationMembership` rows, so this needs no schema change. The tested POD/OTP path is preserved; the Club assignment stays coordination-only.
2. Build a promoter-specific POD path. This duplicates OTP, geotagging and delivery-fee logic. Not recommended.

This needs business sign-off (§18 item 2) because it has KYC, insurance and payout implications, not just technical ones.

### D6 — Advisory content is human-authored and approved; nothing is generated

See §10. Summarised: `AdvisoryRule` gets an approval lifecycle mirroring `MasterProduct`'s (`DRAFT → PENDING_REVIEW → APPROVED`, with `reviewedByUserId` / `reviewedAt` / `reviewReason`). No model output, no heuristic pesticide suggestion, ever, reaches a farmer without a named human approver on the record.

### D7 — Consent is granular, GPS is optional, and neither blocks membership

**Decision:** Four independent consent flags on the membership (`programmeTerms`, `advisory`, `marketing`, `preciseLocation`), each with its own timestamp and version string. Membership requires only `programmeTerms`. GPS refusal degrades promoter matching to pincode/village level; it never blocks joining (brief §54).

**Why versioned:** consent to a v1 programme terms document is not consent to v2. Storing `termsVersion` alongside `termsAcceptedAt` is the difference between a defensible consent record and a timestamp.

### D8 — The Club benefit token reuses the OTP security shape

**Decision:** `KisanClubBenefitToken` stores `tokenHash` + `tokenSalt`, never the plaintext code, with `expiresAt`, `attemptCount`, `consumedAt` — the exact column set of `OtpChallenge` (`schema.prisma:324`). The plaintext `VKC-782165` code is returned once, at issuance, and never again.

**Why:** the token authorises a price reduction. It is a bearer credential. A stored plaintext code is a database-read-to-free-discount path. `crypto.util` and its unit test already exist for exactly this.

---

## 5. Data model

All new models follow existing conventions: `@db.Uuid` ids via `gen_random_uuid()`, `@db.Timestamptz(6)` timestamps, paise integers for money, `createdAt`/`updatedAt` on entities, `onDelete: Restrict` on anything financially or legally referenced.

### 5.1 Membership and consent

```prisma
enum KisanClubMembershipStatus {
  PENDING_PROFILE      // joined, terms accepted, farm/crop data incomplete
  AWAITING_PROMOTER    // profile complete, no eligible promoter in territory yet
  ACTIVE
  SUSPENDED
  INACTIVE             // dormant; no orders/logins for a configured period
  CLOSED               // member-initiated exit
}

model KisanClubMembership {
  id                     String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmerProfileId        String   @unique @db.Uuid
  farmerProfile          FarmerProfile @relation(fields: [farmerProfileId], references: [id], onDelete: Restrict)
  memberNumber           String   @unique          // display only — see note below
  status                 KisanClubMembershipStatus @default(PENDING_PROFILE)
  homePincode            String
  homeVillage            String?
  homeDistrict           String?
  homeState              String?
  joinedAt               DateTime @db.Timestamptz(6)

  termsVersion           String
  termsAcceptedAt        DateTime @db.Timestamptz(6)
  advisoryConsent        Boolean  @default(false)
  advisoryConsentAt      DateTime? @db.Timestamptz(6)
  marketingConsent       Boolean  @default(false)
  marketingConsentAt     DateTime? @db.Timestamptz(6)
  preciseLocationConsent Boolean  @default(false)
  preciseLocationConsentAt DateTime? @db.Timestamptz(6)

  referredByMembershipId String?  @db.Uuid
  referredByMembership   KisanClubMembership? @relation("ClubReferral", fields: [referredByMembershipId], references: [id], onDelete: SetNull)
  referrals              KisanClubMembership[] @relation("ClubReferral")

  suspendedReason        String?
  closedAt               DateTime? @db.Timestamptz(6)
  createdAt              DateTime @default(now()) @db.Timestamptz(6)
  updatedAt              DateTime @updatedAt @db.Timestamptz(6)

  farms                  Farm[]
  promoterAssignments    KisanClubPromoterAssignment[]

  @@index([status, homePincode])
  @@index([homeDistrict, status])
}
```

**No tier field.** The brief mentions `membershipTier`; membership is free and there is exactly one tier at launch. Adding an enum with one value invites premature schemes. Add it when a second tier is approved.

**On `memberNumber` and C7:** the API identifier for a membership is always the UUID `id`. `memberNumber` is a human-readable display string shown to the farmer and quoted to a promoter. It must **never** be accepted as a lookup key on any farmer-facing or promoter-facing endpoint — a sequential enumerable identifier that resolves to a farmer's profile is an enumeration vulnerability. Staff endpoints may search by it (behind `KISAN_CLUB_MEMBERSHIPS_READ_ANY`). Generation follows the existing `orderNumber` / settlement-number generator pattern in `checkout.service.ts`.

### 5.2 Farm and crop registry

```prisma
enum FarmOwnershipType { OWNED  LEASED  SHARECROPPED  OTHER }
enum IrrigationSource  { TUBE_WELL  CANAL  RAIN_FED  POND  DRIP  SPRINKLER  OTHER }

model Farm {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  membershipId     String   @db.Uuid
  membership       KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  farmerProfileId  String   @db.Uuid          // denormalised: ownership survives membership closure
  farmerProfile    FarmerProfile @relation(fields: [farmerProfileId], references: [id], onDelete: Restrict)
  name             String
  village          String?
  district         String?
  state            String?
  pincode          String
  areaAcres        Decimal  @db.Decimal(10, 3)
  ownershipType    FarmOwnershipType
  irrigationSource IrrigationSource?
  soilType         String?
  latitude         Decimal? @db.Decimal(9, 6)   // only when preciseLocationConsent
  longitude        Decimal? @db.Decimal(9, 6)
  locationCapturedAt DateTime? @db.Timestamptz(6)
  isActive         Boolean  @default(true)
  cropCycles       FarmCropCycle[]
  createdAt        DateTime @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime @updatedAt @db.Timestamptz(6)

  @@index([membershipId, isActive])
  @@index([pincode])
  @@index([district, state])
}

enum CropCycleStatus { PLANNED  ACTIVE  HARVESTED  ABANDONED }

model FarmCropCycle {
  id                  String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId              String @db.Uuid
  farm                Farm   @relation(fields: [farmId], references: [id], onDelete: Restrict)
  cropId              String @db.Uuid
  crop                Crop   @relation(fields: [cropId], references: [id], onDelete: Restrict)
  varietyName         String?
  varietyProductId    String? @db.Uuid          // links to a Vardhnam seed SKU when known
  varietyProduct      MasterProduct? @relation(fields: [varietyProductId], references: [id], onDelete: SetNull)
  areaAcres           Decimal @db.Decimal(10, 3)
  season              String                    // "RABI_2026_27"
  sowingDate          DateTime? @db.Date
  expectedHarvestDate DateTime? @db.Date
  actualHarvestDate   DateTime? @db.Date
  status              CropCycleStatus @default(ACTIVE)
  yieldQuintals       Decimal? @db.Decimal(10, 3)
  activities          FarmActivity[]
  advisoryEvents      AdvisoryEvent[]
  createdAt           DateTime @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime @updatedAt @db.Timestamptz(6)

  @@index([farmId, status])
  @@index([cropId, season, status])
  @@index([status, sowingDate])
}

enum FarmActivityType {
  SOWING  IRRIGATION  FERTILIZER_APPLIED  CROP_PROTECTION_APPLIED
  PEST_OBSERVED  DISEASE_OBSERVED  WEEDING  CROP_DAMAGE  HARVEST  OTHER
}

enum FarmActivitySource { FARMER  PROMOTER  SYSTEM }

model FarmActivity {
  id              String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cropCycleId     String @db.Uuid
  cropCycle       FarmCropCycle @relation(fields: [cropCycleId], references: [id], onDelete: Restrict)
  activityType    FarmActivityType
  occurredOn      DateTime @db.Date
  notes           String?
  productOrderId  String? @db.Uuid              // "this input came from this order"
  productOrder    ProductOrder? @relation(fields: [productOrderId], references: [id], onDelete: SetNull)
  recordedSource  FarmActivitySource
  recordedByUserId String? @db.Uuid
  recordedBy      User?  @relation("FarmActivityRecordedBy", fields: [recordedByUserId], references: [id], onDelete: SetNull)
  createdAt       DateTime @default(now()) @db.Timestamptz(6)

  @@index([cropCycleId, occurredOn])
  @@index([activityType, occurredOn])
}
```

**Resolved in KC-02:** crop identity uses a `Crop` reference table (stable code, English/Hindi display names and active flag) and `FarmCropCycle.cropId`. This avoids spelling/alias fragmentation without requiring a schema migration whenever operations adds a crop.

**On `FarmerProfile.cropInterests`:** the existing `String[]` stays. It is the pre-Club, marketplace-level signal used for browse personalisation. The structured registry supersedes it for Club members but does not delete it; no migration is needed and non-Club farmers keep working.

### 5.3 Territory and promoter assignment

```prisma
enum PromoterTerritoryStatus { ACTIVE  INACTIVE }

model PromoterTerritory {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name           String
  state          String
  district       String
  blocks         String[] @default([])
  pincodes       String[] @default([])
  villages       String[] @default([])
  status         PromoterTerritoryStatus @default(ACTIVE)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)
  promoterProfiles KisanClubPromoterProfile[]

  @@index([state, district, status])
}

model KisanClubPromoterProfile {
  id                   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  promoterUserId       String @unique @db.Uuid
  promoterUser         User   @relation("ClubPromoterProfile", fields: [promoterUserId], references: [id], onDelete: Restrict)
  promoterOrganisationId String @db.Uuid
  promoterOrganisation Organisation @relation("ClubPromoterOrganisation", fields: [promoterOrganisationId], references: [id], onDelete: Restrict)
  territoryId          String? @db.Uuid
  territory            PromoterTerritory? @relation(fields: [territoryId], references: [id], onDelete: SetNull)
  homeVillage          String?
  homePincode          String?
  clubEnabled          Boolean @default(false)     // ops switch, independent of KYC
  acceptingNewFarmers  Boolean @default(true)      // promoter's own availability toggle
  maxActiveFarmers     Int     @default(150)
  activeFarmerCount    Int     @default(0)         // maintained in-transaction
  createdAt            DateTime @default(now()) @db.Timestamptz(6)
  updatedAt            DateTime @updatedAt @db.Timestamptz(6)

  @@index([territoryId, clubEnabled, acceptingNewFarmers])
  @@index([homePincode, clubEnabled])
}

enum KisanClubAssignmentStatus { ACTIVE  ENDED }

enum KisanClubAssignmentReason {
  AUTO_MATCHED  MANUAL_OPS  PROMOTER_EXITED  TERRITORY_CHANGED
  FARMER_REQUEST  SERVICE_QUALITY  CAPACITY  INACTIVITY
}

model KisanClubPromoterAssignment {
  id               String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  membershipId     String @db.Uuid
  membership       KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  promoterUserId   String @db.Uuid
  promoterUser     User   @relation("ClubAssignmentPromoter", fields: [promoterUserId], references: [id], onDelete: Restrict)
  territoryId      String? @db.Uuid
  territory        PromoterTerritory? @relation(fields: [territoryId], references: [id], onDelete: SetNull)
  status           KisanClubAssignmentStatus @default(ACTIVE)
  assignedAt       DateTime @default(now()) @db.Timestamptz(6)
  endedAt          DateTime? @db.Timestamptz(6)
  assignmentReason KisanClubAssignmentReason
  matchScore       Json?                          // why this promoter won — see §8
  assignedByUserId String? @db.Uuid
  assignedBy       User?  @relation("ClubAssignmentAssignedBy", fields: [assignedByUserId], references: [id], onDelete: SetNull)
  assignedByRole   PlatformRole?
  reason           String?
  promoterAttributionId String? @db.Uuid          // the money record this created
  createdAt        DateTime @default(now()) @db.Timestamptz(6)

  @@index([membershipId, status])
  @@index([promoterUserId, status])
}
```

`matchScore` as `Json` deliberately: it is a diagnostic snapshot of the inputs that produced the decision, not queryable business data. Storing it means operations can answer "why did Ramesh get Rahul?" a year later even after territories change.

### 5.4 Club catalogue programme

```prisma
enum KisanClubProgrammeStatus { DRAFT  ACTIVE  PAUSED  ENDED }

model KisanClubProductProgramme {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId      String @db.Uuid
  product        MasterProduct @relation(fields: [productId], references: [id], onDelete: Restrict)
  variantId      String? @db.Uuid                 // null = all variants of the product
  variant        ProductVariant? @relation(fields: [variantId], references: [id], onDelete: Restrict)
  status         KisanClubProgrammeStatus @default(DRAFT)
  startsAt       DateTime @db.Timestamptz(6)
  endsAt         DateTime? @db.Timestamptz(6)
  eligiblePincodes String[] @default([])          // empty = all Club regions
  eligibleDistricts String[] @default([])
  displayPriority Int @default(0)
  createdByUserId String? @db.Uuid
  createdByRole   PlatformRole?
  reason          String?
  createdAt       DateTime @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @db.Timestamptz(6)

  @@unique([productId, variantId])
  @@index([status, startsAt, endsAt])
}
```

### 5.5 Benefit rules, evaluation and redemption

```prisma
enum KisanClubBenefitType {
  FLAT_AMOUNT_OFF       // ₹X off per unit
  PERCENT_OFF           // X% off, capped
  QUANTITY_THRESHOLD    // buy ≥N, then flat/percent applies
}

enum KisanClubBenefitStatus { DRAFT  ACTIVE  PAUSED  EXPIRED }

model KisanClubBenefitRule {
  id                  String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  programmeId         String @db.Uuid
  programme           KisanClubProductProgramme @relation(fields: [programmeId], references: [id], onDelete: Restrict)
  benefitType         KisanClubBenefitType
  flatAmountPaise     Int?                        // FLAT_AMOUNT_OFF / QUANTITY_THRESHOLD
  percentBps          Int?                        // PERCENT_OFF, basis points
  maxBenefitPaise     Int?                        // per-order cap
  minimumQuantity     Int  @default(1)
  eligiblePincodes    String[] @default([])
  eligibleCropNames   String[] @default([])       // crop-specific promotion
  status              KisanClubBenefitStatus @default(DRAFT)
  startsAt            DateTime @db.Timestamptz(6)
  endsAt              DateTime? @db.Timestamptz(6)
  totalUsageLimit     Int?
  perMemberUsageLimit Int?
  usageCount          Int  @default(0)            // incremented in-transaction
  createdByUserId     String? @db.Uuid
  createdByRole       PlatformRole?
  reason              String?
  createdAt           DateTime @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime @updatedAt @db.Timestamptz(6)
  redemptions         KisanClubBenefitRedemption[]

  @@index([programmeId, status, startsAt])
  @@index([status, startsAt, endsAt])
}

model KisanClubBenefitRedemption {
  id                 String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  benefitRuleId      String @db.Uuid
  benefitRule        KisanClubBenefitRule @relation(fields: [benefitRuleId], references: [id], onDelete: Restrict)
  membershipId       String @db.Uuid
  membership         KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  productOrderItemId String @unique @db.Uuid      // one redemption per order line
  productOrderItem   ProductOrderItem @relation(fields: [productOrderItemId], references: [id], onDelete: Restrict)
  productOrderId     String @db.Uuid
  benefitTokenId     String? @db.Uuid             // Mode B only
  quantity           Int
  perUnitBenefitPaise Int
  totalBenefitPaise  Int
  createdAt          DateTime @default(now()) @db.Timestamptz(6)

  @@index([benefitRuleId, createdAt])
  @@index([membershipId, createdAt])
  @@index([productOrderId])
}
```

The `@@unique` on `productOrderItemId` is the idempotency guarantee: a checkout retry cannot double-count a redemption against a usage limit.

### 5.6 Benefit token (Mode B)

```prisma
enum KisanClubBenefitTokenStatus { ISSUED  REDEEMED  EXPIRED  CANCELLED }

model KisanClubBenefitToken {
  id               String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  membershipId     String @db.Uuid
  membership       KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  benefitRuleId    String @db.Uuid
  benefitRule      KisanClubBenefitRule @relation(fields: [benefitRuleId], references: [id], onDelete: Restrict)
  offerId          String @db.Uuid                // pinned seller + price at issuance
  offer            DistributorOffer @relation(fields: [offerId], references: [id], onDelete: Restrict)
  promoterUserId   String? @db.Uuid               // suggested promoter
  quantity         Int
  quotedUnitPricePaise Int                        // snapshot, informational
  quotedBenefitPaise   Int
  tokenHash        String @unique
  tokenSalt        String
  status           KisanClubBenefitTokenStatus @default(ISSUED)
  expiresAt        DateTime @db.Timestamptz(6)
  attemptCount     Int @default(0)
  consumedAt       DateTime? @db.Timestamptz(6)
  consumedByUserId String? @db.Uuid
  productOrderId   String? @db.Uuid               // order created on redemption
  createdAt        DateTime @default(now()) @db.Timestamptz(6)

  @@index([membershipId, status])
  @@index([status, expiresAt])
}
```

**Critical:** `quotedUnitPricePaise` and `quotedBenefitPaise` are **display snapshots only**. On redemption the price and benefit are re-derived live from the offer and rule, exactly as `prepareCartItemsForCheckout` re-reads the offer at `checkout.service.ts:1833`. A token is authorisation to transact, never a frozen price. Otherwise a stale token becomes a way to buy at last month's price after a price rise.

### 5.7 Club fulfilment assignment

```prisma
enum KisanClubFulfilmentStatus {
  ASSIGNED  PROMOTER_ACCEPTED  PROMOTER_DECLINED  PRODUCT_READY
  FARMER_CONTACTED  READY_FOR_PICKUP  OUT_FOR_DELIVERY
  COMPLETED  FAILED  REASSIGNED  CANCELLED
}

enum KisanClubFulfilmentMode { CLUB_HOME_DELIVERY  PROMOTER_PICKUP  ASSISTED_PURCHASE }

model KisanClubFulfilmentAssignment {
  id              String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productOrderId  String @unique @db.Uuid
  productOrder    ProductOrder @relation(fields: [productOrderId], references: [id], onDelete: Restrict)
  membershipId    String @db.Uuid
  membership      KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  promoterUserId  String @db.Uuid
  promoterUser    User   @relation("ClubFulfilmentPromoter", fields: [promoterUserId], references: [id], onDelete: Restrict)
  mode            KisanClubFulfilmentMode
  status          KisanClubFulfilmentStatus @default(ASSIGNED)
  assignedAt      DateTime @default(now()) @db.Timestamptz(6)
  acceptedAt      DateTime? @db.Timestamptz(6)
  completedAt     DateTime? @db.Timestamptz(6)
  failureReason   String?
  statusHistory   KisanClubFulfilmentStatusHistory[]
  createdAt       DateTime @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @db.Timestamptz(6)

  @@index([promoterUserId, status])
  @@index([membershipId, status])
  @@index([status, assignedAt])
}

model KisanClubFulfilmentStatusHistory {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  assignmentId   String @db.Uuid
  assignment     KisanClubFulfilmentAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  fromStatus     KisanClubFulfilmentStatus?
  toStatus       KisanClubFulfilmentStatus
  changedByUserId String? @db.Uuid
  changedByRole  PlatformRole?
  reason         String?
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  @@index([assignmentId, createdAt])
}
```

This mirrors `ProductOrderStatusHistory` (`schema.prisma:1046`) exactly, which is the right precedent.

### 5.8 Advisory

```prisma
enum AdvisoryCategory {
  CROP_STAGE  IRRIGATION  NUTRITION  PEST_MONITORING
  DISEASE_RISK  HARVEST  GENERAL_PRACTICE
}

enum AdvisoryRuleStatus { DRAFT  PENDING_REVIEW  APPROVED  REJECTED  ARCHIVED }

model AdvisoryRule {
  id                  String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cropName            String
  varietyName         String?
  category            AdvisoryCategory
  minDaysAfterSowing  Int
  maxDaysAfterSowing  Int
  eligibleStates      String[] @default([])
  eligibleDistricts   String[] @default([])
  seasons             String[] @default([])
  titleEn             String
  bodyEn              String
  titleHi             String
  bodyHi              String
  status              AdvisoryRuleStatus @default(DRAFT)
  version             Int @default(1)
  authoredByUserId    String? @db.Uuid
  reviewedByUserId    String? @db.Uuid
  reviewedAt          DateTime? @db.Timestamptz(6)
  reviewReason        String?
  sourceReference     String?                  // ICAR / KVK / package-of-practices citation
  createdAt           DateTime @default(now()) @db.Timestamptz(6)
  updatedAt           DateTime @updatedAt @db.Timestamptz(6)
  productMappings     AdvisoryProductMapping[]
  events              AdvisoryEvent[]

  @@index([cropName, status, minDaysAfterSowing])
  @@index([status, category])
}

model AdvisoryProductMapping {
  id                     String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  advisoryRuleId         String @db.Uuid
  advisoryRule           AdvisoryRule @relation(fields: [advisoryRuleId], references: [id], onDelete: Restrict)
  productId              String @db.Uuid
  product                MasterProduct @relation(fields: [productId], references: [id], onDelete: Restrict)
  isCropProtection       Boolean @default(false)      // hard gate — see §10.4
  agronomistApprovedByUserId String? @db.Uuid
  agronomistApprovedAt   DateTime? @db.Timestamptz(6)
  displayPriority        Int @default(0)
  createdAt              DateTime @default(now()) @db.Timestamptz(6)

  @@unique([advisoryRuleId, productId])
}

enum AdvisoryEventStatus { PENDING  DELIVERED  READ  DISMISSED }

model AdvisoryEvent {
  id             String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cropCycleId    String @db.Uuid
  cropCycle      FarmCropCycle @relation(fields: [cropCycleId], references: [id], onDelete: Restrict)
  membershipId   String @db.Uuid
  membership     KisanClubMembership @relation(fields: [membershipId], references: [id], onDelete: Restrict)
  advisoryRuleId String @db.Uuid
  advisoryRule   AdvisoryRule @relation(fields: [advisoryRuleId], references: [id], onDelete: Restrict)
  ruleVersion    Int                                  // what the farmer actually saw
  status         AdvisoryEventStatus @default(PENDING)
  dueOn          DateTime @db.Date
  notificationId String? @db.Uuid
  readAt         DateTime? @db.Timestamptz(6)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([cropCycleId, advisoryRuleId, ruleVersion])   // never advise the same thing twice
  @@index([membershipId, status, dueOn])
}
```

### 5.9 Additive changes to existing models

| Model                      | Added field                                                                                              | Rationale                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ProductOrderItem`         | `clubBenefitPaise Int @default(0)`, `clubBenefitRuleId String?`                                          | Per-line discount, needed for pro-rated refunds                        |
| `ProductOrder`             | `clubBenefitPaise Int @default(0)`, `farmerPayablePaise Int`, `isKisanClubOrder Boolean @default(false)` | §7                                                                     |
| `ProductCheckout`          | `clubBenefitPaise Int @default(0)`, `farmerPayablePaise Int`                                             | §7                                                                     |
| `CartItem`                 | `clubBenefitSnapshotPaise Int @default(0)`                                                               | Display only, non-binding, same status as `priceSnapshotPaise`         |
| `Cart`                     | `kisanClubContext Boolean @default(false)`                                                               | Whether this cart was built inside Club (affects display, never price) |
| `FinancialLedgerEntryType` | `+ CLUB_BENEFIT_SUBSIDY`                                                                                 | C6                                                                     |
| `CommissionEntryType`      | _(unchanged)_                                                                                            | Club promoter commission reuses `PROMOTER_COMMISSION` — D4             |
| `FarmerProfile`            | relations to `kisanClubMembership`, `farms`                                                              |                                                                        |
| `MasterProduct`            | relations to programme, advisory mappings, crop cycles                                                   |                                                                        |

**Backfill:** `farmerPayablePaise` is non-nullable, so the migration must set `farmerPayablePaise = subtotalPaise` for every existing row. This is a two-step migration (add nullable → backfill → set NOT NULL) on `ProductOrder` and `ProductCheckout`.

---

## 6. Backend modules and endpoints

Three new modules, each following the existing convention: thin controller, all logic in the service, DTOs with `class-validator`, `@RequirePermissions`, `MockAuthGuard` + `PermissionsGuard`, `getRequestId(request)` threaded to audit, explicit action-per-transition methods rather than generic `PATCH status` (matching `offers.service.ts`, `returns.service.ts`, `checkout.service.ts`).

### 6.1 `src/kisan-club/`

```
kisan-club/
├── kisan-club.module.ts
├── membership/
│   ├── kisan-club-membership.controller.ts
│   └── kisan-club-membership.service.ts
├── catalogue/
│   ├── kisan-club-catalogue.controller.ts     // Club-scoped discovery
│   └── kisan-club-catalogue.service.ts
├── benefits/
│   ├── kisan-club-benefits.controller.ts      // ops CRUD on rules/programmes
│   ├── kisan-club-benefit.service.ts          // evaluation — consumed by checkout
│   └── kisan-club-benefit-token.service.ts
├── assignment/
│   ├── kisan-club-assignment.controller.ts
│   ├── kisan-club-assignment.service.ts
│   └── promoter-matching.service.ts           // pure, unit-testable
├── fulfilment/
│   ├── kisan-club-fulfilment.controller.ts
│   └── kisan-club-fulfilment.service.ts
└── dto/
```

**Farmer-facing endpoints**

| Method  | Route                                | Permission                             |
| ------- | ------------------------------------ | -------------------------------------- |
| `POST`  | `/kisan-club/membership`             | `KISAN_CLUB_MEMBERSHIP_WRITE_OWN`      |
| `GET`   | `/kisan-club/membership/me`          | `KISAN_CLUB_MEMBERSHIP_READ_OWN`       |
| `PATCH` | `/kisan-club/membership/me/consents` | `KISAN_CLUB_MEMBERSHIP_WRITE_OWN`      |
| `POST`  | `/kisan-club/membership/me/close`    | `KISAN_CLUB_MEMBERSHIP_WRITE_OWN`      |
| `GET`   | `/kisan-club/products`               | `KISAN_CLUB_CATALOGUE_READ_OWN`        |
| `GET`   | `/kisan-club/products/:productId`    | `KISAN_CLUB_CATALOGUE_READ_OWN`        |
| `GET`   | `/kisan-club/promoter/me`            | `KISAN_CLUB_MEMBERSHIP_READ_OWN`       |
| `POST`  | `/kisan-club/benefit-tokens`         | `KISAN_CLUB_BENEFIT_TOKENS_CREATE_OWN` |
| `GET`   | `/kisan-club/benefit-tokens/me`      | `KISAN_CLUB_BENEFIT_TOKENS_READ_OWN`   |
| `GET`   | `/kisan-club/orders/me`              | `ORDERS_READ_OWN` (reused)             |

**Promoter-facing endpoints**

| Method | Route                                                     | Permission                          |
| ------ | --------------------------------------------------------- | ----------------------------------- |
| `GET`  | `/kisan-club/promoter/farmers`                            | `KISAN_CLUB_FARMERS_READ_OWN`       |
| `GET`  | `/kisan-club/promoter/farmers/:membershipId`              | `KISAN_CLUB_FARMERS_READ_OWN`       |
| `GET`  | `/kisan-club/fulfilment/assignments`                      | `KISAN_CLUB_FULFILMENT_READ_OWN`    |
| `POST` | `/kisan-club/fulfilment/assignments/:id/accept`           | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/decline`          | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/product-ready`    | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/farmer-contacted` | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/ready-for-pickup` | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/complete`         | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/fulfilment/assignments/:id/fail`             | `KISAN_CLUB_FULFILMENT_MANAGE_OWN`  |
| `POST` | `/kisan-club/benefit-tokens/redeem`                       | `KISAN_CLUB_ASSISTED_ORDERS_CREATE` |

**Operations-facing endpoints**

| Method           | Route                                           | Permission                            |
| ---------------- | ----------------------------------------------- | ------------------------------------- |
| `GET/POST/PATCH` | `/kisan-club/programmes`                        | `KISAN_CLUB_PROGRAMMES_MANAGE`        |
| `GET/POST/PATCH` | `/kisan-club/benefit-rules`                     | `KISAN_CLUB_BENEFITS_MANAGE`          |
| `GET/POST/PATCH` | `/kisan-club/territories`                       | `KISAN_CLUB_TERRITORIES_MANAGE`       |
| `GET/POST/PATCH` | `/kisan-club/promoter-profiles`                 | `KISAN_CLUB_PROMOTER_PROFILES_MANAGE` |
| `GET`            | `/kisan-club/memberships`                       | `KISAN_CLUB_MEMBERSHIPS_READ_ANY`     |
| `GET`            | `/kisan-club/memberships/:id`                   | `KISAN_CLUB_MEMBERSHIPS_READ_ANY`     |
| `POST`           | `/kisan-club/memberships/:id/reassign-promoter` | `KISAN_CLUB_ASSIGNMENTS_MANAGE`       |
| `POST`           | `/kisan-club/memberships/:id/suspend`           | `KISAN_CLUB_MEMBERSHIPS_MANAGE`       |
| `GET`            | `/kisan-club/intelligence/crop-summary`         | `KISAN_CLUB_INTELLIGENCE_READ`        |
| `GET`            | `/kisan-club/intelligence/promoter-performance` | `KISAN_CLUB_INTELLIGENCE_READ`        |

### 6.2 `src/farms/`

Separate module because farm data is **not** Club-exclusive in principle (a non-Club farmer could register a farm later) and because it has a distinct owner: the farmer, not the programme.

| Method     | Route                                         | Permission                                              |
| ---------- | --------------------------------------------- | ------------------------------------------------------- |
| `GET/POST` | `/farms`                                      | `FARMS_READ_OWN` / `FARMS_WRITE_OWN`                    |
| `PATCH`    | `/farms/:farmId`                              | `FARMS_WRITE_OWN`                                       |
| `GET/POST` | `/farms/:farmId/crop-cycles`                  | `FARMS_READ_OWN` / `FARMS_WRITE_OWN`                    |
| `PATCH`    | `/farms/:farmId/crop-cycles/:cycleId`         | `FARMS_WRITE_OWN`                                       |
| `POST`     | `/farms/:farmId/crop-cycles/:cycleId/harvest` | `FARMS_WRITE_OWN`                                       |
| `GET/POST` | `/farms/crop-cycles/:cycleId/activities`      | `FARMS_READ_OWN` / `FARMS_WRITE_OWN`                    |
| `POST`     | `/farms/surveys`                              | `FARM_SURVEYS_CREATE` (promoter, on behalf of a farmer) |
| `GET`      | `/farms/reference/crops`                      | authenticated                                           |

**Ownership rule for promoter-recorded surveys:** the promoter may create and update farm/crop records for a farmer **assigned to them**, and every such write records `recordedSource = PROMOTER` and `recordedByUserId`. The farmer remains the owner and may edit or delete anything a promoter entered (brief §27). Access is checked against an `ACTIVE` `KisanClubPromoterAssignment`, following the `ensureCanActOnTicket` OWN-vs-ANY pattern in `support.service.ts`.

### 6.3 `src/advisory/`

| Method           | Route                          | Permission                                                          |
| ---------------- | ------------------------------ | ------------------------------------------------------------------- |
| `GET`            | `/advisory/me`                 | `ADVISORY_READ_OWN`                                                 |
| `POST`           | `/advisory/events/:id/read`    | `ADVISORY_READ_OWN`                                                 |
| `POST`           | `/advisory/events/:id/dismiss` | `ADVISORY_READ_OWN`                                                 |
| `GET/POST/PATCH` | `/advisory/rules`              | `ADVISORY_RULES_MANAGE`                                             |
| `POST`           | `/advisory/rules/:id/submit`   | `ADVISORY_RULES_MANAGE`                                             |
| `POST`           | `/advisory/rules/:id/approve`  | `ADVISORY_RULES_REVIEW`                                             |
| `POST`           | `/advisory/rules/:id/reject`   | `ADVISORY_RULES_REVIEW`                                             |
| `POST`           | `/advisory/generate`           | `ADVISORY_RULES_MANAGE` (manual trigger; scheduled job after WP-04) |

---

## 7. Club pricing and finance — the deep dive

This is the highest-risk area of the whole plan. Get it wrong and you either silently underpay distributors or break twenty passing integration tests.

### 7.1 The invariant

```
subtotalPaise        = Σ (offer.sellingPricePaise × quantity)      ← owed to the distributor. UNCHANGED MEANING.
clubBenefitPaise     = Σ (perUnitBenefitPaise × quantity)          ← borne by Vardhnam
farmerPayablePaise   = subtotalPaise − clubBenefitPaise            ← charged to the farmer
```

For every non-Club order, `clubBenefitPaise = 0` and `farmerPayablePaise == subtotalPaise`. **No existing behaviour changes.**

### 7.2 Benefit evaluation service

`KisanClubBenefitService.evaluate(input) → BenefitEvaluation`

```ts
interface BenefitEvaluationInput {
  membership: KisanClubMembership;
  offer: DistributorOffer; // already validated by the caller
  quantity: number;
  deliveryPincode: string;
  cropNames: string[]; // from the member's ACTIVE crop cycles
  at: Date;
}

interface BenefitEvaluation {
  benefitRuleId: string | null;
  perUnitBenefitPaise: number; // 0 when no rule applies
  totalBenefitPaise: number; // after maxBenefitPaise cap
  reasonCode:
    | 'APPLIED'
    | 'NO_RULE'
    | 'BELOW_MIN_QUANTITY'
    | 'REGION_INELIGIBLE'
    | 'CROP_INELIGIBLE'
    | 'USAGE_LIMIT_REACHED'
    | 'MEMBERSHIP_INACTIVE';
}
```

Pure and deterministic given its inputs, so it is unit-testable without a database — mirroring how `offers.service.spec.ts` and `checkout.service.spec.ts` are structured today.

**Rule precedence when several match:** highest `totalBenefitPaise` wins; ties broken by the most specific rule (crop-specific > pincode-specific > general), then by earliest `startsAt`, then by `id`. Deterministic ordering matters — a farmer who reloads the screen must see the same price.

**Called from four places, binding in exactly one:**

| Caller                                        | Purpose                                     | Binding?      |
| --------------------------------------------- | ------------------------------------------- | ------------- |
| `KisanClubCatalogueService`                   | Show "Club price ₹Y" on browse/detail       | No — display  |
| `CartService`                                 | `clubBenefitSnapshotPaise` on the cart line | No — snapshot |
| `KisanClubBenefitTokenService`                | `quotedBenefitPaise` on the token           | No — quote    |
| `CheckoutService.prepareCartItemsForCheckout` | The price actually charged                  | **Yes**       |

This is the same discipline the codebase already applies to offer prices: snapshots everywhere, live re-read at `checkout.service.ts:1833`. Satisfies C3.

### 7.3 The checkout integration point

The only change to `prepareCartItemsForCheckout` (`checkout.service.ts:1827`):

```ts
// existing
const offer = await this.findOfferOrThrow(tx, cartItem.offerId);
const availableQuantity = await this.validateOfferForCheckout(
  tx,
  offer,
  pincode,
  cartItem.quantity,
);
// ... existing quantity guard ...

// NEW — zero-impact when the farmer is not a Club member
const benefit = membership
  ? await this.kisanClubBenefitService.evaluate(
      {
        membership,
        offer,
        quantity: cartItem.quantity,
        deliveryPincode: pincode,
        cropNames,
        at: now,
      },
      tx,
    )
  : NO_BENEFIT;

preparedItems.push({
  cartItem,
  offer,
  unitPricePaise: offer.sellingPricePaise, // unchanged
  lineTotalPaise: offer.sellingPricePaise * cartItem.quantity, // unchanged
  clubBenefitRuleId: benefit.benefitRuleId, // new
  clubBenefitPaise: benefit.totalBenefitPaise, // new
});
```

`createChildOrderWithReservations` (`:1704`) then computes `farmerPayablePaise` alongside the existing `subtotalPaise` reduction at `:1723`, writes `clubBenefitPaise` onto each `ProductOrderItem`, and creates one `KisanClubBenefitRedemption` per discounted line — all inside the existing `Serializable` transaction, so usage-limit increments are safe under concurrency without any new locking.

### 7.4 Ledger treatment

At payment confirmation (`payments.service.ts` `confirmMockPaymentIntent`, where `recordFarmerPayment` is already called):

| Entry type                       | Amount               | Organisation                    | When                             |
| -------------------------------- | -------------------- | ------------------------------- | -------------------------------- |
| `FARMER_PAYMENT`                 | `farmerPayablePaise` | seller                          | payment confirmed                |
| `CLUB_BENEFIT_SUBSIDY` **(new)** | `clubBenefitPaise`   | seller (attributed to the sale) | payment confirmed, only when > 0 |

At delivery (`finance.service.ts:118`), **unchanged**:

| Entry type               | Amount                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `MARKETPLACE_COMMISSION` | `subtotalPaise × marketplaceCommissionBps / 10_000`                                 |
| `DISTRIBUTOR_PAYABLE`    | `subtotalPaise − marketplaceCommission`                                             |
| `PROMOTER_COMMISSION`    | `subtotalPaise × promoterCommissionBps / 10_000`, when an active attribution exists |
| `DELIVERY_FEE`           | `rule.deliveryFeePaise`                                                             |

The subsidy entry is precisely the amount by which farmer payment falls short of the goods value. Without it the ledger would not reconcile — which is exactly why it must be its own type rather than a silent reduction (C6).

### 7.5 Worked example

Offer price ₹1,200 (120000 paise), quantity 1, Club benefit ₹100 flat, marketplace commission 500 bps, promoter attribution present at 0 bps (current default).

```
ProductOrder.subtotalPaise       = 120000     (owed for goods)
ProductOrder.clubBenefitPaise    =  10000
ProductOrder.farmerPayablePaise  = 110000     (farmer is charged this)

On payment:
  FARMER_PAYMENT           110000
  CLUB_BENEFIT_SUBSIDY      10000            ← Vardhnam's marketing cost

On delivery:
  MARKETPLACE_COMMISSION     6000            (120000 × 500 / 10000)
  DISTRIBUTOR_PAYABLE      114000            (distributor is made whole)
  PROMOTER_COMMISSION           0            (0 bps until approved)
  DELIVERY_FEE                  0            (placeholder until approved)

Reconciliation: 110000 + 10000 = 120000 = 6000 + 114000  ✓
```

### 7.6 Returns and refunds — the correction that must not be missed

A refund must return **what the farmer actually paid**, not the list price. Refunding `unitPricePaise × quantity` on a discounted Club line would refund ₹1,200 against a ₹1,100 payment — a direct cash leak.

`RefundsService` must compute per-line refunds as:

```
perUnitPaidPaise = item.unitPricePaise − (item.clubBenefitPaise / item.quantity)
refundPaise      = perUnitPaidPaise × returnedQuantity
```

with integer-safe rounding (allocate the remainder to the first unit; never floating point, per `AGENTS.md` §7). The corresponding `CLUB_BENEFIT_SUBSIDY` is reversed pro-rata alongside the existing reversal entries.

**This is a required change to an already-tested module and must have its own spec.** It is the single most likely place for a Club bug to become a money bug.

### 7.7 Configuration

New env vars, following the existing "placeholder pending real approval" convention in `env.schema.ts:16-24`:

```ts
KISAN_CLUB_ENABLED: z.coerce.boolean().default(false),
KISAN_CLUB_BENEFIT_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(72),
KISAN_CLUB_MAX_ACTIVE_FARMERS_PER_PROMOTER: z.coerce.number().int().positive().default(150),
// No approved Club promoter commission rate exists yet.
DEFAULT_KISAN_CLUB_PROMOTER_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
KISAN_CLUB_ADVISORY_CROP_PROTECTION_ENABLED: z.coerce.boolean().default(false),  // see §10.4
```

`KISAN_CLUB_ENABLED=false` is the pilot kill switch: every Club route 404s and the checkout benefit hook short-circuits, so a bad Club deployment cannot affect ordinary marketplace orders.

---

## 8. Promoter assignment engine

Implemented as `PromoterMatchingService` — a **pure function** over candidate promoters, with all database reads done by the caller. This makes the whole scoring policy unit-testable with no fixtures, which matters because it is the part most likely to change once the pilot produces real data.

### 8.1 Eligibility filter (all must pass — brief §15)

1. `User.status = ACTIVE`
2. An `ACTIVE` `OrganisationMembership` with role `PROMOTER` or `SALES_PARTNER`
3. `KisanClubPromoterProfile.clubEnabled = true`
4. `KisanClubPromoterProfile.acceptingNewFarmers = true`
5. `activeFarmerCount < maxActiveFarmers`
6. A territory assigned, and that territory `ACTIVE`
7. KYC approved — all required `KycDocument` rows for the promoter's organisation at `APPROVED`
8. A verified `PayoutAccount` **if** the promoter is to earn commission (`status = VERIFIED`)

Ineligibility is never silent: the matching result records which promoters were considered and why each was excluded, stored in `matchScore`.

### 8.2 Scoring (brief §16, deterministic)

Evaluated as an ordered tuple, not a weighted sum — a weighted sum makes "why this promoter" unexplainable to operations:

| Priority | Criterion                                                       | Value        |
| -------- | --------------------------------------------------------------- | ------------ |
| 1        | Same village                                                    | boolean      |
| 2        | Same pincode                                                    | boolean      |
| 3        | Territory contains the farmer's pincode                         | boolean      |
| 4        | Geodesic distance, when both parties have consented coordinates | ascending km |
| 5        | Capacity headroom `1 − activeFarmerCount/maxActiveFarmers`      | descending   |
| 6        | Deterministic tie-break on `promoterUserId`                     | ascending    |

**Performance score is deliberately excluded from the MVP.** There is no performance data on day one, and a score derived from nothing would encode noise as policy. It enters at KC-12 once §41's metrics have a real history.

**Distance is priority 4, not priority 1** — this is the brief's own instruction (§16: "Do not allocate only by physical distance") and the reason for the ordered tuple.

### 8.3 The no-eligible-promoter case

Membership does **not** fail. The member is created with `status = AWAITING_PROMOTER`, appears in an operations queue, can still browse the Club catalogue and register farms, and is auto-matched when a promoter becomes eligible in their territory. Club benefit rules that do not require a promoter still apply; Mode B (which needs a named promoter) is hidden.

Blocking membership on promoter availability would make Club growth a function of recruitment, which inverts the flywheel in brief §62.

### 8.4 Reassignment

`POST /kisan-club/memberships/:id/reassign-promoter`, staff-only, requires a `KisanClubAssignmentReason` and a free-text `reason`. In one transaction:

1. Close the current assignment (`status = ENDED`, `endedAt`), decrement the old promoter's `activeFarmerCount`.
2. Create the new assignment, increment the new promoter's count.
3. Call `PromotersService` to revoke the old `PromoterAttribution` and create a new one (the existing code at `promoters.service.ts:58-63` already handles the revoke).
4. Write an `AuditLog` with both previous and new values.

**In-flight orders keep their original `KisanClubFulfilmentAssignment`.** Reassigning the relationship must not silently transfer a half-completed physical handover. Ops reassign in-flight fulfilment separately and explicitly.

---

## 9. Club order flows — Mode A and Mode B

### 9.1 Mode A — Club home delivery

```
Farmer browses /kisan-club/products
   → Club-scoped discovery: existing marketplace query + programme filter
   → each item carries offerPricePaise, clubBenefitPaise, farmerPricePaise (all backend-derived)
        ↓
Adds to the existing cart (Cart.kisanClubContext = true)
        ↓
POST /checkout/from-cart                          ← UNCHANGED endpoint
        ↓
CheckoutService re-validates offers (existing) AND re-evaluates benefits (new)
   → ProductOrder per seller, subtotalPaise gross, farmerPayablePaise net
   → inventory reserved (existing, unchanged)
   → KisanClubBenefitRedemption per discounted line
        ↓
Payment confirmed → order CONFIRMED (existing)
   → FARMER_PAYMENT + CLUB_BENEFIT_SUBSIDY ledger entries
   → NEW: KisanClubFulfilmentAssignment created for the member's primary promoter
        ↓
Distributor fulfilment proceeds exactly as today
   (DISTRIBUTOR_ACCEPTED → PACKED → invoice → READY_FOR_PICKUP → DELIVERED)
        ↓
In parallel, the promoter works the Club assignment
   (ASSIGNED → PROMOTER_ACCEPTED → PRODUCT_READY → FARMER_CONTACTED → COMPLETED)
        ↓
Physical delivery + OTP POD → existing ProductDeliveryAssignment path (D5 option 1)
        ↓
Delivery → recordDeliveryCommission (existing) → PROMOTER_COMMISSION via attribution
```

Only two new side effects in the whole flow: benefit evaluation at checkout, and fulfilment-assignment creation at confirmation. Everything else is existing tested code.

### 9.2 Mode B — assisted purchase at the promoter

```
Farmer taps "Get Club Offer" on a product
        ↓
POST /kisan-club/benefit-tokens { offerId, quantity }
   → server evaluates the benefit, pins the offer and suggested promoter
   → generates plaintext code (VKC-782165), stores ONLY hash+salt
   → returns the plaintext once, plus expiry
        ↓
Farmer visits the promoter and shows/reads the code
        ↓
Promoter (partner app): POST /kisan-club/benefit-tokens/redeem { code, membershipId }
   → hash+compare, check status/expiry/attemptCount
   → RE-DERIVE price and benefit live (never trust quoted values)
   → create cart → checkout → order on the farmer's behalf,
     actor = promoter, subject = farmer, both recorded in the audit log
   → order created with KisanClubFulfilmentMode = ASSISTED_PURCHASE
   → token → REDEEMED, consumedByUserId, productOrderId set
        ↓
Distributor remains seller of record; invoice still issued to the farmer  (C1)
```

**Payment in Mode B is the open question.** If the farmer pays the promoter in cash, the platform has an order whose money never flowed through it. Three options, in order of preference:

1. Farmer pays in-app before or at redemption (keeps the existing payment path intact).
2. A cash-collected flag with a promoter-level COD ledger and settlement — significant new finance work, and `PaymentIntent` currently has no cash mode.
3. Mode B ships as _quote and reserve only_ in the pilot, with in-app payment mandatory.

**Recommendation: option 3 for the pilot, option 2 as a follow-up work package.** Option 2 is not a small addition — it introduces float, reconciliation and promoter liability.

### 9.3 Audit trail for assisted orders

Every assisted order writes an audit record with `actorUserId` = promoter, `actorRole` = `PROMOTER`, resource = the created `ProductOrder`, and a `reason` naming the token. This satisfies `AGENTS.md` §9 and is what makes "the promoter placed this on the farmer's behalf" legible six months later.

---

## 10. Advisory engine

### 10.1 The constraint, restated

`AGENTS.md` §14 prohibits, without explicit approval: _"implement automatic pesticide recommendations, add unapproved AI-generated agronomy advice."_

Brief §28–§31 describe a system that produces pest advisories and maps them to crop-protection products. Those are the same thing. **This is not a technical obstacle to route around — it is a liability boundary.** Wrong agronomic advice at scale damages crops, and in India crop-protection product recommendation is a licensed activity.

### 10.2 What the design does instead

Every advisory a farmer sees is a **human-authored, human-approved, versioned content record** selected by a deterministic rule. There is no generation step anywhere in the pipeline.

```
FarmCropCycle (crop, variety, sowingDate, district, season)
        ↓
daysAfterSowing = today − sowingDate
        ↓
SELECT * FROM AdvisoryRule
  WHERE status = 'APPROVED'
    AND cropName matches
    AND (varietyName IS NULL OR matches)
    AND daysAfterSowing BETWEEN minDaysAfterSowing AND maxDaysAfterSowing
    AND (eligibleDistricts empty OR contains farm district)
    AND (seasons empty OR contains cycle season)
        ↓
AdvisoryEvent per (cropCycle, rule, ruleVersion)   ← unique, never repeats
        ↓
Notification via the existing enqueue → attempt lifecycle
```

Deterministic, explainable, auditable, and every farmer-visible sentence traces to a named approver and an optional `sourceReference` (ICAR package-of-practices, KVK bulletin, etc.).

### 10.3 Approval lifecycle

Mirrors `MasterProduct`'s (`schema.prisma:548`): `DRAFT → PENDING_REVIEW → APPROVED / REJECTED → ARCHIVED`, with `reviewedByUserId`, `reviewedAt`, `reviewReason`. Editing an `APPROVED` rule creates version _n+1_ in `DRAFT` — approved content is never mutated in place, because `AdvisoryEvent.ruleVersion` records what the farmer actually read.

**Who approves.** There is no `AGRONOMIST` role in `PlatformRole` today. Two options:

1. **Recommended:** add `AGRONOMIST` to `PlatformRole` at KC-09. Agronomic sign-off is a distinct professional accountability from catalogue review, and the person who holds it should be identifiable in the audit log. Cost: one enum migration plus permission-matrix rows.
2. Reuse `CATALOGUE_REVIEWER`. Cheaper, but conflates "this listing is compliant" with "this agronomic advice is correct" under one identity — a poor record to have if advice is ever disputed.

### 10.4 The crop-protection hard gate

`AdvisoryProductMapping.isCropProtection` is a **blocking** flag, not a label:

- Setting it requires `agronomistApprovedByUserId` to be non-null; the API rejects the mapping otherwise.
- Serving any mapping with `isCropProtection = true` additionally requires `KISAN_CLUB_ADVISORY_CROP_PROTECTION_ENABLED = true`, which defaults to **false**.
- Both conditions are enforced in the service, not the controller, so no future endpoint can bypass them.

**Recommendation: the Club MVP ships nutrition, irrigation, crop-stage and general-practice advisories only.** Pest and disease advisories ship as _monitoring prompts_ ("check your mustard for aphid activity this week") with **no product attached** — which is genuinely useful, agronomically defensible, and does not constitute a pesticide recommendation. Product-linked crop-protection advisory is deferred pending licensed agronomist sign-off and a legal review, and is tracked as a decision in §18.

This also happens to be the right _product_ decision. Brief §30 and §65 argue the same thing from the trust angle: an advisory that always ends in a product is an advertisement, and farmers learn that fast.

### 10.5 Weather

Weather-conditional advisory (brief §29) requires an external weather provider, which does not exist in the repo — there is no weather env var, provider abstraction or integration. It follows the established mock-provider pattern (`SMS_PROVIDER`, `PAYMENT_PROVIDER`, `TALLY_PROVIDER`) when it is built. **Out of scope for the Club MVP**; the rule engine's day-window matching works without it.

### 10.6 Generation scheduling

Advisory generation is a daily sweep over `ACTIVE` crop cycles. Until BullMQ is wired (WP-04 in the existing plan — `bullmq` is installed but unused), it runs as the manually-triggered `POST /advisory/generate` endpoint plus a cron-invoked CLI. This is honest about being a stopgap rather than pretending a scheduler exists (`AGENTS.md` §7: do not create fake integrations).

---

## 11. Farmer mobile app

### 11.1 New structure

```
apps/farmer-mobile/lib/src/
├── kisan_club/
│   ├── kisan_club_membership_repository.dart
│   ├── kisan_club_catalogue_repository.dart
│   ├── kisan_club_benefit_token_repository.dart
│   ├── kisan_club_models.dart
│   └── kisan_club_presentation.dart        // status → localised label/tone
├── farms/
│   ├── farm_repository.dart
│   └── farm_models.dart
├── advisory/
│   ├── advisory_repository.dart
│   └── advisory_models.dart
└── screens/
    ├── kisan_club_home_screen.dart
    ├── kisan_club_join_screen.dart          // multi-step, resumable
    ├── kisan_club_benefits_screen.dart
    ├── kisan_club_products_screen.dart
    ├── kisan_club_offer_detail_screen.dart
    ├── kisan_club_benefit_token_screen.dart
    ├── my_farms_screen.dart
    ├── farm_detail_screen.dart
    ├── farm_edit_screen.dart
    ├── crop_cycle_edit_screen.dart
    ├── crop_activity_screen.dart
    ├── advisory_list_screen.dart
    ├── advisory_detail_screen.dart
    └── my_promoter_screen.dart
```

Each repository is added as an optional constructor parameter on `FarmerApp` in `app.dart`, matching the existing pattern for all eleven current repositories — without this, widget tests cannot stub Club behaviour.

### 11.2 Routes

Added to `routing/app_routes.dart`:

```dart
static const kisanClub            = '/kisan-club';
static const kisanClubJoin        = '/kisan-club/join';
static const kisanClubBenefits    = '/kisan-club/benefits';
static const kisanClubProducts    = '/kisan-club/products';
static const kisanClubProduct     = '/kisan-club/products/:productId';
static const myPromoter           = '/kisan-club/promoter';
static const farms                = '/kisan-club/farms';
static const farmDetail           = '/kisan-club/farms/:farmId';
static const cropCycle            = '/kisan-club/farms/:farmId/crops/:cycleId';
static const advisories           = '/kisan-club/advisory';
static const advisoryDetail       = '/kisan-club/advisory/:eventId';
```

### 11.3 Entry point and gating

`farmer_dashboard_screen.dart` gains a prominent Club card (brief §4). Its state is driven entirely by `GET /kisan-club/membership/me`:

| Membership state    | Card behaviour                                                    |
| ------------------- | ----------------------------------------------------------------- |
| Not a member        | "Join Kisan Club" → join flow                                     |
| `PENDING_PROFILE`   | "Complete your farm details" → resumes at the incomplete step     |
| `AWAITING_PROMOTER` | Club home, promoter tile shows "We're finding your local partner" |
| `ACTIVE`            | Full Club home                                                    |
| `SUSPENDED`         | Read-only Club home + support entry point                         |

`KISAN_CLUB_ENABLED=false` returns 404 on the membership endpoint and the card is hidden entirely — the same kill switch as the backend.

### 11.4 The join flow

The implemented flow creates the free membership from profile-prefilled terms and independent consent choices, then uses a resumable two-step farm-profile completion flow for the first farm and crop cycle. Each step commits server-side, so an interrupted farmer resumes from authoritative `PENDING_PROFILE` state rather than losing work.

Benefit tokens are issued from Club product detail. The complete bearer code is shown only in the successful issuance dialog; the benefits screen subsequently reads safe metadata only and provides exact backend status filtering plus duplicate-safe pagination. There is deliberately no token-detail route that could recover the secret.

### 11.5 Localisation

Every Club string goes into both `app_en.arb` and `app_hi.arb` (currently 424 keys). Estimate ~180 new keys. `AGENTS.md` §11 requires Hindi and English for the farmer app; a Club screen with hardcoded English is a definition-of-done failure.

Advisory **content** is not app-localised — it is served in the farmer's locale from `AdvisoryRule.titleHi`/`bodyHi`, which is why those columns are non-nullable. A rule cannot be approved without its Hindi text.

### 11.6 Flutter validation

Flutter 3.44.9 is installed. On 2026-08-14 the farmer app passed `flutter analyze --fatal-infos`, all 106 Flutter tests and an Android debug APK build after KC-08 completion. Emulator or physical-device verification, TalkBack/VoiceOver review and iOS compilation remain device/toolchain gates.

---

## 12. Partner mobile app

`apps/partner-mobile` now has Android/iOS runners, OTP authentication, secure session restoration/refresh, partner-only multi-membership selection, English/Hindi localisation and strict routes for promoter, sales-partner, service-provider and delivery-partner contexts. Role dashboards remain intentionally thin until their workflow slices land.

**KC-10's WP-12 shell dependency was satisfied and KC-10 completed on 2026-08-14.** Club repositories and screens remain behind the existing promoter/sales-partner role boundary. Shared KYC/payout-account setup and the delivery workflow remain unfinished parts of the broader WP-12 package.

KC-10A provides `lib/src/kisan_club/` models/repository plus promoter-only assigned-farmer list/detail and token-redemption screens. KC-10B adds own-scope fulfilment list/detail/history and status-valid promoter transitions through `/kisan-club/fulfilment/assignments*`; operations-only cancellation/reassignment remain absent. KC-10C adds assigned-farmer farm and optional current-crop survey submission through `/farms/surveys`, using controlled crop references and intentionally omitting coordinates until an explicit farmer location-consent flow exists. KC-10D adds `/payouts/statements/me` earnings presentation with backend totals, exact status filtering, duplicate-safe pagination, provisional/final/reversed distinctions and the masked `/payouts/accounts/me` status. Payout-account editing remains in the shared WP-12 workflow.

**Data minimisation (`AGENTS.md` §11):** the promoter sees the farmer's name, village, farm size, current crops, assigned order details and last-interaction date. The promoter does **not** see the farmer's full order history across other sellers, payment details, other promoters' farmers, or any commission figure other than their own. Enforced server-side by scoping every promoter read to an `ACTIVE` assignment — never by hiding fields in the app.

---

## 13. Business portal

New `/kisan-club` section in `apps/business-web`, following the existing pattern exactly: server components fetching through `src/lib/marketplace-api.ts`, mutations in a co-located `actions.ts`, nav entry in `src/content/portal-copy.ts` with an `anyPermission` array (the shell at `business-shell.tsx:27-29` already filters nav by permission).

```
apps/business-web/src/app/kisan-club/
├── page.tsx                          Overview dashboard (brief §43)
├── members/page.tsx  members/[id]/page.tsx
├── promoters/page.tsx  promoters/[id]/page.tsx
├── territories/page.tsx
├── programmes/page.tsx               Club product enrolment
├── benefits/page.tsx                 Benefit rules
├── orders/page.tsx                   Club orders + fulfilment assignments
├── advisory/page.tsx  advisory/[ruleId]/page.tsx   Authoring + approval queue
├── intelligence/page.tsx             Crop/acreage intelligence (brief §44)
└── actions.ts
```

The intelligence pages are aggregate queries over `Farm` / `FarmCropCycle` — acreage by crop by district, sowing-window distribution and crop-cycle lifecycle mix — plus current promoter capacity and coordination outcomes. These are genuinely valuable from day one of the pilot and do not require a separate data platform.

Demand _forecasting_ (brief §45) needs conversion history that will not exist until a season has run. KC-12 ships the acreage/stage aggregates; forecasting is deferred and should not be promised in a pilot demo.

---

## 14. Permissions matrix additions

Added to `PermissionCode` in `apps/marketplace-api/src/access/permission-codes.ts`, following the existing `resource:action:scope` naming:

```
kisan-club-membership:read:own        kisan-club-membership:write:own
kisan-club-memberships:read:any       kisan-club-memberships:manage
kisan-club-catalogue:read:own
kisan-club-programmes:manage          kisan-club-benefits:manage
kisan-club-benefit-tokens:create:own  kisan-club-benefit-tokens:read:own
kisan-club-assisted-orders:create
kisan-club-territories:manage         kisan-club-promoter-profiles:manage
kisan-club-assignments:manage
kisan-club-farmers:read:own
kisan-club-fulfilment:read:own        kisan-club-fulfilment:read:any
kisan-club-fulfilment:manage:own      kisan-club-fulfilment:manage:any
kisan-club-intelligence:read
farms:read:own                        farms:write:own
farms:read:any                        farm-surveys:create
advisory:read:own
advisory-rules:manage                 advisory-rules:review
```

Role grants:

| Role                             | Grants                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FARMER`                         | membership read/write own, catalogue read own, benefit tokens create/read own, farms read/write own, advisory read own                                                 |
| `PROMOTER`, `SALES_PARTNER`      | club farmers read own, fulfilment read/manage own, assisted orders create, farm surveys create, farms read any _(scoped to assigned farmers in-service)_               |
| `OPERATIONS_MANAGER`             | memberships read any + manage, programmes, benefits, territories, promoter profiles, assignments, fulfilment read/manage any, intelligence read, advisory rules manage |
| `CATALOGUE_REVIEWER`             | programmes manage (product enrolment is catalogue-adjacent)                                                                                                            |
| `AGRONOMIST` _(new, if adopted)_ | advisory rules manage + review                                                                                                                                         |
| `FINANCE_MANAGER`                | intelligence read (Club subsidy visibility via the existing ledger)                                                                                                    |
| `SUPPORT_AGENT`                  | memberships read any, fulfilment read any — needed to work Club tickets                                                                                                |
| `ADMIN` / `SUPER_ADMIN`          | all, via the existing `allPermissionCodes`                                                                                                                             |

`farms:read:any` for promoters is deliberately **not** a blanket grant: `FarmsService` checks for an `ACTIVE` `KisanClubPromoterAssignment` between actor and subject, following `support.service.ts`'s `ensureCanActOnTicket` OWN-vs-ANY pattern. The permission code says "may read farms that are not their own"; the service decides _which_.

---

## 15. Notifications

New event enums in `notification-events.service.ts`, alongside the existing `FarmerNotificationEvent`, `FarmerOrderNotificationEvent`, `FarmerSupportNotificationEvent`, `FarmerPaymentNotificationEvent`:

```ts
export enum KisanClubFarmerNotificationEvent {
  CLUB_MEMBERSHIP_ACTIVATED,
  CLUB_PROMOTER_ASSIGNED,
  CLUB_PROMOTER_CHANGED,
  CLUB_BENEFIT_TOKEN_ISSUED,
  CLUB_BENEFIT_TOKEN_EXPIRING,
  CLUB_FULFILMENT_ACCEPTED,
  CLUB_FULFILMENT_READY_FOR_PICKUP,
  CLUB_FULFILMENT_COMPLETED,
  CLUB_ADVISORY_PUBLISHED,
  CLUB_OFFER_AVAILABLE,
}

export enum KisanClubPromoterNotificationEvent {
  CLUB_FARMER_ASSIGNED,
  CLUB_ORDER_ASSIGNED,
  CLUB_ASSIGNMENT_REASSIGNED,
  CLUB_FOLLOW_UP_DUE,
}
```

Each needs `LocalizedCopy` in English and Hindi, following the existing structure. Delivery uses the existing enqueue → attempt lifecycle unchanged; real SMS/WhatsApp/push arrives with WP-06.

`CLUB_OFFER_AVAILABLE` is **marketing** and must respect `marketingConsent`; everything else is transactional and does not. Conflating the two is the fastest way to a consent complaint.

---

## 16. Testing plan

Per `AGENTS.md` §12, and following existing naming (`test/integration/*.spec.ts`, one file per slice):

**Unit** — `promoter-matching.service.spec.ts` (the scoring tuple, exhaustively), `kisan-club-benefit.service.spec.ts` (every benefit type, cap, precedence, rounding), `kisan-club-fulfilment.service.spec.ts` (transition guard), `advisory-rule-matching.spec.ts` (day windows, boundaries, region/season filters).

**Integration** —

| Spec                            | Covers                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `kisan-club-membership.spec.ts` | Join, consent granularity, resumable profile, close, suspend                                                                          |
| `kisan-club-farms.spec.ts`      | Farm/crop CRUD, promoter survey ownership rules, farmer overrides promoter entry                                                      |
| `kisan-club-assignment.spec.ts` | Matching precedence, no-eligible-promoter path, reassignment + attribution linkage                                                    |
| `kisan-club-catalogue.spec.ts`  | Only programme-enrolled Vardhnam products appear; region/window filtering; a non-Vardhnam product cannot be enrolled                  |
| `kisan-club-benefits.spec.ts`   | **Highest priority.** Pricing invariant, ledger reconciliation, usage limits under concurrent checkout, distributor payable unchanged |
| `kisan-club-tokens.spec.ts`     | Issue/redeem/expire/replay, hash-not-plaintext, live re-derivation on redemption                                                      |
| `kisan-club-fulfilment.spec.ts` | Assignment lifecycle, illegal transitions rejected, independence from `ProductOrderStatus`                                            |
| `advisory.spec.ts`              | Independent approval, consent gating, deterministic matching, localisation, owner isolation and no duplicate events per version       |
| `kisan-club-refunds.spec.ts`    | **Critical.** Refund equals what the farmer paid, not list price; subsidy reversed pro-rata                                           |

**Regression guard:** `mvp-acceptance.spec.ts` must keep passing untouched. If a Club change forces an edit to it, the "add, don't redefine" rule (D3) has been broken somewhere.

**Integration isolation:** `test/integration/setup.ts` invokes the shared dedicated-test-database truncation helper before the suite. The helper refuses to run unless `DATABASE_URL` names a test database.

---

## 17. Work packages KC-01 … KC-12

Numbered `KC-*` to avoid collision with the existing `WP-01 … WP-16` in `docs/REMAINING_IMPLEMENTATION_PLAN.md`. Estimates are for one experienced full-stack developer.

| ID        | Package                                                                                                                  | Depends on              | Estimate                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KC-01** | Club foundation: membership, consent, member numbers, kill switch, permissions, test-isolation fix                       | —                       | **Completed 2026-08-11**                                                                                                                                                                                |
| **KC-02** | Farm and crop registry (`src/farms/`), crop reference table, activity diary                                              | KC-01                   | **Implemented 2026-08-11; DB integration run pending test environment**                                                                                                                                 |
| **KC-03** | Territories, Club promoter profiles, matching engine, assignment + attribution linkage, reassignment                     | KC-01                   | **Implemented 2026-08-11; DB integration run pending test environment**                                                                                                                                 |
| **KC-04** | Club catalogue: programme model, Vardhnam-ownership validation, Club-scoped discovery                                    | KC-01                   | **Implemented 2026-08-11; DB integration run pending test environment**                                                                                                                                 |
| **KC-05** | **Club pricing and finance.** Benefit rules, evaluation service, checkout integration, subsidy ledger, refund correction | KC-04                   | **Implemented 2026-08-11; DB integration run pending test environment**                                                                                                                                 |
| **KC-06** | Club fulfilment assignments: model, state machine, promoter endpoints, auto-creation on order confirmation               | KC-03, KC-05            | **Completed; dedicated-database HTTP coverage verified 2026-08-14**                                                                                                                                     |
| **KC-07** | Benefit tokens and Mode B assisted purchase                                                                              | KC-05, KC-06            | **Implemented 2026-08-12; DB integration run pending test environment**                                                                                                                                 |
| **KC-08** | Farmer app Club module: join flow, Club home, catalogue, farms, promoter, tokens, l10n                                   | KC-01…KC-07, **WP-02**  | **Completed 2026-08-14: bilingual membership/join/profile completion, catalogue and commerce reuse, farms/crops/diary/harvest, promoter, advisories, one-time token issuance and filtered paginated token history are Flutter-verified** |
| **KC-09** | Advisory: rule authoring + approval, matching, events, notifications, `AGRONOMIST` role                                  | KC-02                   | **Completed 2026-08-13; portal, farmer UI and dedicated-database HTTP acceptance coverage verified**                                                                                                    |
| **KC-10** | Partner app Club module                                                                                                  | KC-06, KC-07, **WP-12** | **Completed and Flutter-verified 2026-08-14: KC-10A farmer/redemption, KC-10B own-scope fulfilment, KC-10C assigned-farmer survey and KC-10D recipient-scoped earnings statement**                         |
| **KC-11** | Business portal Club section: members, promoters, programmes, benefits, orders, advisory queue                           | KC-01…KC-07, KC-09      | **Completed 2026-08-14: permission-scoped advisory, member, network, commercial and fulfilment workspaces implemented**                                                                                 |
| **KC-12** | Crop intelligence dashboards, promoter performance metrics, forecasting groundwork                                       | KC-02, KC-11            | **Completed 2026-08-14: aggregate APIs, portal and dedicated-database coverage; forecasting remains deferred**                                                                                          |

**Total: ~31 weeks solo (~7 months)**, assuming WP-02 and WP-12 are already done. Realistic range **28–36 weeks**.

### Suggested sequencing

**Stage A — pilot-viable backend (KC-01 → KC-07, ~13.5 weeks).** Ends with a working Club: a farmer can join, register a farm, see Vardhnam-only products at a Club price, order, and have a promoter assigned and coordinating. Testable entirely through the API and integration specs, with no mobile dependency.

**Stage B — farmer-facing (KC-08, KC-11, ~7.5 weeks).** Requires WP-02 (Flutter verification) to have landed.

**Stage C — advisory and promoter app (KC-09, KC-10, ~6 weeks).** KC-09 and KC-10 are complete; remaining work belongs to the broader shared partner and delivery/service-provider roadmap rather than the Club module.

**Stage D — intelligence (KC-12, ~2 weeks).**

**A pilot could launch after Stage B** with promoters using the business portal instead of the partner app — a legitimate way to start in Etah/Aliganj without waiting for WP-12. That is the fastest honest path to a live Club.

### Documentation deliverables (`AGENTS.md` §7 and §12)

- ADRs: `0005-kisan-club-layering.md` (D1, D2), `0006-club-benefit-funding-model.md` (D3), `0007-advisory-content-governance.md` (D6, D7).
- `docs/API_CONTRACTS.md` — already stops at Phase 4E; Club endpoints must be added rather than extending the gap.
- `docs/DATA_MODEL.md`, `docs/BUSINESS_RULES.md` — Club rules as numbered entries.
- `docs/PRODUCT_REQUIREMENTS.md` — a Kisan Club section, since it is authoritative.

---

## 18. Risks and decisions needing business sign-off

Ordered by how much they block or endanger the build.

1. **Who funds the Club discount.** §7 assumes Vardhnam bears it (platform-borne, mirroring promoter commission). If the business intends distributors to fund it, that is a different ledger treatment _and_ requires distributor consent capture on the offer. **Blocks KC-05.**

2. **Whether promoters physically deliver.** KC-06 implements promoter coordination only. If promoters later physically deliver (Mode A as written in brief §20), they need `DELIVERY_PARTNER` membership, KYC and payout treatment, and the existing OTP/POD path applies. Until that approval, distributors/delivery partners deliver and promoters coordinate. **Blocks physical promoter delivery, not the KC-06 coordination record.** Recommendation: dual membership.

3. **Mode B payment.** Cash collected by a promoter creates float, reconciliation and liability the platform does not currently model. Recommendation: pilot with in-app payment only. **Blocks KC-07 scope.**

4. **Crop-protection advisory.** `AGENTS.md` §14 prohibits automatic pesticide recommendations. Shipping product-linked pest advisory needs licensed agronomist sign-off, legal review and an explicit approval recorded as an ADR. Recommendation: MVP ships monitoring prompts with no product attached. **Constrains KC-09.**

5. **Club promoter commission rate.** `DEFAULT_PROMOTER_COMMISSION_BPS` is 0 pending approval, and has been since Phase 6. A Club that promises promoter earnings and pays zero will not retain promoters. **Needed before pilot, not before build.**

6. **Farm data, consent and the DPDP Act.** Farm location, acreage and crop data are personal data used for a commercial purpose. Granular consent (D7) is designed in, but retention periods, deletion-on-request, and whether farm data survives membership closure are policy decisions this plan cannot make. Recommendation: legal review before the pilot collects real farmer data. Note `AGENTS.md` §14 already prohibits using real farmer data in development.

7. **`cropName` free text vs a crop reference table.** Free text will degrade every aggregate in brief §44–46. Recommendation: reference table at KC-02, where it costs almost nothing.

8. **Whether to add an `AGRONOMIST` role.** §10.3. Recommendation: yes.

9. **Member number enumerability.** `VKC-ETAH-001245` is guessable. Mitigated by never accepting it as a lookup key on non-staff endpoints (§5.1), but the business should know the district and approximate join order are inferable from a number farmers will share freely.

10. **Advisory correctness liability.** Even approved, human-authored advice can be wrong for a specific field. Recommendation: every advisory carries a visible disclaimer and a "talk to your promoter" action, and `sourceReference` is mandatory for anything beyond generic crop-stage information.

11. **Scope honesty.** The brief describes four phases ending in insurance, financing and crop marketing. This plan covers Phase 1 and part of Phase 2 (§57–58). Phases 3 and 4 are multi-year and should not appear in a pilot commitment.

---

## 19. Explicitly out of scope for the Club MVP

Named here so they are visibly deferred rather than quietly dropped:

- **Crop Doctor / photo diagnosis** (brief §34) — needs image storage (WP-08) and an image model, and would run straight into the AI-agronomy prohibition.
- **Weather-conditional advisory** (§29) — needs a weather provider that does not exist.
- **Demand forecasting** (§45–46) — needs conversion history from at least one completed season. KC-12 ships acreage and crop-stage aggregates only.
- **Loyalty points / Kisan Points** (§37) — a points economy is its own ledger. Also, as the brief itself notes, paying for data entry invites fake data.
- **Demonstration farmers** (§38) — a field-operations programme, not primarily software.
- **Referral rewards** (§39) — the referral _link_ is modelled (`referredByMembershipId`); the reward is not, pending a decision on what triggers it.
- **Membership tiers** (§49) — one free tier at launch.
- **Distributor-funded Club offers** — deferred alternative under D3.
- **Cash-collected assisted purchase** — §9.2 option 2.
- **Service marketplace integration** (drone spraying, soil testing — brief §60) — depends on WP-14, which has not started.

---

## Appendix — summary of changes to existing code

| File                                                             | Change                                                                                                                            | Risk                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `prisma/schema.prisma`                                           | ~18 new models, 2 enum values, ~10 additive fields, backfill migration                                                            | Medium — backfill must be two-step                      |
| `checkout/checkout.service.ts`                                   | Benefit evaluation in `prepareCartItemsForCheckout`; `farmerPayablePaise` + redemption rows in `createChildOrderWithReservations` | **High — most correctness-critical code in the system** |
| `payments/payments.service.ts`                                   | Charge `farmerPayablePaise`; emit `CLUB_BENEFIT_SUBSIDY`                                                                          | Medium                                                  |
| `refunds/refunds.service.ts`                                     | Refund what was paid, not list price; reverse subsidy pro-rata                                                                    | **High — money bug risk**                               |
| `finance/finance.service.ts`                                     | New ledger entry type only; commission math untouched                                                                             | Low                                                     |
| `promoters/promoters.service.ts`                                 | Called by Club assignment; attribution logic unchanged                                                                            | Low                                                     |
| `marketplace/marketplace.service.ts`                             | Optional programme filter on `findCandidateOffers`                                                                                | Low                                                     |
| `notifications/notification-events.service.ts`                   | Two new event enums + localised copy                                                                                              | Low                                                     |
| `access/permission-codes.ts`                                     | ~26 new codes + role grants                                                                                                       | Low                                                     |
| `config/env.schema.ts`                                           | 5 new vars, all defaulting to off/zero                                                                                            | Low                                                     |
| `cart/cart.service.ts`                                           | Benefit snapshot on cart lines (display only)                                                                                     | Low                                                     |
| `dashboards/dashboards.service.ts`                               | Club counts in the scoped summary                                                                                                 | Low                                                     |
| `business-web` `portal-copy.ts` + shell                          | Nav entry                                                                                                                         | Low                                                     |
| `farmer-mobile` `app.dart`, `app_routes.dart`, both `.arb` files | DI wiring, routes, ~180 keys                                                                                                      | Medium — unverifiable until WP-02                       |

The two **High** rows are where review effort should concentrate. Everything else is additive.
