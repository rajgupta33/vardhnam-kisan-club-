import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  '.env.example',
  'docker-compose.yml',
  'docs/PRODUCT_REQUIREMENTS.md',
  'docs/ARCHITECTURE.md',
  'docs/DATA_MODEL.md',
  'docs/API_CONTRACTS.md',
  'docs/BUSINESS_RULES.md',
  'docs/SECURITY_AND_COMPLIANCE.md',
  'docs/DEVELOPMENT_ROADMAP.md',
  'docs/DECISIONS/0001-initial-architecture.md',
  'apps/marketplace-api/src/access/access.module.ts',
  'apps/marketplace-api/src/access/permission-codes.ts',
  'apps/marketplace-api/src/access/permissions.guard.ts',
  'apps/marketplace-api/src/audit/audit.controller.ts',
  'apps/marketplace-api/src/cart/cart.controller.ts',
  'apps/marketplace-api/src/cart/cart.service.ts',
  'apps/marketplace-api/src/cart/dto/add-cart-item.dto.ts',
  'apps/marketplace-api/src/checkout/checkout.controller.ts',
  'apps/marketplace-api/src/checkout/checkout.service.ts',
  'apps/marketplace-api/src/checkout/checkout.module.ts',
  'apps/marketplace-api/src/checkout/dto/cancel-order.dto.ts',
  'apps/marketplace-api/src/checkout/dto/checkout-from-cart.dto.ts',
  'apps/marketplace-api/src/catalogue/catalogue.controller.ts',
  'apps/marketplace-api/src/catalogue/catalogue.service.ts',
  'apps/marketplace-api/src/farmers/farmers.controller.ts',
  'apps/marketplace-api/src/farmers/farmers.service.ts',
  'apps/marketplace-api/src/farmers/dto/upsert-farmer-profile.dto.ts',
  'apps/marketplace-api/src/inventory/inventory.controller.ts',
  'apps/marketplace-api/src/inventory/dto/inventory-ageing-query.dto.ts',
  'apps/marketplace-api/src/inventory/inventory.service.ts',
  'apps/marketplace-api/src/marketplace/marketplace.controller.ts',
  'apps/marketplace-api/src/marketplace/marketplace.service.ts',
  'apps/marketplace-api/src/offers/offers.controller.ts',
  'apps/marketplace-api/src/offers/dto/offer-status-operation.dto.ts',
  'apps/marketplace-api/src/offers/offers.service.ts',
  'apps/marketplace-api/src/onboarding/onboarding.controller.ts',
  'apps/marketplace-api/src/onboarding/onboarding.service.ts',
  'apps/marketplace-api/src/payments/payments.controller.ts',
  'apps/marketplace-api/src/payments/payments.service.ts',
  'apps/marketplace-api/src/payments/payments.module.ts',
  'apps/marketplace-api/src/payments/dto/create-mock-payment-intent.dto.ts',
  'apps/marketplace-api/src/payments/dto/confirm-mock-payment-intent.dto.ts',
  'apps/marketplace-api/package.json',
  'apps/marketplace-api/jest.config.cjs',
  'apps/marketplace-api/jest.integration.config.cjs',
  'apps/marketplace-api/prisma/schema.prisma',
  'apps/marketplace-api/prisma/migrations/20260801010000_phase1a_access_and_approvals/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260801020000_phase1b_onboarding_profiles/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260801030000_phase2a_catalogue_foundation/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260802010000_phase2b_inventory_foundation/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260803010000_phase2c_distributor_offers/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260803020000_phase3a_farmer_cart_foundation/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260803030000_phase3b_checkout_orders/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260803040000_phase3c_mock_payments/migration.sql',
  'apps/marketplace-api/prisma/migrations/20260803050000_phase3d_cancellations/migration.sql',
  'apps/business-web/package.json',
  'apps/business-web/src/app/audit/page.tsx',
  'apps/business-web/src/app/catalogue/page.tsx',
  'apps/business-web/src/app/catalogue/products/[productId]/page.tsx',
  'apps/business-web/src/app/inventory/page.tsx',
  'apps/business-web/src/app/inventory/ageing/page.tsx',
  'apps/business-web/src/app/inventory/warehouses/[warehouseId]/page.tsx',
  'apps/business-web/src/app/offers/page.tsx',
  'apps/business-web/src/app/offers/[offerId]/page.tsx',
  'apps/business-web/src/app/onboarding/[organisationId]/page.tsx',
  'apps/business-web/src/lib/marketplace-api.ts',
  'apps/farmer-mobile/pubspec.yaml',
  'apps/farmer-mobile/lib/src/screens/cart_screen.dart',
  'apps/farmer-mobile/lib/src/screens/checkout_review_screen.dart',
  'apps/farmer-mobile/lib/src/screens/product_browse_screen.dart',
  'apps/partner-mobile/pubspec.yaml',
  'apps/marketplace-api/test/integration/phase1c-onboarding.spec.ts',
  'apps/marketplace-api/test/integration/phase2a-catalogue.spec.ts',
  'apps/marketplace-api/test/integration/phase2b-inventory.spec.ts',
  'apps/marketplace-api/test/integration/phase2c-offers.spec.ts',
  'apps/marketplace-api/test/integration/phase2d-marketplace.spec.ts',
  'apps/marketplace-api/test/integration/phase2e-operations.spec.ts',
  'apps/marketplace-api/test/integration/phase3a-farmer-cart.spec.ts',
  'apps/marketplace-api/test/integration/phase3b-checkout-orders.spec.ts',
  'apps/marketplace-api/test/integration/phase3c-mock-payments.spec.ts',
  'apps/marketplace-api/test/integration/phase3d-cancellations.spec.ts',
  '.github/workflows/ci.yml',
];

