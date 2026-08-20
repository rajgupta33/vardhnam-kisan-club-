/**
 * DEMO DATA ONLY - never run against production-like data.
 *
 * `prisma/seed.ts` creates the permission table and one administrator, which is
 * enough to boot the API but leaves the business portal and farmer app with
 * nothing to show. This script adds the participants and catalogue needed to
 * walk the MVP acceptance scenario in `docs/PRODUCT_REQUIREMENTS.md` section 30:
 * an approved company, an approved distributor with stocked batches and live
 * offers, a farmer with an address, an operations manager and a delivery partner.
 *
 * Every record uses a deterministic identifier and is written with `upsert`, so
 * the script is safe to re-run. Append-only inventory movements are created only
 * when a batch has none, so re-running never inflates stock.
 *
 * With AUTH_MODE=production, every business-portal (email-identified) demo user
 * logs in with password "Demo@12345" via POST /auth/login. Farmer/promoter/
 * delivery-partner (phone-identified) demo users log in via POST /auth/otp/request
 * then POST /auth/otp/verify with the mockOtpCode returned in the request response.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  DeliveryPartnerAvailabilityStatus,
  FulfilmentMode,
  InventoryBatchStatus,
  InventoryMovementType,
  AdvisoryCategory,
  AdvisoryRuleStatus,
  CropCycleStatus,
  FarmOwnershipType,
  IrrigationSource,
  KisanClubAssignmentReason,
  KisanClubAssignmentStatus,
  KisanClubBenefitStatus,
  KisanClubBenefitType,
  KisanClubMembershipStatus,
  KisanClubProgrammeStatus,
  KycDocumentStatus,
  KycDocumentType,
  MembershipStatus,
  PromoterTerritoryStatus,
  StoredFilePurpose,
  StoredFileScanResult,
  StoredFileStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  WarehouseStatus,
} from '@prisma/client';
import { hashPassword } from '../src/auth/crypto.util';

const prisma = new PrismaClient();

/** Fixed demo password for every business-portal (password-login) seeded user. */
const DEMO_PASSWORD = 'Demo@12345';

/** Deterministic demo identifiers. The 0001/0002 pair matches `prisma/seed.ts`. */
const id = {
  adminOrganisation: '00000000-0000-4000-8000-000000000001',
  adminUser: '00000000-0000-4000-8000-000000000002',
  operationsUser: '00000000-0000-4000-8000-000000000003',
  catalogueReviewerUser: '00000000-0000-4000-8000-000000000004',
  financeUser: '00000000-0000-4000-8000-000000000005',

  companyOrganisation: '00000000-0000-4000-8000-000000000011',
  companyOwnerUser: '00000000-0000-4000-8000-000000000012',

  distributorOrganisation: '00000000-0000-4000-8000-000000000021',
  distributorOwnerUser: '00000000-0000-4000-8000-000000000022',
  distributorStaffUser: '00000000-0000-4000-8000-000000000023',

  deliveryOrganisation: '00000000-0000-4000-8000-000000000031',
  deliveryPartnerUser: '00000000-0000-4000-8000-000000000032',

  farmerContextOrganisation: '00000000-0000-4000-8000-000000000041',
  farmerUser: '00000000-0000-4000-8000-000000000042',
  promoterUser: '00000000-0000-4000-8000-000000000051',

  brand: '00000000-0000-4000-8000-000000000101',
  product: '00000000-0000-4000-8000-000000000111',
  variant1Kg: '00000000-0000-4000-8000-000000000112',
  variant5Kg: '00000000-0000-4000-8000-000000000113',
  warehouse: '00000000-0000-4000-8000-000000000121',
  batch1Kg: '00000000-0000-4000-8000-000000000131',
  batch5Kg: '00000000-0000-4000-8000-000000000132',
  offer1Kg: '00000000-0000-4000-8000-000000000141',
  offer5Kg: '00000000-0000-4000-8000-000000000142',
  farmerProfile: '00000000-0000-4000-8000-000000000151',
  farmerAddress: '00000000-0000-4000-8000-000000000152',
  globalCommissionRule: '00000000-0000-4000-8000-000000000161',

  // Kisan Club. Without these the Club module in the farmer app has nothing to
  // show: no membership, no assigned promoter, no Club catalogue, no advisory.
  clubTerritory: '00000000-0000-4000-8000-000000000201',
  clubPromoterProfile: '00000000-0000-4000-8000-000000000202',
  clubMembership: '00000000-0000-4000-8000-000000000203',
  clubAssignment: '00000000-0000-4000-8000-000000000204',
  clubProgramme: '00000000-0000-4000-8000-000000000205',
  clubBenefitRule: '00000000-0000-4000-8000-000000000206',
  // A Club programme may only cover a Vardhnam-owned product, so the real
  // Vardhnam catalogue below doubles as the Club catalogue -- the company-owned
  // demo product is deliberately ineligible.
  clubBrand: '00000000-0000-4000-8000-000000000211',
  farm: '00000000-0000-4000-8000-000000000207',
  cropCycle: '00000000-0000-4000-8000-000000000208',
  advisoryRule: '00000000-0000-4000-8000-000000000209',
} as const;

const PINCODE = '302001';
const SERVICEABLE_PINCODES = ['302001', '302002', '302012'];

const seedAssetsRoot = path.join(__dirname, 'seed-assets');

interface VardhnamSku {
  productId: string;
  variantId: string;
  batchId: string;
  offerId: string;
  skuCode: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  cropTargets: string[];
  variantName: string;
  packSizeKg: number;
  mrpPaise: number;
  sellingPricePaise: number;
  imageFile: string;
}

/**
 * The real Vardhnam Agro catalogue, with the supplied pack shots.
 *
 * Product names, categories and crop targets are taken from the packaging.
 *
 * **Pack sizes, prices and tax classifications are placeholders.** They were not supplied and are not
 * on the packs, so they are plausible round numbers chosen to make the app
 * usable, not commercial data. Replace `packSizeKg`, `mrpPaise` and
 * `sellingPricePaise`, HSN and GST rate with CA-approved figures before this is shown to anyone
 * outside the team -- a farmer seeing an invented price is worse than a farmer
 * seeing no price.
 */
