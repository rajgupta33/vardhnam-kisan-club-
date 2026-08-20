# Vardhnam Farmer App — Codex UI Implementation Blueprint

**Document status:** UI implementation specification  
**Target application:** `apps/farmer-mobile`  
**Primary platform:** Android-first Flutter application  
**Brand:** Vardhnam Agro / Vardhnam Farmer  
**Programme:** Vardhnam Kisan Club  
**Implementation rule:** This document defines the visual/UI layer. Existing backend business rules, permissions, pricing, inventory, seller-of-record logic, authentication, order state, and API contracts remain authoritative.

---

## 1. Purpose

The Vardhnam Farmer application is no longer to be treated visually as a generic agriculture marketplace.

The UI should position the app as a **trusted farmer utility and relationship platform** combining:

1. My Farm
2. Crop advisory
3. Crop Doctor / problem help
4. Vardhnam Kisan Club
5. Local Vardhnam promoter support
6. Agriculture marketplace
7. Orders and support

The intended design direction is:

> **Modern, trustworthy Indian agricultural utility — not a discount shopping app.**

The app should feel simple enough for a farmer who is not highly comfortable with smartphones, while still looking premium, clean and professional.

---

# 2. Core UI Principles

Codex must follow these principles throughout the app.

## 2.1 Farm first, commerce second

The application should not open like an e-commerce catalogue.

The first screen should communicate:

- farmer identity/location;
- current farm/crop status;
- important advisory;
- Kisan Club;
- quick help;
- active orders;
- only then selected products.

Products remain easy to access through the dedicated **Shop** tab.

---

## 2.2 Simple choices

Avoid screens with 12–15 equally important tiles.

A normal screen should have:

- one clear primary action;
- at most 2–4 secondary actions;
- progressive disclosure for advanced details.

---

## 2.3 Large farmer-friendly touch areas

Minimum interactive target:

- **48dp × 48dp**
- Primary buttons: preferably **52–56dp high**
- Important cards should have generous vertical spacing.

Never use tiny text links as the only way to complete an important action.

---

## 2.4 Hindi and English are equal first-class interfaces

Do not hardcode strings inside widgets.

Continue using the existing generated localization / ARB infrastructure.

UI must support:

- English
- Hindi
- long Hindi labels
- 200% text scaling without overflow

Avoid designing around English-only text lengths.

---

## 2.5 Do not turn the app into a banner feed

Use imagery only where it adds meaning.

Avoid:

- excessive promotional banners;
- rotating carousels on every screen;
- “flash deal” visuals;
- crowded advertisement layouts.

Use whitespace and information hierarchy instead.

---

# 3. Brand System

The supplied Vardhnam Agro logo contains:

- strong green;
- secondary leaf green;
- saffron/orange;
- white.

The full circular logo remains the official brand mark.

For small UI usage, Codex should support a simplified icon placeholder that can later contain only the **V + leaf symbol** if that asset is generated.

---

## 3.1 Primary Brand Colors

Define colors through Flutter theme tokens rather than scattering raw hex values across widgets.

Suggested initial palette:

```dart
class VardhnamColors {
  static const primaryGreen = Color(0xFF158A3D);
  static const primaryGreenDark = Color(0xFF0D6F31);
  static const leafGreen = Color(0xFF5BAD42);
  static const saffron = Color(0xFFE8892F);

  static const background = Color(0xFFF8FAF7);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceGreen = Color(0xFFF0F8F1);
  static const surfaceOrange = Color(0xFFFFF5E9);

  static const textPrimary = Color(0xFF1E2821);
  static const textSecondary = Color(0xFF607064);
  static const border = Color(0xFFE1E8E2);

  static const success = Color(0xFF238B45);
  static const warning = Color(0xFFE58A23);
  static const error = Color(0xFFC83A3A);
}
```

These values are starting design tokens. If the project already has approved design tokens, merge carefully instead of duplicating systems.

---

## 3.2 Color Usage Ratio

Approximate visual balance:

- 65–75% white / warm neutral backgrounds
- 15–20% green
- 5–10% secondary green
- 5–10% saffron/orange accent

Orange must be used for:

- Kisan Club benefit badges;
- selected promotional highlights;
- warning emphasis where appropriate;
- small accent details.

Do not use orange as the dominant page background.

---

# 4. Typography

Use a clean, highly readable sans-serif system.

Preferred:

- English: **Inter** or **Noto Sans**
- Hindi: **Noto Sans Devanagari**

If adding font files is undesirable, use a compatible system/default font family with excellent Devanagari support.

Recommended scale:

```text
Display / large hero:     28–30sp, 700
Page title:               22–24sp, 700
Section heading:          18–20sp, 600/700
Card title:               16–18sp, 600
Body:                     15–16sp, 400/500
Supporting text:          13–14sp, 400
Badge:                    12–13sp, 600
```

Do not use body text smaller than 13sp for important farmer-facing information.

---

# 5. Layout System

## 5.1 Screen padding

Default mobile horizontal padding:

```text
16dp
```

Large section vertical spacing:

```text
24dp
```

Normal card-to-card spacing:

```text
12–16dp
```

Small internal spacing:

```text
8dp
```

---

## 5.2 Corner radius

Use consistently:

```text
Primary cards:        16dp
Secondary cards:      14dp
Buttons:              12–14dp
Inputs:               12dp
Pills/badges:         999dp / fully rounded
Modal sheets:         24dp top corners
```

Avoid applying 28–32dp radius to every component.

---

## 5.3 Elevation

Prefer:

- 1px-like border
- very subtle Material elevation
- minimal shadows

Do not use large grey shadows.

---

# 6. Flutter Theme Architecture

Create or extend:

```text
lib/app/theme/
  vardhnam_colors.dart
  vardhnam_spacing.dart
  vardhnam_radius.dart
  vardhnam_typography.dart
  vardhnam_theme.dart
```

Recommended theme extensions for reusable tokens.

Do not place raw UI tokens repeatedly inside feature widgets.

---

# 7. Shared Components to Build First

Codex should create a reusable component library before redesigning screens.

Suggested location:

```text
lib/core/widgets/
```

Build:

```text
VardhnamScaffold
VardhnamAppBar
VardhnamPrimaryButton
VardhnamSecondaryButton
VardhnamTextButton
VardhnamSectionHeader
VardhnamInfoCard
VardhnamStatusChip
VardhnamAlertCard
VardhnamEmptyState
VardhnamErrorState
VardhnamSkeleton
VardhnamImageFrame
VardhnamPromoterCard
VardhnamCropCard
VardhnamProductCard
VardhnamAdvisoryCard
VardhnamBottomNavigation
```

Every important reusable component needs widget tests.

---

# 8. IMAGE PLACEHOLDER POLICY — IMPORTANT

## Codex must NOT generate final imagery

The final crop, farmer, advisory, product lifestyle, Kisan Club and onboarding images will be generated separately.

Codex must:

1. create correctly sized placeholder frames;
2. preserve the required aspect ratio;
3. place a neutral placeholder icon or local placeholder asset;
4. expose semantic/accessible labels;
5. avoid hardcoding remote stock-image URLs;
6. make it easy to replace the placeholder with a real local or remote image later;
7. never stretch an image;
8. use `BoxFit.cover` for lifestyle/crop photography;
9. use `BoxFit.contain` for product PNGs and logos.

---

## 8.1 Shared Image Frame Widget

Create:

```dart
class VardhnamImageFrame extends StatelessWidget {
  final double aspectRatio;
  final String semanticLabel;
  final String? imageUrl;
  final String? assetPath;
  final BoxFit fit;
  final BorderRadius borderRadius;
  final Widget? placeholder;

  // ...
}
```

Behavior:

- If `assetPath` exists, show asset.
- Else if `imageUrl` exists and succeeds, show network image using the approved image-loading architecture.
- Else show a neutral branded placeholder.
- Always maintain the requested aspect ratio.
- Handle loading, broken image and offline states intentionally.

Do not silently collapse the frame if no image exists.

---

# 9. App Navigation

Use five bottom-navigation destinations:

```text
1. Home
2. Shop
3. Kisan Club
4. Orders
5. Account
```

Kisan Club must be the **centre destination**.

Do not create an oversized floating action button.

It may have:

- slightly stronger icon treatment;
- circular soft-green background when active;
- a small `FREE` indicator only on the Kisan Club landing/join surface, not permanently in bottom navigation.

Use icon + text for every destination.

Never use icon-only navigation.

---

# 10. Main Home Screen

## Route

Use the existing authenticated main shell route structure.

Suggested UI feature:

```text
features/home/
```

---

## 10.1 App Bar

Top area:

```text
[V icon/logo]   Namaste, {farmerName}         [notification icon]
                {selectedLocation} ▼
```

If farmer is not authenticated:

- use friendly generic greeting;
- do not show private farm data;
- maintain public discovery behavior according to existing authorization rules.

---

## 10.2 Weather Summary Card

Compact, not a full weather dashboard.

Example:

```text
29°C
Rain chance 30%
Today's farm conditions
```

If no weather provider is currently wired:

- keep this module behind an explicit placeholder/state;
- do not fake live weather.

---

## 10.3 Kisan Club Hero Card

This is one of the most important Home modules.

For non-member:

```text
VARDHNAM KISAN CLUB
100% FREE

Free crop support
Local Vardhnam promoter
Special Vardhnam product benefits

[Join Kisan Club]
```

For member:

```text
VARDHNAM KISAN CLUB

My Crop Advisory
Your Promoter
Club Benefits

[Open Kisan Club]
```

Use a large image placeholder on the right or background edge.

Do not overcrowd the card.

---

## 10.4 Quick Actions

Maximum 3–4 actions.

Recommended:

```text
Crop Doctor
My Crops
Ask / Contact Promoter
Support
```

Use simple line/filled icons.

---

## 10.5 Active Crop Card

Example:

```text
MUSTARD
Main Farm
3.8 acres • Day 42

Flowering Stage

Important today
Check aphid activity

[View Crop]
```

If the farmer has multiple active crops:

- show one primary crop card;
- offer “View all crops”;
- avoid horizontal carousels with more than 3 items.

---

## 10.6 Active Orders Summary

Show only when there is an active order.

Example:

```text
Your Order
VM Lakshmi-1246
Out for delivery
[Track]
```

Do not duplicate the full Orders page.

---

## 10.7 Recommended Products

Home should have **one small product section only**.

Maximum initial visible products: 4.

Link to Shop for the full catalogue.

---

# 11. Kisan Club — Non-Member Landing Screen

## Route

```text
/kisan-club
```

If not enrolled, show Join screen.

---

## 11.1 Layout

Recommended order:

1. hero image placeholder
2. title
3. `100% FREE` badge
4. concise value statement
5. four benefits
6. primary Join button
7. privacy/terms link

Example copy intent:

```text
Vardhnam Kisan Club

A free farmer-support programme from Vardhnam.

• Crop advisory
• Local promoter support
• Special Vardhnam benefits
• Farm and crop assistance

[Join Kisan Club]

No membership fee.
```

Do not use words like:

- Premium plan
- Subscription
- Upgrade
- Paid membership

The Club is completely free.

---

# 12. Kisan Club Registration UX

Do not implement one long form.

Use a stepped flow.

Suggested routes:

```text
/kisan-club/join/basic
/kisan-club/join/farm
/kisan-club/join/crop
/kisan-club/join/confirm
```

or one stateful guarded flow if routing becomes unnecessarily complex.

---

## Step 1 — Basic Information

Reuse existing farmer profile data where available.

Fields:

```text
Name
Village
District
State
Pincode
Preferred language
```

Do not ask the farmer to re-enter known data unless confirmation is required.

---

## Step 2 — Farm

Fields:

```text
Farm name (optional friendly name)
Area
Area unit
Owned / leased / managed
Village/location
Optional location assistance
Irrigation type if approved in backend model
```

GPS remains optional and consent-based.

---

## Step 3 — Crop

Fields:

```text
Crop
Crop variety (if known)
Area
Sowing date
Season
```

Use searchable bottom sheets for long crop/variety lists.

Do not present 100 crop choices in a giant dropdown.

---

## Step 4 — Confirmation

Show:

```text
Farmer
Farm
Crop
Area
Location

Advisory consent
Kisan Club terms

[Join Kisan Club]
```

After successful server response:

```text
Welcome to Vardhnam Kisan Club
```

Do not show success until backend confirms.

---

# 13. Kisan Club Member Dashboard

## Header

```text
Kisan Club
{farmerName}
Member ID
```

Do not overemphasize the membership ID.

---

## Modules in this order

### 1. My Crop

Primary active crop card.

### 2. Today's Advisory

One high-priority advisory.

### 3. Crop Problem?

Large camera CTA.

### 4. Your Vardhnam Promoter

Local support card.

### 5. Kisan Club Benefits

Vardhnam-only products and current benefit.

### 6. My Farms

Link to full farm/crop management.

---

# 14. Promoter Card

Build a reusable component.

Layout:

```text
Your Vardhnam Promoter

[photo]
Rahul Sharma
Verified Vardhnam Promoter
Aliganj
2.3 km away

[Call] [WhatsApp] [Directions]
```

Requirements:

- photo placeholder if no promoter photo;
- verified indicator only when authoritative backend data confirms it;
- do not fabricate distance;
- if distance unavailable, show territory/location text instead;
- phone/WhatsApp actions use existing validated support/launcher patterns;
- Directions only when valid destination coordinates/address exist.

---

# 15. My Farms Screen

## Route

```text
/farms
```

Show vertically stacked farm cards.