test('Phase 0 required files exist', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
});

test('root package declares expected workspaces', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.deepEqual(pkg.workspaces, [
    'apps/marketplace-api',
    'apps/business-web',
    'packages/shared-types',
    'packages/validation',
    'packages/api-client',
    'packages/design-tokens',
  ]);
});

test('Prisma schema contains Phase 0 foundation models', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  for (const model of [
    'model User',
    'model UserProfile',
    'model Organisation',
    'model OrganisationMembership',
    'model Permission',
    'model RolePermission',
    'model AuditLog',
    'model IdempotencyRecord',
  ]) {
    assert.match(schema, new RegExp(model));
  }
  assert.match(schema, /@@unique\(\[userId, organisationId, role\]\)/);
  assert.match(schema, /reviewedByUserId/);
});

test('Phase 0 docs preserve commercial model boundaries', () => {
  const rules = readFileSync('AGENTS.md', 'utf8');
  assert.match(rules, /farmer is the buyer/i);
  assert.match(rules, /distributor is normally the seller of record/i);
  assert.match(rules, /Do not combine product inventory and service availability/i);
});

test('Phase 1A access files define permission-backed enforcement', () => {
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const guard = readFileSync('apps/marketplace-api/src/access/permissions.guard.ts', 'utf8');
  assert.match(permissions, /organisations:approve/);
  assert.match(permissions, /memberships:update:any/);
  assert.match(guard, /requiredPermissions/);
});

test('Phase 1B onboarding files define approval-ready profile and KYC foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');

  for (const model of ['model CompanyProfile', 'model DistributorProfile', 'model KycDocument']) {
    assert.match(schema, new RegExp(model));
  }

  assert.match(schema, /enum KycDocumentType/);
  assert.match(schema, /enum KycDocumentStatus/);
  assert.match(permissions, /onboarding:queue:read/);
  assert.match(permissions, /kyc-documents:review/);
  assert.match(appModule, /OnboardingModule/);
});

test('Phase 1C portal files connect onboarding review and audit surfaces', () => {
  // The onboarding queue moved off the portal home when `/` became the
  // role-aware dashboard; it now lives on its own route.
  const queuePage = readFileSync('apps/business-web/src/app/onboarding/page.tsx', 'utf8');
  const detailPage = readFileSync(
    'apps/business-web/src/app/onboarding/[organisationId]/page.tsx',
    'utf8',
  );
  const auditPage = readFileSync('apps/business-web/src/app/audit/page.tsx', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase1c-onboarding.spec.ts',
    'utf8',
  );

  assert.match(queuePage, /loadApprovalQueue/);
  assert.match(detailPage, /reviewKycDocumentAction/);
  assert.match(auditPage, /loadAuditLogs/);
  assert.match(client, /listOnboardingApprovalQueue/);
  assert.match(client, /reviewOrganisation/);
  assert.match(integration, /KYC_DOCUMENT_REVIEWED/);
});