const vardhnamSkus: ReadonlyArray<VardhnamSku> = [
  {
    productId: '00000000-0000-4000-8000-000000000221',
    variantId: '00000000-0000-4000-8000-000000000222',
    batchId: '00000000-0000-4000-8000-000000000223',
    offerId: '00000000-0000-4000-8000-000000000224',
    skuCode: 'PADDY-ADIYOGI',
    name: 'Adiyogi',
    slug: 'adiyogi-research-paddy-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro research paddy seed.',
    cropTargets: ['Rice', 'Paddy'],
    variantName: '5 kg pack',
    packSizeKg: 5,
    mrpPaise: 60_000,
    sellingPricePaise: 56_000,
    imageFile: 'adiyogi.png',
  },
  {
    productId: '00000000-0000-4000-8000-000000000225',
    variantId: '00000000-0000-4000-8000-000000000226',
    batchId: '00000000-0000-4000-8000-000000000227',
    offerId: '00000000-0000-4000-8000-000000000228',
    skuCode: 'PADDY-AMAN-PLUS',
    name: 'Aman Plus',
    slug: 'aman-plus-research-paddy-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro research paddy seed.',
    cropTargets: ['Rice', 'Paddy'],
    variantName: '5 kg pack',
    packSizeKg: 5,
    mrpPaise: 62_000,
    sellingPricePaise: 58_000,
    imageFile: 'aman-plus.png',
  },
  {
    productId: '00000000-0000-4000-8000-000000000229',
    variantId: '00000000-0000-4000-8000-00000000022a',
    batchId: '00000000-0000-4000-8000-00000000022b',
    offerId: '00000000-0000-4000-8000-00000000022c',
    skuCode: 'PADDY-GAURI',
    name: 'Gauri',
    slug: 'gauri-research-paddy-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro research paddy seed.',
    cropTargets: ['Rice', 'Paddy'],
    variantName: '5 kg pack',
    packSizeKg: 5,
    mrpPaise: 58_000,
    sellingPricePaise: 54_000,
    imageFile: 'gauri.png',
  },
  {
    productId: '00000000-0000-4000-8000-00000000022d',
    variantId: '00000000-0000-4000-8000-00000000022e',
    batchId: '00000000-0000-4000-8000-00000000022f',
    offerId: '00000000-0000-4000-8000-000000000230',
    skuCode: 'MAIZE-BASANT-GOLD-9180',
    name: 'Basant Gold 9180',
    slug: 'basant-gold-9180-hybrid-maize-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro hybrid maize seed.',
    cropTargets: ['Maize'],
    variantName: '4 kg pack',
    packSizeKg: 4,
    mrpPaise: 90_000,
    sellingPricePaise: 85_000,
    imageFile: 'basant-gold-9180.png',
  },
  {
    productId: '00000000-0000-4000-8000-000000000231',
    variantId: '00000000-0000-4000-8000-000000000232',
    batchId: '00000000-0000-4000-8000-000000000233',
    offerId: '00000000-0000-4000-8000-000000000234',
    skuCode: 'MAIZE-CHANAKYA-4590',
    name: 'Chanakya-4590',
    slug: 'chanakya-4590-hybrid-maize-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro hybrid maize seed.',
    cropTargets: ['Maize'],
    variantName: '4 kg pack',
    packSizeKg: 4,
    mrpPaise: 95_000,
    sellingPricePaise: 89_000,
    imageFile: 'chanakya-4590.png',
  },
  {
    productId: '00000000-0000-4000-8000-000000000235',
    variantId: '00000000-0000-4000-8000-000000000236',
    batchId: '00000000-0000-4000-8000-000000000237',
    offerId: '00000000-0000-4000-8000-000000000238',
    skuCode: 'MUSTARD-VM-LAKSHMI-1246',
    name: 'VM Lakshmi-1246',
    slug: 'vm-lakshmi-1246-hybrid-mustard-seed',
    category: 'Seeds',
    description: 'Vardhnam Agro Solutions hybrid mustard seed.',
    cropTargets: ['Mustard'],
    variantName: '2 kg pack',
    packSizeKg: 2,
    mrpPaise: 45_000,
    sellingPricePaise: 42_000,
    imageFile: 'vm-lakshmi-1246.png',
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo must never run with NODE_ENV=production');
  }

  await seedOrganisations();
  await seedUsersAndMemberships();
  await seedOnboardingProfiles();
  await seedCatalogue();
  await seedInventory();
  await seedOffers();
  await seedFarmer();
  await seedKisanClub();
  await seedFinance();

  await prisma.auditLog.create({
    data: {
      actorUserId: id.adminUser,
      actorRole: PlatformRole.SUPER_ADMIN,
      organisationId: id.adminOrganisation,
      action: 'DEMO_SEED_DATA_APPLIED',
      resourceType: 'SeedData',
      resourceId: 'mvp-acceptance-demo',
      reason: 'Demo data for the MVP acceptance scenario',
    },
  });

  printSummary();
}

async function seedOrganisations(): Promise<void> {
  await upsertOrganisation({
    id: id.adminOrganisation,
    type: OrganisationType.VARDHNAM,
    slug: 'vardhnam-admin',
    legalName: 'Vardhnam Agrotech',
    displayName: 'Vardhnam Admin',
  });
  await upsertOrganisation({
    id: id.companyOrganisation,
    type: OrganisationType.COMPANY,
    slug: 'demo-seeds-company',
    legalName: 'Demo Seeds Private Limited',
    displayName: 'Demo Seeds',
    gstin: '08AACCD1234E1Z2',
  });
  await upsertOrganisation({
    id: id.distributorOrganisation,
    type: OrganisationType.DISTRIBUTOR,
    slug: 'demo-jaipur-distributor',
    legalName: 'Demo Jaipur Distributor Private Limited',
    displayName: 'Demo Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  await upsertOrganisation({
    id: id.deliveryOrganisation,
    type: OrganisationType.DELIVERY_PARTNER,
    slug: 'demo-last-mile-logistics',
    legalName: 'Demo Last Mile Logistics',
    displayName: 'Demo Last Mile',
  });
  await upsertOrganisation({
    id: id.farmerContextOrganisation,
    type: OrganisationType.VARDHNAM,
    slug: 'vardhnam-farmer-context',
    legalName: 'Vardhnam Farmer Context',
    displayName: 'Vardhnam Farmer Context',
  });
}