Example:

```text
Main Farm
Aliganj • 4.5 acres

Mustard — 3 acres
Wheat — 1.5 acres

[View Farm]
```

Primary action:

```text
+ Add farm
```

Avoid dense table layouts.

---

# 16. Farm Detail

Show:

1. farm name
2. location
3. acreage
4. active crops
5. previous crop cycles
6. add crop

Example:

```text
Main Farm
4.5 acres
Aliganj, Etah

Current Crops

Mustard
3 acres
Day 42
Flowering

Wheat
1.5 acres
Day 20
Tillering
```

---

# 17. Crop Detail / Crop Health Dashboard

This is a flagship screen.

## Header

```text
Mustard
Main Farm
3 acres
Day 42
Flowering Stage
```

Use a crop image placeholder.

---

## 17.1 Today

Show only the most relevant actions:

```text
Today

Aphid monitoring
No irrigation required
Weather suitable
```

Use status icons and short descriptions.

---

## 17.2 Next 7 Days

Use a simple vertical timeline.

Example:

```text
Today       Monitor aphids
Tomorrow    Irrigation review
Day 3       Nutrition check
Day 6       Crop-stage update
```

Do not build a complex calendar grid for the MVP.

---

## 17.3 Crop Doctor CTA

Large button/card:

```text
Problem in your crop?
Take a photo for help

[Check Crop]
```

---

## 17.4 Suggested Vardhnam Solutions

Only show if the advisory/product-mapping backend supports it.

Never fabricate recommendations on the client.

---

# 18. Advisory Detail Screen

Advisory must not look like a blog article.

Order:

```text
1. Severity / importance
2. What is happening?
3. What should the farmer do?
4. When should they act?
5. Optional relevant solution
6. Contact promoter / expert
```

Example:

```text
IMPORTANT TODAY

Aphid Risk
HIGH

Why?
Short explanation.

What you should do

1. Inspect 10–15 plants.
2. Check the underside of young leaves.
3. Follow treatment guidance if infestation is visible.

[See Suitable Solution]
[Contact Promoter]
```

Keep first-view content concise.

Advanced technical detail can expand using accordions.

---

# 19. Crop Doctor

## Route

```text
/crop-doctor
```

### Entry screen

```text
Problem in your crop?

Take a clear photo of the affected crop.

[Take Photo]
[Choose from Gallery]
```

If photo-upload/diagnosis backend does not exist:

- display this feature only behind the approved feature flag;
- do not create fake AI results;
- Codex may implement UI shell with explicit “Coming soon”/development state only if product owner approves.

---

## 19.1 Photo Guide

Use 2–3 visual placeholder frames.

Text:

```text
Good photo:
• affected leaf visible
• good daylight
• close enough to see damage
```

---

## 19.2 Diagnosis Result

Only render authoritative result from backend/provider.

Layout:

```text
Possible Problem
Mustard Aphid

Confidence
High

Severity
Medium

What to do now
...
```

Never convert probability to “confirmed diagnosis” unless backend says confirmed.

---

# 20. Shop Screen

Shop remains a full marketplace.

## Top

```text
Delivering to
{pincode/location}

Search products...
[microphone icon only if voice-search functionality exists]
```

Do not show non-working microphone icon.

---

## Sections

Recommended:

```text
Shop by Crop
Shop by Need
Categories
Brands
Recommended for Your Crops
All Products
```

Maintain backend-authoritative pincode/crop/category/brand filters.

Do not create a hardcoded duplicate taxonomy in Flutter.

---

# 21. Product Card

Reusable card should contain:

```text
[product image placeholder]

Brand
Product Name
Pack Size

₹price
Availability / delivery hint

[View]
```

If in Kisan Club context:

```text
Kisan Club Benefit
```

Do not display fake percentage discounts.

---

# 22. Product Detail

Order:

1. image gallery placeholder
2. product name / brand
3. pack/variant
4. backend price
5. seller/distributor identity
6. delivery SLA
7. stock state
8. crop/use information
9. product documents if available
10. add to cart

The legal seller must remain unambiguous.

Do not visually present Vardhnam or the brand owner as seller unless backend says so.

---

# 23. Kisan Club Product Presentation

Within Kisan Club:

- show only Club-eligible Vardhnam products returned by backend;
- use `Kisan Club Benefit` badge;
- explain why relevant when authoritative mapping exists.

Example:

```text
VM NIDHI
Vardhnam Mustard Seed

Suitable for:
Your registered mustard crop

Kisan Club Benefit
Member Price ₹X
Regular Price ₹Y
You save ₹Z
```

All savings are calculated by backend.