test('Phase 2A catalogue files define approval-ready catalogue foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const service = readFileSync('apps/marketplace-api/src/catalogue/catalogue.service.ts', 'utf8');
  const cataloguePage = readFileSync('apps/business-web/src/app/catalogue/page.tsx', 'utf8');
  const productDetail = readFileSync(
    'apps/business-web/src/app/catalogue/products/[productId]/page.tsx',
    'utf8',
  );
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase2a-catalogue.spec.ts',
    'utf8',
  );

  for (const model of [
    'model Brand',
    'model MasterProduct',
    'model ProductVariant',
    'model ProductDocument',
  ]) {
    assert.match(schema, new RegExp(model));
  }

  assert.match(schema, /enum CatalogueStatus/);
  assert.match(schema, /enum ProductDocumentType/);
  assert.match(permissions, /catalogue:review/);
  assert.match(permissions, /catalogue:submit:own/);
  assert.match(appModule, /CatalogueModule/);
  assert.match(service, /Only submitted .* records may be reviewed/);
  assert.match(cataloguePage, /loadProductReviewQueue/);
  assert.match(productDetail, /reviewProductAction/);
  assert.match(client, /listProductReviewQueue/);
  assert.match(client, /reviewProduct/);
  assert.match(integration, /MASTER_PRODUCT_APPROVED/);
});

test('Phase 2B inventory files define distributor warehouse and movement foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const service = readFileSync('apps/marketplace-api/src/inventory/inventory.service.ts', 'utf8');
  const inventoryPage = readFileSync('apps/business-web/src/app/inventory/page.tsx', 'utf8');
  const warehouseDetail = readFileSync(
    'apps/business-web/src/app/inventory/warehouses/[warehouseId]/page.tsx',
    'utf8',
  );
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase2b-inventory.spec.ts',
    'utf8',
  );

  for (const model of ['model Warehouse', 'model InventoryBatch', 'model InventoryMovement']) {
    assert.match(schema, new RegExp(model));
  }

  assert.match(schema, /enum InventoryMovementType/);
  assert.match(permissions, /inventory:adjust:own/);
  assert.match(permissions, /warehouses:write:own/);
  assert.match(appModule, /InventoryModule/);
  assert.match(service, /Inventory adjustment cannot reduce batch stock below zero/);
  assert.match(inventoryPage, /loadInventoryBatches/);
  assert.match(warehouseDetail, /loadInventoryMovements/);
  assert.match(client, /listWarehouses/);
  assert.match(client, /createInventoryAdjustment/);
  assert.match(integration, /INVENTORY_MOVEMENT_RECORDED/);
});

test('Phase 2C offer files define distributor offer and approval foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const service = readFileSync('apps/marketplace-api/src/offers/offers.service.ts', 'utf8');
  const offerQueue = readFileSync('apps/business-web/src/app/offers/page.tsx', 'utf8');
  const offerDetail = readFileSync('apps/business-web/src/app/offers/[offerId]/page.tsx', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase2c-offers.spec.ts',
    'utf8',
  );

  assert.match(schema, /model DistributorOffer/);
  assert.match(schema, /enum DistributorOfferStatus/);
  assert.match(schema, /enum FulfilmentMode/);
  assert.match(permissions, /offers:submit:own/);
  assert.match(permissions, /offers:review/);
  assert.match(appModule, /OffersModule/);
  assert.match(service, /availableQuantityForOffer/);
  assert.match(service, /Offer is not ready for review/);
  assert.match(offerQueue, /loadOfferReviewQueue/);
  assert.match(offerDetail, /reviewOfferAction/);
  assert.match(client, /listOfferReviewQueue/);
  assert.match(client, /reviewOffer/);
  assert.match(integration, /DISTRIBUTOR_OFFER_APPROVED/);
});