async function seedUsersAndMemberships(): Promise<void> {
  const people: Array<{
    userId: string;
    organisationId: string;
    role: PlatformRole;
    displayName: string;
    email?: string;
    phone?: string;
  }> = [
    {
      userId: id.adminUser,
      organisationId: id.adminOrganisation,
      role: PlatformRole.SUPER_ADMIN,
      displayName: 'Demo Super Admin',
      email: 'admin@example.local',
    },
    {
      userId: id.operationsUser,
      organisationId: id.adminOrganisation,
      role: PlatformRole.OPERATIONS_MANAGER,
      displayName: 'Demo Operations Manager',
      email: 'operations@example.local',
    },
    {
      userId: id.catalogueReviewerUser,
      organisationId: id.adminOrganisation,
      role: PlatformRole.CATALOGUE_REVIEWER,
      displayName: 'Demo Catalogue Reviewer',
      email: 'catalogue@example.local',
    },
    {
      userId: id.financeUser,
      organisationId: id.adminOrganisation,
      role: PlatformRole.FINANCE_MANAGER,
      displayName: 'Demo Finance Manager',
      email: 'finance@example.local',
    },
    {
      userId: id.companyOwnerUser,
      organisationId: id.companyOrganisation,
      role: PlatformRole.COMPANY_OWNER,
      displayName: 'Demo Company Owner',
      email: 'company@example.local',
    },
    {
      userId: id.distributorOwnerUser,
      organisationId: id.distributorOrganisation,
      role: PlatformRole.DISTRIBUTOR_OWNER,
      displayName: 'Demo Distributor Owner',
      email: 'distributor@example.local',
    },
    {
      userId: id.distributorStaffUser,
      organisationId: id.distributorOrganisation,
      role: PlatformRole.DISTRIBUTOR_STAFF,
      displayName: 'Demo Distributor Staff',
      email: 'distributor-staff@example.local',
    },
    {
      userId: id.deliveryPartnerUser,
      organisationId: id.deliveryOrganisation,
      role: PlatformRole.DELIVERY_PARTNER,
      displayName: 'Demo Delivery Partner',
      phone: '+919000000032',
    },
    {
      userId: id.promoterUser,
      organisationId: id.farmerContextOrganisation,
      role: PlatformRole.PROMOTER,
      displayName: 'Demo Promoter',
      phone: '+919000000051',
    },
    {
      userId: id.farmerUser,
      organisationId: id.farmerContextOrganisation,
      role: PlatformRole.FARMER,
      displayName: 'Demo Farmer',
      phone: '+919000000042',
    },
  ];

  // Business/portal roles log in with a password; farmer/promoter/delivery-partner
  // roles log in with phone OTP and never get a passwordHash.
  const demoPasswordHash = await hashPassword(DEMO_PASSWORD);

  for (const person of people) {
    const passwordHash = person.email ? demoPasswordHash : null;

    await prisma.user.upsert({
      where: { id: person.userId },
      create: {
        id: person.userId,
        email: person.email ?? null,
        phone: person.phone ?? null,
        passwordHash,
        status: 'ACTIVE',
        profile: {
          create: {
            displayName: person.displayName,
            preferredLocale: person.role === PlatformRole.FARMER ? 'hi-IN' : 'en-IN',
            timezone: 'Asia/Kolkata',
          },
        },
      },
      update: {
        passwordHash,
        status: 'ACTIVE',
        profile: {
          upsert: {
            create: {
              displayName: person.displayName,
              preferredLocale: person.role === PlatformRole.FARMER ? 'hi-IN' : 'en-IN',
              timezone: 'Asia/Kolkata',
            },
            update: {
              displayName: person.displayName,
            },
          },
        },
      },
    });

    await prisma.organisationMembership.upsert({
      where: {
        userId_organisationId_role: {
          userId: person.userId,
          organisationId: person.organisationId,
          role: person.role,
        },
      },
      create: {
        userId: person.userId,
        organisationId: person.organisationId,
        role: person.role,
        status: MembershipStatus.ACTIVE,
      },
      update: {
        status: MembershipStatus.ACTIVE,
      },
    });
  }

  await prisma.deliveryPartnerProfile.upsert({
    where: {
      userId_organisationId: {
        userId: id.deliveryPartnerUser,
        organisationId: id.deliveryOrganisation,
      },
    },
    create: {
      userId: id.deliveryPartnerUser,
      organisationId: id.deliveryOrganisation,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      availabilityChangedAt: new Date(),
    },
    update: {},
  });
}