---

# 24. Orders UI

Retain current backend child-order model.

List card:

```text
Order #...
Seller: {distributor}
Status
Order date
Total
[Track]
```

Use clear farmer-readable status copy.

Avoid showing internal enum names directly.

---

# 25. Notifications

Notification list should visually separate:

```text
Orders
Kisan Club
Advisory
Support
Returns
```

Potential advisory icon categories:

```text
Weather
Irrigation
Crop Stage
Pest Risk
Disease Risk
Nutrition
Harvest
```

Only use categories supported by backend events.

---

# 26. Account Screen

Recommended sections:

```text
Profile
My Farms
Addresses
Language
Kisan Club
Support
Notifications
Legal & Privacy
Logout
```

Avoid presenting the account screen as a giant grid.

Use grouped list rows.

---

# 27. Empty States

Every important screen requires designed empty state.

Examples:

### No farms

```text
Add your first farm
Get crop-specific advisory and better recommendations.

[Add Farm]
```

### No active crop

```text
No active crop added
Add your current crop to receive advisory.

[Add Crop]
```

### No orders

```text
No orders yet
Browse products available in your area.

[Go to Shop]
```

Each empty state may contain an image placeholder defined in the asset list below.

---

# 28. Loading States

Use skeletons instead of centered spinners for primary feed/detail content.

Allowed use of spinner:

- short blocking mutation;
- button progress;
- page bootstrap where no shape is known.

Skeletons must preserve approximate final layout.

---

# 29. Error States

Use farmer-friendly messages.

Never expose runtime exception strings.

Example:

```text
We could not load your crop details.

[Try Again]
```

Preserve request/reference ID only where useful for support.

---

# 30. Offline States

Continue the existing bounded cached-discovery behavior.

For stale product data:

```text
Showing saved results from 2 hours ago.
Price and stock may have changed.
```

No commerce mutation should proceed as if cached stock is live.

---

# 31. Accessibility

Codex must preserve or improve existing accessibility work.

Requirements:

- ≥48dp targets
- semantic labels
- keyboard/focus order on forms
- screen-reader labels
- contrast-safe text
- 200% text scaling
- no important meaning conveyed by color only
- every image placeholder has semantic label or is marked decorative
- buttons use meaningful labels, not “Click here”

---

# 32. Animation

Use subtle animation only.

Allowed:

- 150–250ms state transitions
- small card expansion
- skeleton shimmer if existing design system supports it
- bottom-sheet transitions

Avoid:

- excessive bouncing
- large parallax
- autoplay promotional animations
- confetti on routine actions

A small success animation may be used when joining Kisan Club, but must not block navigation.

---

# 33. Responsive Baseline

Design primarily for Android widths:

```text
360dp
390dp
412dp
```

UI must remain usable down to approximately:

```text
320dp
```

Do not position elements with fixed pixel coordinates.

Use:

- `LayoutBuilder`
- `Flexible`
- `Expanded`
- wrapping rows
- adaptive bottom sheets

Avoid horizontal overflow in Hindi.

---

# 34. Suggested Feature Folder Additions

Do not reorganize already-working features unnecessarily.

For new UI:

```text
features/
  home/
  kisan_club/
  farms/
  crop_cycles/
  advisory/
  crop_doctor/
```

Each feature should follow the existing app architecture:

```text
presentation/
application/
domain/
data/
```

or the currently established equivalent.

Do not introduce a second architecture pattern.

---

# 35. UI State Management

Continue Riverpod.

UI widgets should not:

- call HTTP directly;
- calculate authoritative price;
- decide seller eligibility;
- infer membership from local state only;
- fabricate advisory.

Repositories/providers must expose typed states:

```text
loading
data
empty
offline/stale
error
```

---

# 36. Navigation

Continue `go_router`.

Use named routes.

Deep links from notifications must verify ownership through backend APIs.

Do not trust resource IDs from a notification without server authorization.

---

# 37. Analytics Events

Do not log sensitive field contents.

Safe event examples:

```text
home_opened
kisan_club_opened
kisan_club_join_started
kisan_club_join_completed
farm_add_started
crop_add_completed
advisory_opened
crop_doctor_opened
promoter_call_tapped
shop_opened
product_viewed
```

Never log:

- phone number
- OTP
- tokens
- precise farm coordinates
- full addresses
- crop-diagnosis images

without an approved analytics/privacy policy.

---

# 38. IMAGE ASSET REQUIREMENT LIST

## Important

Codex must create placeholder frames for all assets below.

**The final images will be generated separately by ChatGPT.**

Do not use random online stock images.