test('Phase 2D marketplace files define farmer-safe discovery foundations', () => {
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const service = readFileSync(
    'apps/marketplace-api/src/marketplace/marketplace.service.ts',
    'utf8',
  );
  const controller = readFileSync(
    'apps/marketplace-api/src/marketplace/marketplace.controller.ts',
    'utf8',
  );
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const farmerBrowse = readFileSync(
    'apps/farmer-mobile/lib/src/screens/product_browse_screen.dart',
    'utf8',
  );
  const farmerMarketplaceApi = readFileSync(
    'apps/farmer-mobile/lib/src/marketplace/marketplace_api.dart',
    'utf8',
  );
  const farmerStrings = readFileSync('apps/farmer-mobile/lib/l10n/app_en.arb', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase2d-marketplace.spec.ts',
    'utf8',
  );

  assert.match(appModule, /MarketplaceModule/);
  assert.match(service, /availableQuantityForOffer/);
  assert.match(service, /DistributorOfferStatus\.APPROVED/);
  assert.match(service, /serviceablePincodes/);
  assert.match(controller, /Controller\('marketplace'\)/);
  assert.match(client, /listMarketplaceProducts/);
  assert.match(client, /getMarketplaceProduct/);
  assert.match(farmerMarketplaceApi, /MarketplaceHttpProductRepository/);
  assert.match(farmerMarketplaceApi, /api\/v1\/marketplace\/products/);
  assert.match(farmerBrowse, /ProductBrowseScreen/);
  assert.match(farmerBrowse, /_loadProducts/);
  assert.match(farmerBrowse, /discoveryPreviewLabel/);
  assert.match(farmerStrings, /"browseTitle"/);
  assert.match(farmerStrings, /"enterValidPincode"/);
  assert.match(apiDocs, /Phase 2D Marketplace Discovery Endpoints/);
  assert.match(integration, /marketplace\/products/);
});

test('Phase 2E operational files define offer operations and inventory ageing', () => {
  const offerService = readFileSync('apps/marketplace-api/src/offers/offers.service.ts', 'utf8');
  const offerController = readFileSync(
    'apps/marketplace-api/src/offers/offers.controller.ts',
    'utf8',
  );
  const inventoryService = readFileSync(
    'apps/marketplace-api/src/inventory/inventory.service.ts',
    'utf8',
  );
  const inventoryController = readFileSync(
    'apps/marketplace-api/src/inventory/inventory.controller.ts',
    'utf8',
  );
  const inventoryAgeingPage = readFileSync(
    'apps/business-web/src/app/inventory/ageing/page.tsx',
    'utf8',
  );
  const offerDetail = readFileSync('apps/business-web/src/app/offers/[offerId]/page.tsx', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase2e-operations.spec.ts',
    'utf8',
  );

  assert.match(offerService, /pauseOffer/);
  assert.match(offerService, /DISTRIBUTOR_OFFER_REACTIVATED/);
  assert.match(offerService, /DISTRIBUTOR_OFFER_ARCHIVED/);
  assert.match(offerController, /:offerId\/pause/);
  assert.match(inventoryService, /listInventoryAgeing/);
  assert.match(inventoryService, /isExpiringSoon/);
  assert.match(inventoryController, /reports\/low-stock/);
  assert.match(inventoryAgeingPage, /Inventory Ageing/);
  assert.match(offerDetail, /Offer Status Controls/);
  assert.match(client, /listLowStockInventory/);
  assert.match(apiDocs, /Phase 2E Offer Operations And Inventory Reporting Endpoints/);
  assert.match(integration, /DISTRIBUTOR_OFFER_PAUSED/);
});

test('Phase 3A farmer commerce files define profile, address and cart foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const farmersService = readFileSync(
    'apps/marketplace-api/src/farmers/farmers.service.ts',
    'utf8',
  );
  const cartService = readFileSync('apps/marketplace-api/src/cart/cart.service.ts', 'utf8');
  const cartController = readFileSync('apps/marketplace-api/src/cart/cart.controller.ts', 'utf8');
  const farmerCart = readFileSync('apps/farmer-mobile/lib/src/screens/cart_screen.dart', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase3a-farmer-cart.spec.ts',
    'utf8',
  );

  for (const model of [
    'model FarmerProfile',
    'model FarmerAddress',
    'model Cart',
    'model CartItem',
  ]) {
    assert.match(schema, new RegExp(model));
  }

  assert.match(schema, /priceSnapshotPaise/);
  assert.match(permissions, /farmer-profile:write:own/);
  assert.match(permissions, /cart:write:own/);
  assert.match(appModule, /FarmersModule/);
  assert.match(appModule, /CartModule/);
  assert.match(farmersService, /FARMER_ADDRESS_CREATED/);
  assert.match(cartService, /Requested quantity exceeds backend-derived sellable availability/);
  assert.match(cartService, /CartStatus\.ACTIVE/);
  assert.match(cartController, /Controller\('cart'\)/);
  assert.match(farmerCart, /CartScreen/);
  assert.match(farmerCart, /priceSnapshotPaise/);
  assert.match(client, /upsertMyFarmerProfile/);
  assert.match(client, /addCartItem/);
  assert.match(apiDocs, /Phase 3A Farmer Profile, Address And Cart Endpoints/);
  assert.match(integration, /CART_ITEM_ADDED/);
});