async function seedOnboardingProfiles(): Promise<void> {
  await prisma.companyProfile.upsert({
    where: { organisationId: id.companyOrganisation },
    create: {
      organisationId: id.companyOrganisation,
      brandName: 'Demo Seeds',
      registrationNumber: 'U01100RJ2026PTC000001',
      pan: 'AACCD1234E',
      primaryContactName: 'Ramesh Sharma',
      primaryContactPhone: '+919000000012',
      primaryContactEmail: 'company@example.local',
      registeredAddress: '4th Floor, Agri Tower, Tonk Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: PINCODE,
    },
    update: {},
  });

  await prisma.distributorProfile.upsert({
    where: { organisationId: id.distributorOrganisation },
    create: {
      organisationId: id.distributorOrganisation,
      distributorCode: 'DIST-JAI-001',
      pan: 'ABCDE1234F',
      primaryContactName: 'Suresh Jain',
      primaryContactPhone: '+919000000022',
      primaryContactEmail: 'distributor@example.local',
      operatingAddress: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: PINCODE,
      serviceablePincodes: SERVICEABLE_PINCODES,
      fulfilmentCapability: 'Own delivery and Vardhnam-assisted pickup',
    },
    update: {
      serviceablePincodes: SERVICEABLE_PINCODES,
    },
  });

  // An organisation cannot be approved without at least one approved KYC
  // document, so both onboarded organisations get a mock GST certificate.
  for (const [organisationId, documentNumber] of [
    [id.companyOrganisation, '08AACCD1234E1Z2'],
    [id.distributorOrganisation, '08ABCDE1234F1Z5'],
  ] as const) {
    const existing = await prisma.kycDocument.findFirst({
      where: { organisationId, documentType: KycDocumentType.GST_CERTIFICATE },
    });
    if (existing) {
      continue;
    }
    await prisma.kycDocument.create({
      data: {
        organisationId,
        documentType: KycDocumentType.GST_CERTIFICATE,
        status: KycDocumentStatus.APPROVED,
        documentNumber,
        fileName: 'gst-certificate.pdf',
        // MOCK storage key: no private document storage exists yet.
        storageKey: `mock/kyc/${organisationId}/gst-certificate.pdf`,
        issuedAt: dateOffset(-120),
        expiresAt: dateOffset(600),
      },
    });
  }
}

async function seedCatalogue(): Promise<void> {
  await prisma.brand.upsert({
    where: { id: id.brand },
    create: {
      id: id.brand,
      companyOrganisationId: id.companyOrganisation,
      name: 'Demo Seeds',
      slug: 'demo-seeds',
      description: 'Demonstration seed brand for the Vardhnam pilot',
      status: CatalogueStatus.APPROVED,
    },
    update: {
      status: CatalogueStatus.APPROVED,
    },
  });

  await prisma.masterProduct.upsert({
    where: { id: id.product },
    create: {
      id: id.product,
      companyOrganisationId: id.companyOrganisation,
      brandId: id.brand,
      name: 'Hybrid Bajra Seed',
      slug: 'hybrid-bajra-seed',
      category: 'Seeds',
      description: 'Drought tolerant hybrid bajra seed suitable for Kharif sowing.',
      cropTargets: ['Bajra', 'Millet'],
      status: CatalogueStatus.APPROVED,
    },
    update: {
      status: CatalogueStatus.APPROVED,
    },
  });

  await upsertVariant({
    id: id.variant1Kg,
    sku: 'SEED-BAJRA-1KG',
    variantName: '1 kg pack',
    packSize: 1,
    mrpPaise: 125000,
  });
  await upsertVariant({
    id: id.variant5Kg,
    sku: 'SEED-BAJRA-5KG',
    variantName: '5 kg pack',
    packSize: 5,
    mrpPaise: 590000,
  });
}

async function seedInventory(): Promise<void> {
  await prisma.warehouse.upsert({
    where: { id: id.warehouse },
    create: {
      id: id.warehouse,
      distributorOrganisationId: id.distributorOrganisation,
      code: 'JPR-01',
      name: 'Jaipur Main Warehouse',
      addressLine1: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: PINCODE,
      contactName: 'Suresh Jain',
      contactPhone: '+919000000022',
      status: WarehouseStatus.ACTIVE,
    },
    update: {
      status: WarehouseStatus.ACTIVE,
    },
  });

  await upsertBatchWithOpeningStock({
    id: id.batch1Kg,
    variantId: id.variant1Kg,
    batchNumber: 'BATCH-BAJRA-1KG-2026A',
    openingQuantity: 250,
    expiryInDays: 400,
  });
  await upsertBatchWithOpeningStock({
    id: id.batch5Kg,
    variantId: id.variant5Kg,
    batchNumber: 'BATCH-BAJRA-5KG-2026A',
    openingQuantity: 80,
    expiryInDays: 400,
  });
}

async function seedOffers(): Promise<void> {
  await upsertOffer({
    id: id.offer1Kg,
    variantId: id.variant1Kg,
    batchId: id.batch1Kg,
    offerCode: 'OFFER-BAJRA-1KG',
    sellingPricePaise: 118000,
    maximumOrderQuantity: 20,
  });
  await upsertOffer({
    id: id.offer5Kg,
    variantId: id.variant5Kg,
    batchId: id.batch5Kg,
    offerCode: 'OFFER-BAJRA-5KG',
    sellingPricePaise: 555000,
    maximumOrderQuantity: 10,
  });
}

async function seedFarmer(): Promise<void> {
  await prisma.farmerProfile.upsert({
    where: { id: id.farmerProfile },
    create: {
      id: id.farmerProfile,
      userId: id.farmerUser,
      fullName: 'Demo Farmer',
      preferredLocale: 'hi-IN',
      village: 'Rampura',
      district: 'Jaipur',
      state: 'Rajasthan',
      primaryPincode: PINCODE,
      cropInterests: ['Bajra', 'Moong'],
    },
    update: {
      primaryPincode: PINCODE,
    },
  });

  await prisma.farmerAddress.upsert({
    where: { id: id.farmerAddress },
    create: {
      id: id.farmerAddress,
      farmerProfileId: id.farmerProfile,
      label: 'Home',
      recipientName: 'Demo Farmer',
      phone: '+919000000042',
      addressLine1: 'Khasra 42, Rampura Road',
      village: 'Rampura',
      city: 'Jaipur',
      district: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: PINCODE,
      isDefault: true,
    },
    update: {
      isDefault: true,
      stateCode: '08',
    },
  });
}

/**
 * Kisan Club demo data.
 *
 * The Club module is the largest surface in the farmer app and, without this,
 * every screen in it renders an empty state: no membership, so the dashboard
 * card only offers "join"; no assigned promoter; no Club catalogue; no farm, so
 * no crop cycle and therefore no advisory can ever match.
 *
 * The membership is seeded ACTIVE with a farm and an active crop cycle already
 * in place, because that is the state most worth looking at. The join and
 * profile-completion flows are still reachable from a fresh farmer registered
 * through the app.
 *
 * Requires KISAN_CLUB_ENABLED=true on the API, otherwise the Club endpoints
 * return 404 and none of this is visible.
 */
