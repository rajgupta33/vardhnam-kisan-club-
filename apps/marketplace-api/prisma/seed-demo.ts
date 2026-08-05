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
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryBatchStatus,
  InventoryMovementType,
  KycDocumentStatus,
  KycDocumentType,
  MembershipStatus,
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
} as const;

const PINCODE = '302001';
const SERVICEABLE_PINCODES = ['302001', '302002', '302012'];

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
      pincode: PINCODE,
      isDefault: true,
    },
    update: {
      isDefault: true,
    },
  });
}

async function seedFinance(): Promise<void> {
  // Placeholder rate pending real business approval, same treatment as
  // ProductInvoice.taxPaise = 0 until approved GST breakup rules exist.
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
      status: OrganisationStatus.ACTIVE,
    },
    update: {
      displayName: input.displayName,
      gstin: input.gstin ?? null,
      status: OrganisationStatus.ACTIVE,
    },
  });
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
      isActive: true,
    },
    update: {
      isActive: true,
      mrpPaise: input.mrpPaise,
    },
  });
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
    `Farmer marketplace pincode: ${PINCODE}`,
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