test('Phase 3B checkout files define order orchestration and reservation foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const checkoutService = readFileSync(
    'apps/marketplace-api/src/checkout/checkout.service.ts',
    'utf8',
  );
  const checkoutController = readFileSync(
    'apps/marketplace-api/src/checkout/checkout.controller.ts',
    'utf8',
  );
  const ordersController = readFileSync(
    'apps/marketplace-api/src/checkout/orders.controller.ts',
    'utf8',
  );
  const checkoutReview = readFileSync(
    'apps/farmer-mobile/lib/src/screens/checkout_review_screen.dart',
    'utf8',
  );
  const farmerStrings = readFileSync('apps/farmer-mobile/lib/l10n/app_en.arb', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase3b-checkout-orders.spec.ts',
    'utf8',
  );

  for (const model of [
    'model ProductCheckout',
    'model ProductOrder',
    'model ProductOrderItem',
    'model ProductOrderItemReservation',
    'model ProductOrderStatusHistory',
  ]) {
    assert.match(schema, new RegExp(model));
  }

  assert.match(schema, /RESERVED_FOR_ORDER/);
  assert.match(schema, /enum ProductOrderStatus/);
  assert.match(permissions, /checkout:create:own/);
  assert.match(permissions, /orders:read:own/);
  assert.match(appModule, /CheckoutModule/);
  assert.match(checkoutService, /Idempotency-Key header is required for \${actionLabel}/);
  assert.match(checkoutService, /INVENTORY_RESERVED_FOR_ORDER/);
  assert.match(checkoutController, /from-cart/);
  assert.match(ordersController, /Controller\('orders'\)/);
  assert.match(checkoutReview, /CheckoutReviewScreen/);
  assert.match(checkoutReview, /ChildOrder/);
  assert.match(client, /checkoutFromCart/);
  assert.match(client, /listMyOrders/);
  assert.match(apiDocs, /Phase 3B Checkout And Product Order Endpoints/);
  assert.match(integration, /PRODUCT_CHECKOUT_CREATED/);
});

test('Phase 3C mock payment files define backend-confirmed payment foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const appModule = readFileSync('apps/marketplace-api/src/app.module.ts', 'utf8');
  const paymentsService = readFileSync(
    'apps/marketplace-api/src/payments/payments.service.ts',
    'utf8',
  );
  const paymentsController = readFileSync(
    'apps/marketplace-api/src/payments/payments.controller.ts',
    'utf8',
  );
  // Settlement outcomes moved out of `payments.service.ts` into their own
  // service; the audit action names live there now.
  const paymentSettlement = readFileSync(
    'apps/marketplace-api/src/payments/payment-settlement.service.ts',
    'utf8',
  );
  const checkoutReview = readFileSync(
    'apps/farmer-mobile/lib/src/screens/checkout_review_screen.dart',
    'utf8',
  );
  const farmerStrings = readFileSync('apps/farmer-mobile/lib/l10n/app_en.arb', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase3c-mock-payments.spec.ts',
    'utf8',
  );

  assert.match(schema, /model PaymentIntent/);
  assert.match(schema, /model PaymentEvent/);
  assert.match(schema, /enum PaymentIntentStatus/);
  assert.match(schema, /PAYMENT_PROCESSING/);
  assert.match(permissions, /payments:create:own/);
  assert.match(permissions, /payments:confirm:own/);
  assert.match(appModule, /PaymentsModule/);
  assert.match(paymentsService, /Idempotency-Key header is required for mock payment actions/);
  assert.match(paymentSettlement, /MOCK_PAYMENT_CONFIRMED/);
  assert.match(paymentsController, /payments\/mock-intents/);
  assert.match(checkoutReview, /_PaymentAndCancellationPanel/);
  assert.match(farmerStrings, /"mockPaymentTitle"/);
  assert.match(client, /createMockPaymentIntent/);
  assert.match(client, /confirmMockPaymentIntent/);
  assert.match(apiDocs, /Phase 3C Mock Payment Endpoints/);
  assert.match(integration, /MOCK_PAYMENT_INTENT_CREATED/);
});