async function seedKisanClub(): Promise<void> {
  const now = new Date();

  await seedClubCatalogue();

  await prisma.promoterTerritory.upsert({
    where: { id: id.clubTerritory },
    create: {
      id: id.clubTerritory,
      name: 'Jaipur East',
      state: 'Rajasthan',
      district: 'Jaipur',
      blocks: ['Sanganer'],
      pincodes: SERVICEABLE_PINCODES,
      villages: ['Rampura'],
      status: PromoterTerritoryStatus.ACTIVE,
    },
    update: { pincodes: SERVICEABLE_PINCODES, status: PromoterTerritoryStatus.ACTIVE },
  });

  // Upserted on their unique business keys, not on `id`: a database that has
  // been used by hand may already hold a membership or promoter profile for
  // these people under a different generated id, and keying on `id` would
  // collide instead of updating.
  const promoterProfile = await prisma.kisanClubPromoterProfile.upsert({
    where: { promoterUserId: id.promoterUser },
    create: {
      id: id.clubPromoterProfile,
      promoterUserId: id.promoterUser,
      promoterOrganisationId: id.adminOrganisation,
      territoryId: id.clubTerritory,
      homeVillage: 'Rampura',
      homePincode: PINCODE,
      // Both flags matter: a promoter who is not clubEnabled or is not
      // accepting farmers cannot be assigned, and the farmer app would show
      // "we are finding your local partner" for ever.
      clubEnabled: true,
      acceptingNewFarmers: true,
      maxActiveFarmers: 150,
      activeFarmerCount: 1,
    },
    update: { clubEnabled: true, acceptingNewFarmers: true, territoryId: id.clubTerritory },
  });

  const membership = await prisma.kisanClubMembership.upsert({
    where: { farmerProfileId: id.farmerProfile },
    create: {
      id: id.clubMembership,
      farmerProfileId: id.farmerProfile,
      memberNumber: 'KC-DEMO-0001',
      status: KisanClubMembershipStatus.ACTIVE,
      homePincode: PINCODE,
      homeVillage: 'Rampura',
      homeDistrict: 'Jaipur',
      homeState: 'Rajasthan',
      joinedAt: now,
      termsVersion: 'v1',
      termsAcceptedAt: now,
      // Advisory consent is on, otherwise generated advisories are withheld and
      // the advisory screen stays empty by design.
      advisoryConsent: true,
      advisoryConsentAt: now,
      marketingConsent: false,
      preciseLocationConsent: false,
    },
    update: { status: KisanClubMembershipStatus.ACTIVE, advisoryConsent: true },
  });

  // An assignment has no unique business key, so re-running would stack a second
  // active one. Only the absence of an active assignment creates a new record;
  // the app reads "my promoter" from whichever is active.
  const existingAssignment = await prisma.kisanClubPromoterAssignment.findFirst({
    where: { membershipId: membership.id, status: KisanClubAssignmentStatus.ACTIVE },
  });

  if (!existingAssignment) {
    await prisma.kisanClubPromoterAssignment.create({
      data: {
        membershipId: membership.id,
        promoterUserId: promoterProfile.promoterUserId,
        territoryId: id.clubTerritory,
        status: KisanClubAssignmentStatus.ACTIVE,
        assignmentReason: KisanClubAssignmentReason.MANUAL_OPS,
        assignedByUserId: id.operationsUser,
        assignedByRole: PlatformRole.OPERATIONS_MANAGER,
        reason: 'Demo data',
      },
    });
  }

  await prisma.farm.upsert({
    where: { id: id.farm },
    create: {
      id: id.farm,
      membershipId: membership.id,
      farmerProfileId: id.farmerProfile,
      name: 'Rampura North Field',
      village: 'Rampura',
      district: 'Jaipur',
      state: 'Rajasthan',
      pincode: PINCODE,
      areaAcres: new Prisma.Decimal('4.500'),
      ownershipType: FarmOwnershipType.OWNED,
      irrigationSource: IrrigationSource.TUBE_WELL,
      soilType: 'Sandy loam',
      isActive: true,
    },
    update: { isActive: true },
  });

  const wheat = await prisma.crop.findUnique({ where: { code: 'WHEAT' } });
  if (!wheat) {
    // The crop vocabulary ships in the farm-registry migration. If it is absent
    // the database was reset without re-applying it, and a crop cycle -- and so
    // every advisory -- is impossible.
    throw new Error('Crop vocabulary is missing; run prisma migrate deploy before seeding');
  }

  // Sown 40 days ago so it sits inside the advisory rule's day window below.
  const sowingDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1_000);

  await prisma.farmCropCycle.upsert({
    where: { id: id.cropCycle },
    create: {
      id: id.cropCycle,
      farmId: id.farm,
      cropId: wheat.id,
      varietyName: 'HD-2967',
      areaAcres: new Prisma.Decimal('3.000'),
      season: 'RABI',
      sowingDate,
      expectedHarvestDate: new Date(sowingDate.getTime() + 140 * 24 * 60 * 60 * 1_000),
      status: CropCycleStatus.ACTIVE,
    },
    update: { status: CropCycleStatus.ACTIVE },
  });

  await prisma.advisoryRule.upsert({
    where: { id: id.advisoryRule },
    create: {
      id: id.advisoryRule,
      cropName: 'Wheat',
      category: AdvisoryCategory.IRRIGATION,
      // Wide enough to match the seeded 40-day-old crop cycle.
      minDaysAfterSowing: 30,
      maxDaysAfterSowing: 60,
      eligibleStates: ['Rajasthan'],
      eligibleDistricts: ['Jaipur'],
      seasons: ['RABI'],
      titleEn: 'Crown root irrigation is due',
      bodyEn:
        'Wheat needs its most important irrigation 30 to 45 days after sowing, at the crown root stage. Missing it reduces tillering and final yield. Irrigate lightly and evenly, and avoid waterlogging.',
      titleHi: 'ताज जड़ सिंचाई का समय',
      bodyHi:
        'गेहूं को बुवाई के 30 से 45 दिन बाद ताज जड़ अवस्था पर सबसे महत्वपूर्ण सिंचाई चाहिए। यह छूटने पर कल्ले और उपज घट जाती है। हल्की और समान सिंचाई करें, जलभराव से बचें।',
      status: AdvisoryRuleStatus.APPROVED,
      version: 1,
      authoredByUserId: id.operationsUser,
      // Approval is a separate person from the author by design; the demo
      // administrator stands in for the agronomist reviewer.
      reviewedByUserId: id.adminUser,
      reviewedAt: now,
      sourceReference: 'Demo advisory content',
    },
    update: { status: AdvisoryRuleStatus.APPROVED },
  });

  // A Vardhnam-funded Club programme over one real SKU, so the Club catalogue
  // is not empty and a benefit token has something to apply to. Adiyogi is a
  // paddy seed, matching the seeded wheat/paddy-growing demo farmer.
  const clubProgrammeSku = vardhnamSkus[0]!;
  await prisma.kisanClubProductProgramme.upsert({
    where: { id: id.clubProgramme },
    create: {
      id: id.clubProgramme,
      productId: clubProgrammeSku.productId,
      variantId: clubProgrammeSku.variantId,
      status: KisanClubProgrammeStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      eligiblePincodes: SERVICEABLE_PINCODES,
      eligibleDistricts: ['Jaipur'],
      displayPriority: 10,
      createdByUserId: id.operationsUser,
      createdByRole: PlatformRole.OPERATIONS_MANAGER,
      reason: 'Demo Club programme',
    },
    // The update branch repeats everything that decides eligibility, not just
    // the status. A narrower update silently keeps stale values on a re-run --
    // which is exactly how this programme stayed pointed at the company-owned
    // product after being re-aimed at the Vardhnam one, leaving the Club
    // catalogue empty with no visible error.
    update: {
      productId: clubProgrammeSku.productId,
      variantId: clubProgrammeSku.variantId,
      status: KisanClubProgrammeStatus.ACTIVE,
      eligiblePincodes: SERVICEABLE_PINCODES,
      eligibleDistricts: ['Jaipur'],
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      endsAt: null,
    },
  });

  await prisma.kisanClubBenefitRule.upsert({
    where: { id: id.clubBenefitRule },
    create: {
      id: id.clubBenefitRule,
      programmeId: id.clubProgramme,
      benefitType: KisanClubBenefitType.FLAT_AMOUNT_OFF,
      // ₹25 off, platform-funded. Small on purpose: the seller's payable is
      // unaffected by a Club benefit, and an implausible discount makes the
      // subsidy ledger harder to read while testing.
      flatAmountPaise: 2_500,
      minimumQuantity: 1,
      eligiblePincodes: SERVICEABLE_PINCODES,
      status: KisanClubBenefitStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      perMemberUsageLimit: 5,
      createdByUserId: id.operationsUser,
      createdByRole: PlatformRole.OPERATIONS_MANAGER,
      reason: 'Demo Club benefit',
    },
    update: {
      benefitType: KisanClubBenefitType.FLAT_AMOUNT_OFF,
      flatAmountPaise: 2_500,
      minimumQuantity: 1,
      eligiblePincodes: SERVICEABLE_PINCODES,
      status: KisanClubBenefitStatus.ACTIVE,
      startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      endsAt: null,
    },
  });
}