Do not permanently ship placeholder artwork as final production content.

The generated source dimensions below are the required master asset dimensions.

Flutter should scale/crop responsively from these masters.

---

## A. Branding

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit | Use |
|---|---|---:|---:|---|---|---|
| BR-01 | `vardhnam_logo_full.png` | **1024 × 1024 px** | 1:1 | PNG transparent | contain | Splash/About/official logo |
| BR-02 | `vardhnam_v_leaf_mark.png` | **512 × 512 px** | 1:1 | PNG transparent | contain | Small UI mark/app icon base |
| BR-03 | `vardhnam_wordmark_horizontal.png` | **1200 × 320 px** | 3.75:1 | PNG transparent | contain | Optional wide headers |

Codex should leave placeholders for BR-02 and BR-03 if they are not yet supplied.

---

## B. Home Screen

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit | Use |
|---|---|---:|---:|---|---|---|
| HM-01 | `home_kisan_club_hero.webp` | **1200 × 600 px** | 2:1 | WebP | cover | Kisan Club card on Home |
| HM-02 | `home_farmer_farm_context.webp` | **1200 × 720 px** | 5:3 | WebP | cover | Optional home/farm hero |
| HM-03 | `home_crop_advisory_visual.webp` | **1080 × 720 px** | 3:2 | WebP | cover | Advisory highlight |

Only one main hero should normally be visible at a time.

---

## C. Kisan Club

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit | Use |
|---|---|---:|---:|---|---|---|
| KC-01 | `kisan_club_join_hero.webp` | **1200 × 900 px** | 4:3 | WebP | cover | Join Kisan Club landing |
| KC-02 | `kisan_club_farmer_promoter.webp` | **1200 × 800 px** | 3:2 | WebP | cover | Explain local promoter benefit |
| KC-03 | `kisan_club_advisory_benefit.webp` | **1200 × 800 px** | 3:2 | WebP | cover | Explain free advisory benefit |
| KC-04 | `kisan_club_welcome.webp` | **1080 × 1080 px** | 1:1 | WebP/PNG | contain | Successful enrollment visual |

---

## D. Farms & Crops

Create one high-quality crop image master per priority crop.

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit |
|---|---|---:|---:|---|---|
| CR-01 | `crop_mustard.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| CR-02 | `crop_wheat.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| CR-03 | `crop_paddy.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| CR-04 | `crop_maize.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| CR-05 | `crop_bajra.webp` | **1200 × 800 px** | 3:2 | WebP | cover |

For MVP/pilot, only generate crop images for crops actually supported by the product.

Do not generate unsupported crop categories purely for decoration.

---

## E. Crop Doctor Guide

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit | Use |
|---|---|---:|---:|---|---|---|
| CD-01 | `crop_doctor_good_leaf_photo.webp` | **900 × 1200 px** | 3:4 | WebP | cover | Good example |
| CD-02 | `crop_doctor_good_full_plant.webp` | **900 × 1200 px** | 3:4 | WebP | cover | Good full plant example |
| CD-03 | `crop_doctor_bad_blurry_photo.webp` | **900 × 1200 px** | 3:4 | WebP | cover | Bad example |

These images must be educational rather than decorative.

---

## F. Advisory Visuals

Use advisory images sparingly.

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit |
|---|---|---:|---:|---|---|
| AD-01 | `advisory_pest_monitoring.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| AD-02 | `advisory_irrigation.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| AD-03 | `advisory_nutrition.webp` | **1200 × 800 px** | 3:2 | WebP | cover |
| AD-04 | `advisory_weather.webp` | **1200 × 800 px** | 3:2 | WebP | cover |

Only display if mapped to the corresponding advisory category.

---

## G. Promoter

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit | Use |
|---|---|---:|---:|---|---|---|
| PR-01 | `promoter_profile_placeholder.png` | **512 × 512 px** | 1:1 | PNG | cover | Fallback promoter avatar |
| PR-02 | `promoter_support_illustration.webp` | **1080 × 720 px** | 3:2 | WebP | cover | Optional explanation screen |

Real promoter photos must come from authorized user/profile data, not generated images.

PR-01 is only a generic fallback illustration/avatar.

---

## H. Product Images

Each product/SKU image should follow one consistent master size.

| Asset ID | Filename convention | Exact master size | Aspect ratio | Format | Flutter fit |
|---|---|---:|---:|---|---|
| PD-* | `product_<sku>.png` | **1200 × 1200 px** | 1:1 | PNG transparent | contain |

Product PNG requirements:

- transparent background;
- centered pack;
- entire pack visible;
- no perspective distortion;
- no extra badge baked into image;
- no fake price;
- no shadow heavier than a subtle natural product shadow;
- at least 80px breathing space on each edge in source master.

Codex must use product placeholders until final SKU assets exist.

---

## I. Empty-State Illustrations

| Asset ID | Filename | Exact master size | Aspect ratio | Format | Flutter fit |
|---|---|---:|---:|---|---|
| ES-01 | `empty_no_farms.webp` | **800 × 800 px** | 1:1 | WebP/PNG | contain |
| ES-02 | `empty_no_crops.webp` | **800 × 800 px** | 1:1 | WebP/PNG | contain |
| ES-03 | `empty_no_orders.webp` | **800 × 800 px** | 1:1 | WebP/PNG | contain |
| ES-04 | `empty_no_notifications.webp` | **800 × 800 px** | 1:1 | WebP/PNG | contain |
| ES-05 | `offline_farmer.webp` | **800 × 800 px** | 1:1 | WebP/PNG | contain |

Keep empty-state illustrations clean and minimal.

---

# 39. Placeholder Display Sizes in Flutter

The source assets above are large master files.

Suggested on-screen frames:

```text
Home Kisan Club hero:             100% width × 168–190dp
Join Kisan Club hero:             100% width × 220–260dp
Crop card image:                  112dp × 76dp
Crop detail hero:                 100% width × 190–220dp
Product card image:               140–160dp square
Product detail image:             100% width, square frame
Promoter avatar:                  64–72dp square/circle
Crop Doctor guide thumbnail:      92 × 120dp
Empty state illustration:         180–220dp square
Advisory inline visual:            100% width × 180–210dp
```

Use responsive width constraints instead of hardcoded screen pixels.

---

# 40. Asset Directory Structure

Recommended:

```text
assets/
  branding/
  home/
  kisan_club/
  crops/
  crop_doctor/
  advisory/
  promoters/
  products/
  empty_states/
```

Update `pubspec.yaml` intentionally.

Do not add a directory glob containing unnecessary large files.

---

# 41. Asset Replacement Contract

For every placeholder, Codex must make replacement predictable.

Example asset map:

```dart
class AppAssets {
  static const kisanClubJoinHero =
      'assets/kisan_club/kisan_club_join_hero.webp';

  static const mustardCrop =
      'assets/crops/crop_mustard.webp';

  // ...
}
```

If the file does not exist during initial UI work:

- use the shared placeholder frame;
- do not break compilation;
- either keep a placeholder asset checked in or guard the asset reference behind an existence-safe implementation.

Do not commit references to nonexistent files that crash at runtime.

---

# 42. Image Generation Handoff

After Codex implements the UI placeholders, provide the product owner with a checklist of missing visual assets.

Expected output example:

```text
[ ] HM-01 home_kisan_club_hero.webp — 1200×600
[ ] KC-01 kisan_club_join_hero.webp — 1200×900
[ ] CR-01 crop_mustard.webp — 1200×800
...
```

The images will then be generated externally and copied into the agreed asset directories.

Codex should not attempt to create the images itself.

---

# 43. Implementation Sequence

Implement UI in this order.

## Phase UI-1 — Design foundation

1. theme tokens;
2. typography;
3. spacing/radius;
4. buttons;
5. cards;
6. image frame;
7. loading/empty/error components;
8. bottom navigation.

Exit gate:

- no duplicated raw theme constants in feature screens;
- English/Hindi test;
- 200% text test;
- 320dp overflow test.

---

## Phase UI-2 — Main shell + Home

1. app bar;
2. location context;
3. Kisan Club card;
4. quick actions;
5. active crop;
6. order summary;
7. small recommendation section.

Do not change backend behavior.

---

## Phase UI-3 — Kisan Club

1. non-member landing;
2. step registration;
3. member dashboard;
4. promoter card;
5. Club products/benefits;
6. Club empty/error/loading states.

---

## Phase UI-4 — Farm + Crop

1. Farms list;
2. Farm detail;
3. Add/Edit Farm;
4. Add/Edit Crop;
5. Crop Health dashboard;
6. 7-day timeline.

---

## Phase UI-5 — Advisory + Crop Doctor Shell

1. Advisory cards;
2. Advisory detail;
3. Crop Doctor entry;
4. image capture guide;
5. provider-backed result screen only when API exists.

---

## Phase UI-6 — Marketplace Visual Refresh

1. Shop;
2. categories;
3. product cards;
4. product detail;
5. Kisan Club badge state;
6. cart visual consistency.

Do not alter pricing or seller selection.

---

## Phase UI-7 — Orders, Notifications, Account