test('Phase 3D cancellation files define reservation release foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const checkoutService = readFileSync(
    'apps/marketplace-api/src/checkout/checkout.service.ts',
    'utf8',
  );
  const checkoutController = readFileSync(
    'apps/marketplace-api/src/checkout/checkout.controller.ts',
    'utf8',
  );
  const ordersController = readFileSync(
    'apps/marketplace-api/src/checkout/orders.controller.ts',
    'utf8',
  );
  const checkoutReview = readFileSync(
    'apps/farmer-mobile/lib/src/screens/checkout_review_screen.dart',
    'utf8',
  );
  const farmerStrings = readFileSync('apps/farmer-mobile/lib/l10n/app_en.arb', 'utf8');
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const businessRules = readFileSync('docs/BUSINESS_RULES.md', 'utf8');
  const integration = readFileSync(
    'apps/marketplace-api/test/integration/phase3d-cancellations.spec.ts',
    'utf8',
  );

  assert.match(schema, /RELEASED_FROM_ORDER/);
  assert.match(permissions, /checkout:cancel:own/);
  assert.match(permissions, /orders:cancel:own/);
  assert.match(checkoutService, /PRODUCT_CHECKOUT_CANCELLED_BY_FARMER/);
  assert.match(checkoutService, /INVENTORY_RELEASED_FROM_ORDER/);
  assert.match(checkoutController, /:checkoutId\/cancel/);
  assert.match(ordersController, /:orderId\/cancel/);
  assert.match(checkoutReview, /_PaymentAndCancellationPanel/);
  assert.match(farmerStrings, /"cancellationActionLabel"/);
  assert.match(client, /cancelMyCheckout/);
  assert.match(client, /cancelMyOrder/);
  assert.match(apiDocs, /Phase 3D Cancellation And Reservation Release Endpoints/);
  assert.match(businessRules, /RELEASED_FROM_ORDER/);
  assert.match(integration, /ProductOrderCancellation/);
});