async function seedFinance(): Promise<void> {
  // Placeholder commission rate pending real business approval. Product HSN
  // and GST classifications are separate placeholders declared with each SKU.
  const marketplaceCommissionBps = Number(process.env.DEFAULT_MARKETPLACE_COMMISSION_BPS ?? 500);

  await prisma.commissionRule.upsert({
    where: { id: id.globalCommissionRule },
    create: {
      id: id.globalCommissionRule,
      sellerOrganisationId: null,
      marketplaceCommissionBps,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
      createdByUserId: id.adminUser,
      createdByRole: PlatformRole.SUPER_ADMIN,
      reason: 'Initial global marketplace commission rate for demo data',
    },
    update: {
      marketplaceCommissionBps,
    },
  });
}

async function upsertOrganisation(input: {
  id: string;
  type: OrganisationType;
  slug: string;
  legalName: string;
  displayName: string;
  gstin?: string;
}): Promise<void> {
  await prisma.organisation.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      type: input.type,
      slug: input.slug,
      legalName: input.legalName,
      displayName: input.displayName,
      gstin: input.gstin ?? null,
      registeredStateCode: input.gstin?.slice(0, 2) ?? null,
      gstinVerifiedAt: input.gstin ? new Date() : null,
      status: OrganisationStatus.ACTIVE,
    },
    update: {
      displayName: input.displayName,
      gstin: input.gstin ?? null,
      registeredStateCode: input.gstin?.slice(0, 2) ?? null,
      gstinVerifiedAt: input.gstin ? new Date() : null,
      status: OrganisationStatus.ACTIVE,
    },
  });
}

/**
 * The Vardhnam-owned side of the catalogue.
 *
 * A Kisan Club programme may only cover a product whose owning organisation is
 * of type VARDHNAM -- that is the rule that keeps Club benefits platform-funded
 * rather than a discount extracted from a third-party company. The main demo
 * product belongs to the demo *company*, so it can never appear in the Club
 * catalogue no matter how the programme is configured.
 *
 * The distributor still sells it and is still the seller of record: a Club
 * benefit reduces what the farmer pays, never what the seller is owed.
 */