Apply common visual language without changing stable workflow logic.

---

# 44. Tests Required

For every redesigned screen:

## Widget tests

Test:

- loading;
- normal content;
- empty;
- API error;
- offline/stale where applicable;
- English;
- Hindi;
- 200% text scale;
- small Android width;
- tap-target size.

---

## Golden tests

If the repository already uses golden tests, add key golden coverage for:

```text
Home
Kisan Club Join
Kisan Club Dashboard
Crop Detail
Advisory Detail
Shop
Product Detail
```

Do not introduce a heavy golden-testing stack solely for this work without an ADR.

---

# 45. Important Business Rules UI Must Preserve

Codex must not alter these while doing UI work:

1. Distributor remains seller of record for normal product orders unless a separate approved business decision changes this.
2. Company/brand is not automatically the seller.
3. Kisan Club may display only backend-approved Vardhnam Club products.
4. Prices and discounts are backend authoritative.
5. Kisan Club membership is **free**.
6. Kisan Club exists primarily for farmer connection, advisory and Vardhnam farmer relationship, not subscription monetization.
7. Promoter information and assignment come from backend.
8. Promoter does not automatically become legal seller.
9. Farm data belongs to the authenticated farmer and must obey ownership controls.
10. GPS remains optional and consent-based.
11. Crop/advisory recommendations must come from approved backend logic/data.
12. Do not fake weather, disease diagnosis, stock, distance, price, availability or discounts.

---

# 46. Copy Tone

UI copy should be:

- short;
- helpful;
- respectful;
- action-oriented;
- non-technical where possible.

Avoid:

```text
ERROR 502
Invalid entity
Crop cycle mutation failed
```

Prefer:

```text
We could not update this crop right now.
Please try again.
```

Machine-readable errors remain underneath the UI mapping.

---

# 47. Visual Tone

Use:

- real agricultural photography;
- natural light;
- authentic Indian farming context;
- clean layouts;
- premium but approachable styling.

Avoid:

- cartoon farmers everywhere;
- oversaturated neon green;
- excessive tractor clip-art;
- gambling/e-commerce-style offer graphics;
- fake “limited time” urgency;
- too much text baked into images.

Text should remain native UI text wherever possible.

---

# 48. Final UX Goal

The farmer should understand the app using this mental model:

```text
HOME
  ↓
What is happening on my farm?

MY CROP
  ↓
What should I do today?

CROP DOCTOR
  ↓
What is wrong with my crop?

KISAN CLUB
  ↓
What free support and Vardhnam benefits do I have?

MY PROMOTER
  ↓
Who can help me locally?

SHOP
  ↓
What can I buy?

ORDERS
  ↓
Where is my order?
```

If the UI becomes more complicated than this mental model, simplify it.

---

# 49. Codex Execution Instruction

Before writing code:

1. inspect the current farmer-mobile app;
2. identify the existing theme, Riverpod providers, routes and reusable widgets;
3. preserve all working backend integrations;
4. produce a short implementation map of files to change;
5. implement in vertical UI slices;
6. run formatting, analysis and Flutter tests after each slice;
7. do not claim completion until tests have actually passed;
8. do not create production-looking fake integrations;
9. leave image placeholders according to this specification;
10. at the end, output the exact missing image checklist using the Asset IDs and filenames in Section 38.

The UI redesign must improve presentation without regressing:

- auth;
- ownership;
- seller identity;
- cart;
- checkout;
- payment state;
- orders;
- returns;
- support;
- notifications;
- localization;
- offline behavior;
- accessibility.

---

# 50. Definition of Done

UI implementation is complete only when:

- design tokens are centralized;
- five-tab navigation is consistent;
- Home is farm-first;
- Kisan Club is visually prominent but not presented as paid;
- farm/crop screens are clear and farmer-friendly;
- advisory is action-based rather than article-heavy;
- promoter support is prominent;
- Shop remains easy to use;
- seller identity remains visible;
- all required images have placeholder frames;
- no random internet images are used;
- missing-image checklist is generated;
- English/Hindi both render correctly;
- 200% text scale works;
- 320dp-wide screen has no critical overflow;
- loading/empty/error/offline states are present;
- `flutter analyze --fatal-infos` passes;
- `flutter test` passes;
- relevant UI documentation is updated.

---

## Final instruction to Codex

> Implement the Vardhnam Farmer UI as a clean, trustworthy, farm-first agriculture application.  
> Do not redesign business logic.  
> Do not invent live data.  
> Do not generate final imagery.  
> Reserve the exact image frames specified above and output the missing asset checklist at the end.  
> Final images will be generated separately and inserted after UI approval.