test('Phase 4 fulfilment files define distributor accept, reject, pick, pack, invoice, dispatch and delivery foundations', () => {
  const schema = readFileSync('apps/marketplace-api/prisma/schema.prisma', 'utf8');
  const permissions = readFileSync('apps/marketplace-api/src/access/permission-codes.ts', 'utf8');
  const checkoutService = readFileSync(
    'apps/marketplace-api/src/checkout/checkout.service.ts',
    'utf8',
  );
  const fulfilmentController = readFileSync(
    'apps/marketplace-api/src/checkout/fulfilment-orders.controller.ts',
    'utf8',
  );
  const client = readFileSync('packages/api-client/src/index.ts', 'utf8');
  const portalCopy = readFileSync('apps/business-web/src/content/portal-copy.ts', 'utf8');
  const ordersPage = readFileSync('apps/business-web/src/app/orders/page.tsx', 'utf8');
  const orderDetailPage = readFileSync(
    'apps/business-web/src/app/orders/[orderId]/page.tsx',
    'utf8',
  );
  const orderActions = readFileSync('apps/business-web/src/app/orders/actions.ts', 'utf8');
  const apiDocs = readFileSync('docs/API_CONTRACTS.md', 'utf8');
  const businessRules = readFileSync('docs/BUSINESS_RULES.md', 'utf8');

  assert.match(permissions, /fulfilment-orders:read:own/);
  assert.match(permissions, /fulfilment-orders:manage:any/);
  assert.match(schema, /model ProductInvoice/);
  assert.match(schema, /ProductInvoiceStatus/);
  assert.match(schema, /model ProductDispatch/);
  assert.match(schema, /ProductDispatchStatus/);
  assert.match(schema, /model ProductDeliveryAssignment/);
  assert.match(schema, /ProductDeliveryAssignmentStatus/);
  assert.match(permissions, /delivery-assignments:manage:own/);
  assert.match(checkoutService, /PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR/);
  assert.match(checkoutService, /PRODUCT_ORDER_REJECTED_BY_DISTRIBUTOR/);
  assert.match(checkoutService, /PRODUCT_ORDER_READY_TO_PACK/);
  assert.match(checkoutService, /PRODUCT_ORDER_PACKED/);
  assert.match(checkoutService, /PRODUCT_INVOICE_GENERATED/);
  assert.match(checkoutService, /PRODUCT_ORDER_READY_FOR_PICKUP/);
  assert.match(checkoutService, /PRODUCT_DISPATCH_CREATED/);
  assert.match(checkoutService, /PRODUCT_DELIVERY_ASSIGNED/);
  assert.match(checkoutService, /PRODUCT_DELIVERY_OUT_FOR_DELIVERY/);
  assert.match(checkoutService, /PRODUCT_DELIVERY_DELIVERED/);
  assert.match(checkoutService, /PRODUCT_DELIVERY_OTP_FAILED/);
  assert.match(checkoutService, /ProductOrderStatus\.CONFIRMED/);
  assert.match(checkoutService, /ProductOrderStatus\.READY_TO_PACK/);
  assert.match(checkoutService, /ProductOrderStatus\.PACKED/);
  assert.match(checkoutService, /ProductOrderStatus\.READY_FOR_PICKUP/);
  assert.match(checkoutService, /ProductOrderStatus\.OUT_FOR_DELIVERY/);
  assert.match(checkoutService, /ProductOrderStatus\.DELIVERED/);
  assert.match(fulfilmentController, /fulfilment\/orders/);
  assert.match(fulfilmentController, /:orderId\/accept/);
  assert.match(fulfilmentController, /:orderId\/reject/);
  assert.match(fulfilmentController, /:orderId\/ready-to-pack/);
  assert.match(fulfilmentController, /:orderId\/pack/);
  assert.match(fulfilmentController, /:orderId\/invoice/);
  assert.match(fulfilmentController, /:orderId\/ready-for-pickup/);
  assert.match(fulfilmentController, /:orderId\/delivery-assignment/);
  assert.match(fulfilmentController, /:orderId\/out-for-delivery/);
  assert.match(fulfilmentController, /:orderId\/deliver/);
  assert.match(client, /listFulfilmentOrders/);
  assert.match(client, /acceptFulfilmentOrder/);
  assert.match(client, /markFulfilmentOrderReadyToPack/);
  assert.match(client, /packFulfilmentOrder/);
  assert.match(client, /generateFulfilmentOrderInvoice/);
  assert.match(client, /markFulfilmentOrderReadyForPickup/);
  assert.match(client, /assignFulfilmentOrderDelivery/);
  assert.match(client, /markFulfilmentOrderOutForDelivery/);
  assert.match(client, /completeFulfilmentOrderDelivery/);
  assert.match(portalCopy, /Orders/);
  assert.match(ordersPage, /Product Order Dashboard/);
  assert.match(orderDetailPage, /Fulfilment Actions/);
  assert.match(orderDetailPage, /Generate invoice/);
  assert.match(orderDetailPage, /Mark ready for pickup/);
  assert.match(orderDetailPage, /Assign delivery/);
  assert.match(orderDetailPage, /Complete delivery/);
  assert.match(orderActions, /rejectOrderAction/);
  assert.match(orderActions, /markReadyToPackAction/);
  assert.match(orderActions, /packOrderAction/);
  assert.match(orderActions, /generateInvoiceAction/);
  assert.match(orderActions, /markReadyForPickupAction/);
  assert.match(orderActions, /assignDeliveryAction/);
  assert.match(orderActions, /completeDeliveryAction/);
  assert.match(apiDocs, /Phase 4A To 4E Distributor Fulfilment Endpoints/);
  assert.match(businessRules, /DISTRIBUTOR_ACCEPTED/);
  assert.match(businessRules, /READY_TO_PACK/);
  assert.match(businessRules, /PRODUCT_INVOICE_GENERATED/);
  assert.match(businessRules, /PRODUCT_DISPATCH_CREATED/);
  assert.match(businessRules, /PRODUCT_DELIVERY_ASSIGNED/);
  assert.match(businessRules, /DELIVERED/);
});