async function seedClubCatalogue(): Promise<void> {
  await prisma.brand.upsert({
    where: { id: id.clubBrand },
    create: {
      id: id.clubBrand,
      companyOrganisationId: id.adminOrganisation,
      name: 'Vardhnam Agro',
      slug: 'vardhnam-agro',
      description: 'Vardhnam Agro research seed brand',
      status: CatalogueStatus.APPROVED,
    },
    update: { name: 'Vardhnam Agro', status: CatalogueStatus.APPROVED },
  });

  for (const sku of vardhnamSkus) {
    const storedFileId = await upsertProductImage(sku);

    await prisma.masterProduct.upsert({
      where: { id: sku.productId },
      create: {
        id: sku.productId,
        companyOrganisationId: id.adminOrganisation,
        brandId: id.clubBrand,
        name: sku.name,
        slug: sku.slug,
        category: sku.category,
        description: sku.description,
        cropTargets: sku.cropTargets,
        status: CatalogueStatus.APPROVED,
        primaryImageStoredFileId: storedFileId,
      },
      update: {
        name: sku.name,
        category: sku.category,
        description: sku.description,
        cropTargets: sku.cropTargets,
        status: CatalogueStatus.APPROVED,
        primaryImageStoredFileId: storedFileId,
      },
    });

    await prisma.productVariant.upsert({
      where: { id: sku.variantId },
      create: {
        id: sku.variantId,
        productId: sku.productId,
        sku: sku.skuCode,
        variantName: sku.variantName,
        packSize: new Prisma.Decimal(sku.packSizeKg),
        packUnit: 'kg',
        mrpPaise: sku.mrpPaise,
        hsnCode: placeholderSeedHsn(sku.skuCode),
        gstRateBps: 0,
        isActive: true,
      },
      update: {
        variantName: sku.variantName,
        packSize: new Prisma.Decimal(sku.packSizeKg),
        mrpPaise: sku.mrpPaise,
        hsnCode: placeholderSeedHsn(sku.skuCode),
        gstRateBps: 0,
        isActive: true,
      },
    });

    await prisma.inventoryBatch.upsert({
      where: { id: sku.batchId },
      create: {
        id: sku.batchId,
        distributorOrganisationId: id.distributorOrganisation,
        warehouseId: id.warehouse,
        productId: sku.productId,
        variantId: sku.variantId,
        batchNumber: `BATCH-${sku.skuCode}`,
        manufacturingDate: dateOffset(-60),
        expiryDate: dateOffset(540),
        status: InventoryBatchStatus.ACTIVE,
      },
      update: { status: InventoryBatchStatus.ACTIVE },
    });

    // Opening stock is written only when the batch has no movements, so
    // re-running the seed never inflates inventory.
    const existingMovements = await prisma.inventoryMovement.count({
      where: { batchId: sku.batchId },
    });
    if (existingMovements === 0) {
      await prisma.inventoryMovement.create({
        data: {
          distributorOrganisationId: id.distributorOrganisation,
          warehouseId: id.warehouse,
          batchId: sku.batchId,
          productId: sku.productId,
          variantId: sku.variantId,
          movementType: InventoryMovementType.OPENING_STOCK,
          quantityDelta: 400,
          balanceAfter: 400,
          reason: 'Demo opening stock for the Vardhnam catalogue',
          referenceType: 'DemoSeed',
          referenceId: sku.skuCode,
          createdByUserId: id.distributorOwnerUser,
        },
      });
    }

    await prisma.distributorOffer.upsert({
      where: { id: sku.offerId },
      create: {
        id: sku.offerId,
        distributorOrganisationId: id.distributorOrganisation,
        productId: sku.productId,
        variantId: sku.variantId,
        warehouseId: id.warehouse,
        batchId: sku.batchId,
        offerCode: `OFFER-${sku.skuCode}`,
        sellingPricePaise: sku.sellingPricePaise,
        minimumOrderQuantity: 1,
        maximumOrderQuantity: 20,
        serviceablePincodes: SERVICEABLE_PINCODES,
        fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
        deliverySlaDays: 3,
        status: DistributorOfferStatus.APPROVED,
      },
      update: {
        sellingPricePaise: sku.sellingPricePaise,
        serviceablePincodes: SERVICEABLE_PINCODES,
        status: DistributorOfferStatus.APPROVED,
      },
    });
  }
}

/**
 * Registers a pack shot with the storage layer and returns its `StoredFile` id.
 *
 * Writes straight to the local provider's root rather than going through the
 * upload-URL flow: a seed has no HTTP client, and the bytes are a bundled asset
 * rather than untrusted input. The row is created `AVAILABLE` with a clean scan
 * result because the database `CHECK` constraint requires one -- a bundled
 * repository asset is not a file a farmer uploaded.
 *
 * Only works with `STORAGE_PROVIDER=local`. Against a cloud provider these
 * images need uploading through the normal API instead; the seed says so rather
 * than silently producing products with broken images.
 */
async function upsertProductImage(sku: VardhnamSku): Promise<string> {
  const storageProvider = process.env.STORAGE_PROVIDER ?? 'local';
  if (storageProvider !== 'local') {
    throw new Error(
      `seed-demo can only install product images with STORAGE_PROVIDER=local (found ${storageProvider}). ` +
        'Upload the pack shots through POST /files/upload-url instead.',
    );
  }

  const sourcePath = path.join(seedAssetsRoot, 'products', sku.imageFile);
  const contents = await readFile(sourcePath);
  const checksum = createHash('sha256').update(contents).digest('hex');
  const objectKey = `product_image/seed/${sku.slug}.png`;

  const storageRoot = path.resolve(process.env.STORAGE_LOCAL_ROOT ?? '.storage');
  const destination = path.join(storageRoot, objectKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
  // The local provider reads the content type from a sidecar file.
  await writeFile(`${destination}.meta`, 'image/png', 'utf8');

  const now = new Date();
  const stored = await prisma.storedFile.upsert({
    where: { objectKey },
    create: {
      ownerUserId: id.adminUser,
      organisationId: id.adminOrganisation,
      purpose: StoredFilePurpose.PRODUCT_IMAGE,
      status: StoredFileStatus.AVAILABLE,
      objectKey,
      originalFilename: sku.imageFile,
      contentType: 'image/png',
      declaredSizeBytes: contents.length,
      sizeBytes: contents.length,
      checksumSha256: checksum,
      scanResult: StoredFileScanResult.CLEAN,
      scanCompletedAt: now,
      uploadedAt: now,
      uploadUrlExpiresAt: now,
    },
    update: {
      status: StoredFileStatus.AVAILABLE,
      sizeBytes: contents.length,
      checksumSha256: checksum,
      scanResult: StoredFileScanResult.CLEAN,
      scanCompletedAt: now,
      uploadedAt: now,
    },
  });

  return stored.id;
}

async function upsertVariant(input: {
  id: string;
  sku: string;
  variantName: string;
  packSize: number;
  mrpPaise: number;
}): Promise<void> {
  await prisma.productVariant.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      productId: id.product,
      sku: input.sku,
      variantName: input.variantName,
      packSize: new Prisma.Decimal(input.packSize),
      packUnit: 'kg',
      mrpPaise: input.mrpPaise,
      hsnCode: '1008',
      gstRateBps: 0,
      isActive: true,
    },
    update: {
      isActive: true,
      mrpPaise: input.mrpPaise,
      hsnCode: '1008',
      gstRateBps: 0,
    },
  });
}

function placeholderSeedHsn(skuCode: string): string {
  if (skuCode.startsWith('PADDY')) return '1006';
  if (skuCode.startsWith('MAIZE')) return '1005';
  if (skuCode.startsWith('MUSTARD')) return '1207';
  return '1008';
}

async function upsertBatchWithOpeningStock(input: {
  id: string;
  variantId: string;
  batchNumber: string;
  openingQuantity: number;
  expiryInDays: number;
}): Promise<void> {
  await prisma.inventoryBatch.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      distributorOrganisationId: id.distributorOrganisation,
      warehouseId: id.warehouse,
      productId: id.product,
      variantId: input.variantId,
      batchNumber: input.batchNumber,
      manufacturingDate: dateOffset(-60),
      expiryDate: dateOffset(input.expiryInDays),
      germinationPercentage: new Prisma.Decimal(92.5),
      status: InventoryBatchStatus.ACTIVE,
    },
    update: {
      status: InventoryBatchStatus.ACTIVE,
    },
  });

  // Inventory movements are append-only: only open the balance once, otherwise
  // re-running this script would silently multiply stock.
  const existingMovementCount = await prisma.inventoryMovement.count({
    where: { batchId: input.id },
  });
  if (existingMovementCount > 0) {
    return;
  }

  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: id.distributorOrganisation,
      warehouseId: id.warehouse,
      batchId: input.id,
      productId: id.product,
      variantId: input.variantId,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: input.openingQuantity,
      balanceAfter: input.openingQuantity,
      reason: 'Demo opening stock for the MVP acceptance scenario',
      referenceType: 'DemoSeed',
      referenceId: input.batchNumber,
      createdByUserId: id.distributorOwnerUser,
    },
  });
}

async function upsertOffer(input: {
  id: string;
  variantId: string;
  batchId: string;
  offerCode: string;
  sellingPricePaise: number;
  maximumOrderQuantity: number;
}): Promise<void> {
  await prisma.distributorOffer.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      distributorOrganisationId: id.distributorOrganisation,
      productId: id.product,
      variantId: input.variantId,
      warehouseId: id.warehouse,
      batchId: input.batchId,
      offerCode: input.offerCode,
      sellingPricePaise: input.sellingPricePaise,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: input.maximumOrderQuantity,
      serviceablePincodes: SERVICEABLE_PINCODES,
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
    update: {
      sellingPricePaise: input.sellingPricePaise,
      serviceablePincodes: SERVICEABLE_PINCODES,
      status: DistributorOfferStatus.APPROVED,
    },
  });
}

function dateOffset(days: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function printSummary(): void {
  const lines = [
    '',
    'Demo data applied. Mock-auth headers for local testing:',
    '',
    `  Super admin        x-user-id: ${id.adminUser}`,
    `                     x-user-role: SUPER_ADMIN`,
    `                     x-organisation-id: ${id.adminOrganisation}`,
    '',
    `  Operations manager x-user-id: ${id.operationsUser}`,
    `                     x-user-role: OPERATIONS_MANAGER`,
    `                     x-organisation-id: ${id.adminOrganisation}`,
    '',
    `  Company owner      x-user-id: ${id.companyOwnerUser}`,
    `                     x-user-role: COMPANY_OWNER`,
    `                     x-organisation-id: ${id.companyOrganisation}`,
    '',
    `  Distributor owner  x-user-id: ${id.distributorOwnerUser}`,
    `                     x-user-role: DISTRIBUTOR_OWNER`,
    `                     x-organisation-id: ${id.distributorOrganisation}`,
    '',
    `  Delivery partner   x-user-id: ${id.deliveryPartnerUser}`,
    `                     x-user-role: DELIVERY_PARTNER`,
    `                     x-organisation-id: ${id.deliveryOrganisation}`,
    '',
    `  Farmer             x-user-id: ${id.farmerUser}`,
    `                     x-user-role: FARMER`,
    `                     x-organisation-id: ${id.farmerContextOrganisation}`,
    '',
    `  Promoter           x-user-id: ${id.promoterUser}`,
    `                     x-user-role: PROMOTER`,
    `                     x-organisation-id: ${id.adminOrganisation}`,
    '',
    `Farmer marketplace pincode: ${PINCODE}`,
    '',
    'Kisan Club (needs KISAN_CLUB_ENABLED=true on the API):',
    `  Member number      KC-DEMO-0001 (ACTIVE, advisory consent granted)`,
    `  Assigned promoter  ${id.promoterUser} in territory "Jaipur East"`,
    `  Farm / crop        Rampura North Field, wheat sown 40 days ago (RABI)`,
    `  Club benefit       Rs 25 off the 1kg variant, platform funded`,
    '',
    'Farmer app login: POST /auth/otp/request with the farmer phone, then',
    'POST /auth/otp/verify using the mockOtpCode from the first response.',
    `  Farmer phone       +919000000042`,
    '',
  ];
  console.info(lines.join('\n'));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
