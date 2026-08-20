import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  DeliveryPartnerAvailabilityStatus,
  FulfilmentMode,
  InventoryMovementType,
  KycDocumentStatus,
  KycDocumentType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
  ProductCheckoutStatus,
  ProductDocumentType,
  ProductOrderStatus,
  ReturnInspectionOutcome,
  ReturnReasonCode,
  StoredFilePurpose,
  StoredFileScanResult,
  StoredFileStatus,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { createJobEnvelope } from '../../src/jobs/job-envelope';
import { CatalogueReviewDecision } from '../../src/catalogue/dto/review-catalogue-item.dto';
import { OfferReviewDecision } from '../../src/offers/dto/review-offer.dto';
import { OrganisationReviewDecision } from '../../src/organisations/dto/review-organisation.dto';
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';
import { ExecuteRefundHandler } from '../../src/refunds/execute-refund.handler';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

const PINCODE = '302001';
const SELLING_PRICE_PAISE = 118000;
const ORDER_QUANTITY = 3;
const OPENING_STOCK = 60;

/**
 * End-to-end coverage of the MVP acceptance scenario in
 * `docs/PRODUCT_REQUIREMENTS.md` section 30.
 *
 * Every step below is driven through the public HTTP API rather than seeded
 * directly through Prisma, so this spec is the proof that Phase 1 through
 * Phase 6 (scoped to promoter attribution) actually compose into one working
 * journey. All 26 steps, including step 8 (a promoter registers a farmer --
 * modeled here as an operations-mediated attribution of an existing farmer,
 * not full promoter-led registration, which stays out of scope) and steps
 * 22-25 (distributor payable, marketplace commission, promoter commission,
 * return-window completion, settlement eligibility), are exercised directly.
 */
describe('MVP acceptance scenario (PRODUCT_REQUIREMENTS section 30)', () => {
  let app: INestApplication | undefined;
  let actors: Awaited<ReturnType<typeof seedActors>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    actors = await seedActors();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('runs the full farmer journey through delivery, return inspection and refund', async () => {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const server = app.getHttpServer();
    const suffix = randomUUID().slice(0, 8);

    // ---------------------------------------------------------------------
    // Steps 1-2: an administrator approves the company and the distributor.
    // ---------------------------------------------------------------------
    // Before approval, the company owner cannot authenticate into a pending
    // organisation at all. This is business truth 7 enforced at the door, and
    // it is why the onboarding records below are created by the administrator.
    await request(server).get('/api/v1/catalogue/brands').set(actors.companyHeaders).expect(401);

    // An organisation cannot be approved before its onboarding profile and at
    // least one approved KYC document exist.
    await request(server)
      .post(`/api/v1/organisations/${actors.companyOrganisationId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: OrganisationReviewDecision.APPROVE })
      .expect(400);

    await request(server)
      .put(`/api/v1/onboarding/organisations/${actors.companyOrganisationId}/company-profile`)
      .set(actors.adminHeaders)
      .send({
        brandName: 'Acceptance Seeds',
        registrationNumber: 'U01100RJ2026PTC000001',
        pan: 'ABCDE1234F',
        primaryContactName: 'Ramesh Sharma',
        primaryContactPhone: '+919999999999',
        primaryContactEmail: 'company@example.local',
        registeredAddress: '4th Floor, Agri Tower, Tonk Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: PINCODE,
        reason: 'Initial company onboarding details',
      })
      .expect(200);
    await approveKycDocument(server, actors.companyOrganisationId, '27ABCDE1234F1Z5');

    await request(server)
      .put(
        `/api/v1/onboarding/organisations/${actors.distributorOrganisationId}/distributor-profile`,
      )
      .set(actors.adminHeaders)
      .send({
        distributorCode: `DIST-JAI-${suffix.slice(0, 4).toUpperCase()}`,
        pan: 'ZYXWV9876S',
        primaryContactName: 'Suresh Jain',
        primaryContactPhone: '+919888888888',
        primaryContactEmail: 'distributor@example.local',
        operatingAddress: 'Plot 12, Agri Market Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: PINCODE,
        serviceablePincodes: [PINCODE],
        fulfilmentCapability: 'Own delivery and Vardhnam-assisted pickup',
        reason: 'Initial distributor onboarding details',
      })
      .expect(200);
    await approveKycDocument(server, actors.distributorOrganisationId, '08ABCDE1234F1Z5');

    const approvedCompany = await request(server)
      .post(`/api/v1/organisations/${actors.companyOrganisationId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: OrganisationReviewDecision.APPROVE })
      .expect(201);
    expect(approvedCompany.body.data.status).toBe(OrganisationStatus.ACTIVE);

    const approvedDistributor = await request(server)
      .post(`/api/v1/organisations/${actors.distributorOrganisationId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: OrganisationReviewDecision.APPROVE })
      .expect(201);
    expect(approvedDistributor.body.data.status).toBe(OrganisationStatus.ACTIVE);

    // ---------------------------------------------------------------------
    // Steps 3-4: the company submits a product and the administrator approves it.
    // ---------------------------------------------------------------------
    const brandResponse = await request(server)
      .post('/api/v1/catalogue/brands')
      .set(actors.companyHeaders)
      .send({
        name: `Vardhnam Acceptance Seeds ${suffix}`,
        slug: `vardhnam-acceptance-seeds-${suffix}`,
        description: 'Brand created during the MVP acceptance run',
        reason: 'Initial brand record for acceptance scenario',
      })
      .expect(201);
    const brandId = brandResponse.body.data.id as string;
    expect(brandResponse.body.data.status).toBe(CatalogueStatus.DRAFT);

    // Business truth 4: the company owns the catalogue but cannot self-approve it.
    await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/review`)
      .set(actors.companyHeaders)
      .send({ decision: CatalogueReviewDecision.APPROVE })
      .expect(403);

    await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/submit`)
      .set(actors.companyHeaders)
      .send({ reason: 'Brand ready for catalogue review' })
      .expect(201);
    await request(server)
      .post(`/api/v1/catalogue/brands/${brandId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: CatalogueReviewDecision.APPROVE })
      .expect(201);

    const productResponse = await request(server)
      .post('/api/v1/catalogue/products')
      .set(actors.companyHeaders)
      .send({
        brandId,
        name: `Hybrid Bajra Seed ${suffix}`,
        slug: `hybrid-bajra-seed-${suffix}`,
        category: 'Seeds',
        description: 'Drought tolerant hybrid bajra seed for Kharif sowing',
        cropTargets: ['Bajra'],
        reason: 'Initial product master for acceptance scenario',
      })
      .expect(201);
    const productId = productResponse.body.data.id as string;

    const variantResponse = await request(server)
      .post(`/api/v1/catalogue/products/${productId}/variants`)
      .set(actors.companyHeaders)
      .send({
        sku: `SEED-BAJRA-1KG-${suffix}`,
        variantName: '1 kg pack',
        packSize: 1,
        packUnit: 'kg',
        mrpPaise: 125000,
        hsnCode: '1008',
        gstRateBps: 500,
        reason: 'Initial pack size',
      })
      .expect(201);
    const variantId = variantResponse.body.data.id as string;

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/documents`)
      .set(actors.companyHeaders)
      .send({
        documentType: ProductDocumentType.LABEL,
        title: 'Product label metadata',
        fileName: `hybrid-bajra-label-${suffix}.pdf`,
        storageKey: `mock/catalogue/hybrid-bajra-label-${suffix}.pdf`,
        reason: 'Add label metadata for acceptance scenario',
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/catalogue/products/${productId}/submit`)
      .set(actors.companyHeaders)
      .send({ reason: 'Product ready for catalogue review' })
      .expect(201);

    const approvedProduct = await request(server)
      .post(`/api/v1/catalogue/products/${productId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: CatalogueReviewDecision.APPROVE })
      .expect(201);
    expect(approvedProduct.body.data.status).toBe(CatalogueStatus.APPROVED);

    // ---------------------------------------------------------------------
    // Steps 5-6: the distributor creates a warehouse and receives batch stock.
    // ---------------------------------------------------------------------
    const warehouseResponse = await request(server)
      .post('/api/v1/inventory/warehouses')
      .set(actors.distributorHeaders)
      .send({
        code: `JPR-${suffix.slice(0, 4).toUpperCase()}`,
        name: 'Jaipur Main Warehouse',
        addressLine1: 'Plot 12, Agri Market Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: PINCODE,
        contactName: 'Ramesh Sharma',
        contactPhone: '+919999999999',
        reason: 'Initial warehouse setup for acceptance scenario',
      })
      .expect(201);
    const warehouseId = warehouseResponse.body.data.id as string;

    const batchResponse = await request(server)
      .post('/api/v1/inventory/batches')
      .set(actors.distributorHeaders)
      .send({
        warehouseId,
        variantId,
        batchNumber: `BATCH-${suffix.toUpperCase()}`,
        expiryDate: isoDate(365),
        germinationPercentage: 92.5,
        openingQuantity: OPENING_STOCK,
        reason: 'Opening batch stock after physical count',
      })
      .expect(201);
    const batchId = batchResponse.body.data.id as string;

    // Business truth: stock arrives as an append-only movement, not a mutable counter.
    const openingMovements = await request(server)
      .get('/api/v1/inventory/movements')
      .query({ batchId, limit: 50 })
      .set(actors.distributorHeaders)
      .expect(200);
    expect(openingMovements.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          movementType: InventoryMovementType.OPENING_STOCK,
          quantityDelta: OPENING_STOCK,
          balanceAfter: OPENING_STOCK,
        }),
      ]),
    );

    // ---------------------------------------------------------------------
    // Step 7: the distributor activates an offer against the approved product.
    // ---------------------------------------------------------------------
    const offerResponse = await request(server)
      .post('/api/v1/offers')
      .set(actors.distributorHeaders)
      .send({
        variantId,
        warehouseId,
        batchId,
        offerCode: `OFFER-KHARIF-${suffix.toUpperCase()}`,
        sellingPricePaise: SELLING_PRICE_PAISE,
        minimumOrderQuantity: 1,
        maximumOrderQuantity: 20,
        serviceablePincodes: [PINCODE],
        fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
        deliverySlaDays: 3,
        reason: 'Distributor offer created for Kharif demand',
      })
      .expect(201);
    const offerId = offerResponse.body.data.id as string;

    await request(server)
      .post(`/api/v1/offers/${offerId}/submit`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Ready for distributor offer review' })
      .expect(201);
    const approvedOffer = await request(server)
      .post(`/api/v1/offers/${offerId}/review`)
      .set(actors.adminHeaders)
      .send({ decision: OfferReviewDecision.APPROVE })
      .expect(201);
    expect(approvedOffer.body.data.status).toBe(DistributorOfferStatus.APPROVED);

    // ---------------------------------------------------------------------
    // Steps 9-10: the farmer signs in and sees the product for their pincode.
    // ---------------------------------------------------------------------
    await request(server)
      .put('/api/v1/farmers/me/profile')
      .set(actors.farmerHeaders)
      .send({
        fullName: 'Acceptance Farmer',
        preferredLocale: 'hi-IN',
        primaryPincode: PINCODE,
        cropInterests: ['Bajra'],
      })
      .expect(200);

    // ---------------------------------------------------------------------
    // Step 8: a promoter registers a farmer. Modeled as an operations-mediated
    // attribution of the (already seeded) farmer to the seeded promoter --
    // full promoter-led registration (KYC, lead creation, assisted ordering)
    // stays out of scope.
    // ---------------------------------------------------------------------
    const attributionResponse = await request(server)
      .post('/api/v1/promoters/attributions')
      .set(actors.operationsHeaders)
      .send({
        promoterUserId: actors.promoterUserId,
        farmerUserId: actors.farmerUserId,
        reason: 'Promoter registered this farmer during the acceptance scenario',
      })
      .expect(201);
    expect(attributionResponse.body.data.status).toBe('ACTIVE');

    const addressResponse = await request(server)
      .post('/api/v1/farmers/me/addresses')
      .set(actors.farmerHeaders)
      .send({
        label: 'Home',
        recipientName: 'Acceptance Farmer',
        phone: '+919999999999',
        addressLine1: 'Khasra 42, Rampura Road',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: PINCODE,
      })
      .expect(201);
    const farmerAddressId = addressResponse.body.data.id as string;

    // Marketplace discovery is public and farmer-safe: no auth headers are sent.
    const discoveryResponse = await request(server)
      .get('/api/v1/marketplace/products')
      .query({ pincode: PINCODE, q: 'bajra', limit: 50 })
      .expect(200);
    const discoveredProduct = (
      discoveryResponse.body.data.items as Array<Record<string, unknown>>
    ).find((item) => item.id === productId);
    expect(discoveredProduct).toBeDefined();

    // The farmer must be able to see who they are actually buying from.
    const detailResponse = await request(server)
      .get(`/api/v1/marketplace/products/${productId}`)
      .query({ pincode: PINCODE })
      .expect(200);
    const detailOffers = detailResponse.body.data.offers as Array<Record<string, unknown>>;
    const visibleOffer = detailOffers.find((offer) => offer.id === offerId);
    expect(visibleOffer).toBeDefined();
    expect(visibleOffer?.sellingPricePaise).toBe(SELLING_PRICE_PAISE);
    // Business truth 20: availability is backend-derived from inventory movements.
    expect(visibleOffer?.availableQuantity).toBe(OPENING_STOCK);

    // A farmer outside the serviceable area must not see the offer at all.
    const unservicedResponse = await request(server)
      .get('/api/v1/marketplace/products')
      .query({ pincode: '110001', q: 'bajra', limit: 50 })
      .expect(200);
    const unservicedIds = (
      unservicedResponse.body.data.items as Array<Record<string, unknown>>
    ).map((item) => item.id);
    expect(unservicedIds).not.toContain(productId);

    // ---------------------------------------------------------------------
    // Steps 11-12: the farmer adds to cart and the backend assigns the distributor.
    // ---------------------------------------------------------------------
    const cartResponse = await request(server)
      .post('/api/v1/cart/items')
      .set(actors.farmerHeaders)
      .send({
        offerId,
        farmerAddressId,
        quantity: ORDER_QUANTITY,
        reason: 'Farmer selected hybrid bajra seed',
      })
      .expect(201);
    const cartItem = cartResponse.body.data.items[0];
    expect(cartItem.quantity).toBe(ORDER_QUANTITY);
    expect(cartItem.priceSnapshotPaise).toBe(SELLING_PRICE_PAISE);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', `acceptance-checkout-${suffix}`)
      .send({ farmerAddressId, reason: 'Farmer confirmed cart' })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;
    expect(checkoutResponse.body.data.status).toBe(ProductCheckoutStatus.PENDING_PAYMENT);

    // Business truth 12: one seller and one traceable lifecycle per child order.
    const childOrders = checkoutResponse.body.data.orders as Array<Record<string, unknown>>;
    expect(childOrders).toHaveLength(1);
    const childOrder = childOrders[0];
    if (!childOrder) {
      throw new Error('Checkout did not produce a child product order');
    }
    const orderId = childOrder.id as string;
    expect(childOrder.sellerOrganisationId).toBe(actors.distributorOrganisationId);
    expect(childOrder.subtotalPaise).toBe(SELLING_PRICE_PAISE * ORDER_QUANTITY);

    // Replaying the same idempotency key must not create a second checkout.
    const replayCheckout = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', `acceptance-checkout-${suffix}`)
      .send({ farmerAddressId, reason: 'Farmer confirmed cart' })
      .expect(201);
    expect(replayCheckout.body.data.id).toBe(checkoutId);

    // ---------------------------------------------------------------------
    // Steps 13-14: mock payment succeeds and inventory is reserved.
    // ---------------------------------------------------------------------
    const intentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', `acceptance-intent-${suffix}`)
      .send({ checkoutId, reason: 'Farmer started mock payment' })
      .expect(201);
    const paymentIntentId = intentResponse.body.data.id as string;
    expect(intentResponse.body.data.amountPaise).toBe(SELLING_PRICE_PAISE * ORDER_QUANTITY);

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', `acceptance-confirm-${suffix}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);
    expect(confirmResponse.body.data.checkout.status).toBe(ProductCheckoutStatus.PAID);
    expect(confirmResponse.body.data.checkout.orders[0].status).toBe(ProductOrderStatus.CONFIRMED);

    const reservationMovements = await request(server)
      .get('/api/v1/inventory/movements')
      .query({
        batchId,
        movementType: InventoryMovementType.RESERVED_FOR_ORDER,
        limit: 50,
      })
      .set(actors.distributorHeaders)
      .expect(200);
    expect(reservationMovements.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantityDelta: -ORDER_QUANTITY,
          balanceAfter: OPENING_STOCK - ORDER_QUANTITY,
          referenceType: 'ProductOrder',
          referenceId: orderId,
        }),
      ]),
    );

    // Reserved stock must disappear from what the next farmer can buy.
    const postReservationDetail = await request(server)
      .get(`/api/v1/marketplace/products/${productId}`)
      .query({ pincode: PINCODE })
      .expect(200);
    const postReservationOffer = (
      postReservationDetail.body.data.offers as Array<Record<string, unknown>>
    ).find((offer) => offer.id === offerId);
    expect(postReservationOffer?.availableQuantity).toBe(OPENING_STOCK - ORDER_QUANTITY);

    // ---------------------------------------------------------------------
    // Steps 15-17: the distributor accepts, packs and invoices the order.
    // ---------------------------------------------------------------------
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/accept`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Distributor confirmed stock and SLA' })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-to-pack`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Picking list generated' })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/pack`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Order packed and weighed' })
      .expect(201);

    const invoiceResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Invoice generated after packing verification' })
      .expect(201);
    const invoice = invoiceResponse.body.data.invoice;

    // Business truths 2 and 3: the distributor is the seller of record and
    // invoices the farmer under its own legal name and GSTIN.
    expect(invoice.sellerOrganisationId).toBe(actors.distributorOrganisationId);
    expect(invoice.sellerLegalNameSnapshot).toBe('Acceptance Distributor Private Limited');
    expect(invoice.sellerGstinSnapshot).toBe('08ABCDE1234F1Z5');
    expect(invoice.farmerNameSnapshot).toBe('Acceptance Farmer');
    expect(invoice.subtotalPaise).toBe(SELLING_PRICE_PAISE * ORDER_QUANTITY);
    expect(invoice.taxableAmountPaise + invoice.taxPaise).toBe(invoice.subtotalPaise);
    expect(invoice.totalPaise).toBe(invoice.subtotalPaise);

    // ---------------------------------------------------------------------
    // Steps 18-21: dispatch, delivery partner assignment, OTP completion.
    // ---------------------------------------------------------------------
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Package staged at pickup bay' })
      .expect(201);

    const assignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(actors.operationsHeaders)
      .send({
        deliveryPartnerUserId: actors.deliveryPartnerUserId,
        reason: 'Assigned to local route partner',
      })
      .expect(201);
    const otpCode = assignmentResponse.body.data.deliveryAssignment.mockOtpCode as string;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(actors.deliveryPartnerHeaders)
      .send({ reason: 'Delivery assignment accepted' })
      .expect(201);

    const labelResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/dispatch-label`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Issue package pickup QR' })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(actors.deliveryPartnerHeaders)
      .send({ packageQrCode: labelResponse.body.data.packageQrCode })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(actors.deliveryPartnerHeaders)
      .send({ reason: 'Delivery partner collected the package' })
      .expect(201);

    const deliveredResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(actors.deliveryPartnerHeaders)
      .send({
        otpCode,
        proofNote: 'Handed to farmer and OTP verified',
        proofLocationStatus: 'UNAVAILABLE',
      })
      .expect(201);
    expect(deliveredResponse.body.data.status).toBe(ProductOrderStatus.DELIVERED);

    // The farmer can independently see their own delivered order and its seller.
    const farmerOrderResponse = await request(server)
      .get(`/api/v1/orders/${orderId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(farmerOrderResponse.body.data.status).toBe(ProductOrderStatus.DELIVERED);
    expect(farmerOrderResponse.body.data.sellerNameSnapshot).toBe('Acceptance Distributor');
    expect(farmerOrderResponse.body.data.invoice.invoiceNumber).toBe(invoice.invoiceNumber);

    // ---------------------------------------------------------------------
    // Steps 22-25: distributor payable, marketplace commission and promoter
    // commission are calculated on delivery (the promoter attributed at step
    // 8 makes the promoter-commission entry fire), the return/dispute window
    // is completed, and commission and settlement become eligible.
    // ---------------------------------------------------------------------
    const commissionEntriesResponse = await request(server)
      .get('/api/v1/finance/commission-entries')
      .query({ productOrderId: orderId })
      .set(actors.financeManagerHeaders)
      .expect(200);
    const commissionEntries = commissionEntriesResponse.body.data.items as Array<{
      entryType: string;
      amountPaise: number;
      status: string;
    }>;
    // Marketplace commission + distributor payable + promoter commission +
    // the unconditional delivery-fee entry.
    expect(commissionEntries).toHaveLength(4);
    const marketplaceCommissionEntry = commissionEntries.find(
      (entry) => entry.entryType === 'MARKETPLACE_COMMISSION',
    );
    const distributorPayableEntry = commissionEntries.find(
      (entry) => entry.entryType === 'DISTRIBUTOR_PAYABLE',
    );
    const promoterCommissionEntry = commissionEntries.find(
      (entry) => entry.entryType === 'PROMOTER_COMMISSION',
    );
    const expectedMarketplaceCommissionPaise = Math.round(
      (SELLING_PRICE_PAISE * ORDER_QUANTITY * 500) / 10_000,
    );
    expect(marketplaceCommissionEntry?.amountPaise).toBe(expectedMarketplaceCommissionPaise);
    expect(marketplaceCommissionEntry?.status).toBe('PROVISIONAL');
    expect(distributorPayableEntry?.amountPaise).toBe(
      SELLING_PRICE_PAISE * ORDER_QUANTITY - expectedMarketplaceCommissionPaise,
    );
    expect(distributorPayableEntry?.status).toBe('PROVISIONAL');
    // No approved promoter commission rate exists yet, so the entry is
    // calculated (provisional) but zero -- same treatment as
    // ProductInvoice.taxPaise = 0 until approved GST rules exist.
    expect(promoterCommissionEntry?.amountPaise).toBe(0);
    expect(promoterCommissionEntry?.status).toBe('PROVISIONAL');

    // Simulate the return/dispute window elapsing so commission becomes final.
    await prisma.commissionEntry.updateMany({
      where: { productOrderId: orderId },
      data: { eligibleAt: new Date(Date.now() - 60_000) },
    });
    await request(server)
      .post('/api/v1/finance/commission-entries/finalize-eligible')
      .set(actors.financeManagerHeaders)
      .expect(201);

    const settlementResponse = await request(server)
      .post('/api/v1/finance/settlements')
      .set(actors.financeManagerHeaders)
      .send({ sellerOrganisationId: actors.distributorOrganisationId })
      .expect(201);
    expect(settlementResponse.body.data.totalPayablePaise).toBe(
      SELLING_PRICE_PAISE * ORDER_QUANTITY - expectedMarketplaceCommissionPaise,
    );
    expect(settlementResponse.body.data.status).toBe('ELIGIBLE');

    // ---------------------------------------------------------------------
    // Post-purchase acceptance tail: the farmer returns the delivered child
    // order, the distributor inspects against its original reservation, and
    // finance completes an explicitly mock refund with ledger reversals.
    // ---------------------------------------------------------------------
    const eligibilityResponse = await request(server)
      .get(`/api/v1/returns/eligibility/${orderId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(eligibilityResponse.body.data.eligible).toBe(true);
    const eligibleItem = eligibilityResponse.body.data.items[0] as {
      productOrderItemId: string;
      orderedQuantity: number;
    };
    expect(eligibleItem.orderedQuantity).toBe(ORDER_QUANTITY);

    const returnIdempotencyKey = `acceptance-return-${suffix}`;
    const createReturnBody = {
      productOrderId: orderId,
      reasonCode: ReturnReasonCode.QUALITY_ISSUE,
      reasonNote: 'Farmer reported a quality issue during the acceptance journey',
      items: [
        {
          productOrderItemId: eligibleItem.productOrderItemId,
          quantity: ORDER_QUANTITY,
        },
      ],
    };
    const returnResponse = await request(server)
      .post('/api/v1/returns')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', returnIdempotencyKey)
      .send(createReturnBody)
      .expect(201);
    const returnRequestId = returnResponse.body.data.id as string;
    const returnItem = returnResponse.body.data.items[0] as {
      id: string;
      reservations: Array<{ id: string; batchId: string; quantity: number }>;
    };
    const originalReservation = returnItem.reservations[0];
    if (!originalReservation) {
      throw new Error('Return response omitted the original inventory reservation');
    }
    expect(originalReservation.batchId).toBe(batchId);
    expect(originalReservation.quantity).toBe(ORDER_QUANTITY);
    expect(returnResponse.body.data.refundableAmountPaise).toBe(
      SELLING_PRICE_PAISE * ORDER_QUANTITY,
    );

    // The bytes have already passed through the independently tested upload and
    // scan pipeline. Attaching them is a separate return-domain transaction.
    const evidenceFile = await prisma.storedFile.create({
      data: {
        ownerUserId: actors.farmerUserId,
        organisationId: actors.farmerHeaders['x-organisation-id']!,
        purpose: StoredFilePurpose.RETURN_EVIDENCE,
        status: StoredFileStatus.AVAILABLE,
        objectKey: `return-evidence/acceptance-${suffix}.jpg`,
        originalFilename: 'damaged-pack.jpg',
        contentType: 'image/jpeg',
        declaredSizeBytes: 128,
        sizeBytes: 128,
        checksumSha256: 'a'.repeat(64),
        scanResult: StoredFileScanResult.CLEAN,
        scanCompletedAt: new Date(),
        uploadedAt: new Date(),
        uploadUrlExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const attachEvidenceBody = {
      storedFileId: evidenceFile.id,
      caption: 'Seal was broken when the parcel arrived.',
    };
    const attachedEvidence = await request(server)
      .post(`/api/v1/returns/${returnRequestId}/evidence`)
      .set(actors.farmerHeaders)
      .send(attachEvidenceBody)
      .expect(201);
    expect(attachedEvidence.body.data).toEqual(
      expect.objectContaining({
        storedFileId: evidenceFile.id,
        status: StoredFileStatus.AVAILABLE,
      }),
    );

    // A network retry returns the same attachment and creates neither a second
    // row nor a second audit event.
    const replayEvidence = await request(server)
      .post(`/api/v1/returns/${returnRequestId}/evidence`)
      .set(actors.farmerHeaders)
      .send(attachEvidenceBody)
      .expect(201);
    expect(replayEvidence.body.data.id).toBe(attachedEvidence.body.data.id);
    expect(
      await prisma.returnRequestEvidence.count({
        where: { storedFileId: evidenceFile.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'RETURN_EVIDENCE_ATTACHED',
          resourceId: returnRequestId,
        },
      }),
    ).toBe(1);

    // Attachment moves the file into the return seller's organisation scope,
    // while the farmer remains its owner. Both sides can use signed downloads.
    const attachedStoredFile = await prisma.storedFile.findUniqueOrThrow({
      where: { id: evidenceFile.id },
    });
    expect(attachedStoredFile.organisationId).toBe(actors.distributorOrganisationId);
    await request(server)
      .get(`/api/v1/files/${evidenceFile.id}/download-url`)
      .set(actors.farmerHeaders)
      .expect(200);
    await request(server)
      .get(`/api/v1/files/${evidenceFile.id}/download-url`)
      .set(actors.distributorHeaders)
      .expect(200);

    const replayReturn = await request(server)
      .post('/api/v1/returns')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', returnIdempotencyKey)
      .send(createReturnBody)
      .expect(201);
    expect(replayReturn.body.data.id).toBe(returnRequestId);

    await request(server)
      .post(`/api/v1/returns/${returnRequestId}/approve`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Seller approved the farmer return' })
      .expect(201);
    await request(server)
      .post(`/api/v1/returns/${returnRequestId}/pickup`)
      .set(actors.operationsHeaders)
      .send({ reason: 'Operations recorded the return pickup' })
      .expect(201);
    await request(server)
      .post(`/api/v1/returns/${returnRequestId}/receive`)
      .set(actors.distributorHeaders)
      .send({ reason: 'Seller received the original package for inspection' })
      .expect(201);

    const inspectionResponse = await request(server)
      .post(`/api/v1/returns/${returnRequestId}/inspect`)
      .set(actors.distributorHeaders)
      .send({
        inspectionNote: 'Original batch and sealed packs verified as restockable',
        dispositions: [
          {
            returnRequestItemId: returnItem.id,
            reservationId: originalReservation.id,
            outcome: ReturnInspectionOutcome.RESTOCKABLE,
            quantity: ORDER_QUANTITY,
          },
        ],
      })
      .expect(201);
    expect(inspectionResponse.body.data.status).toBe('INSPECTED');
    expect(inspectionResponse.body.data.approvedRefundAmountPaise).toBe(
      SELLING_PRICE_PAISE * ORDER_QUANTITY,
    );
    expect(inspectionResponse.body.data.inspectionDispositions[0]).toEqual(
      expect.objectContaining({
        batchId,
        outcome: ReturnInspectionOutcome.RESTOCKABLE,
        quantity: ORDER_QUANTITY,
        quantityDelta: ORDER_QUANTITY,
        balanceAfter: OPENING_STOCK,
      }),
    );

    const restockMovements = await request(server)
      .get('/api/v1/inventory/movements')
      .query({
        batchId,
        movementType: InventoryMovementType.RETURN_RESTOCKED,
        limit: 50,
      })
      .set(actors.distributorHeaders)
      .expect(200);
    expect(restockMovements.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quantityDelta: ORDER_QUANTITY,
          balanceAfter: OPENING_STOCK,
          referenceType: 'ReturnInspectionDisposition',
        }),
      ]),
    );

    const refundResponse = await request(server)
      .post('/api/v1/refunds')
      .set(actors.financeManagerHeaders)
      .set('Idempotency-Key', `acceptance-refund-${suffix}`)
      .send({ returnRequestId })
      .expect(201);
    const refundId = refundResponse.body.data.id as string;
    expect(refundResponse.body.data.amountPaise).toBe(SELLING_PRICE_PAISE * ORDER_QUANTITY);
    expect(refundResponse.body.data.status).toBe('PENDING');

    const replayRefund = await request(server)
      .post('/api/v1/refunds')
      .set(actors.financeManagerHeaders)
      .set('Idempotency-Key', `acceptance-refund-${suffix}`)
      .send({ returnRequestId })
      .expect(201);
    expect(replayRefund.body.data.id).toBe(refundId);

    const refundConfirmationKey = `acceptance-refund-confirm-${suffix}`;
    const confirmedRefund = await request(server)
      .post(`/api/v1/refunds/${refundId}/confirm`)
      .set(actors.financeManagerHeaders)
      .set('Idempotency-Key', refundConfirmationKey)
      .send({ outcome: 'SUCCEEDED' })
      .expect(201);
    expect(confirmedRefund.body.data.status).toBe('PROCESSING');
    const processingEvent = confirmedRefund.body.data.events.find(
      (event: { eventType: string }) => event.eventType === 'PROCESSING_STARTED',
    ) as { id: string };
    await app
      .get(ExecuteRefundHandler)
      .handle(createJobEnvelope({ refundEventId: processingEvent.id }, 'acceptance-refund-worker'));

    const completedRefund = await request(server)
      .get(`/api/v1/refunds/${refundId}`)
      .set(actors.financeManagerHeaders)
      .expect(200);
    expect(completedRefund.body.data.status).toBe('SUCCEEDED');
    // The reference now comes from the gateway rather than being minted inline,
    // so the assertion is on the mock gateway's prefix rather than an exact
    // string a real gateway would never produce.
    expect(completedRefund.body.data.providerRefundReference).toMatch(/^MOCK-REFUND-/);

    const replayConfirmation = await request(server)
      .post(`/api/v1/refunds/${refundId}/confirm`)
      .set(actors.financeManagerHeaders)
      .set('Idempotency-Key', refundConfirmationKey)
      .send({ outcome: 'SUCCEEDED' })
      .expect(201);
    expect(replayConfirmation.body.data.id).toBe(refundId);
    expect(replayConfirmation.body.data.status).toBe('SUCCEEDED');

    const farmerRefund = await request(server)
      .get(`/api/v1/refunds/${refundId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(farmerRefund.body.data.farmerUserId).toBe(actors.farmerUserId);
    expect(farmerRefund.body.data.status).toBe('SUCCEEDED');

    const farmerRefunds = await request(server)
      .get('/api/v1/refunds/me')
      .query({ returnRequestId })
      .set(actors.farmerHeaders)
      .expect(200);
    expect(farmerRefunds.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: refundId, status: 'SUCCEEDED' })]),
    );

    await request(server)
      .get(`/api/v1/refunds/${refundId}`)
      .set(actors.distributorHeaders)
      .expect(403);

    const completedReturn = await request(server)
      .get(`/api/v1/returns/${returnRequestId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(completedReturn.body.data.status).toBe('COMPLETED');
    expect(completedReturn.body.data.refunds[0]).toEqual(
      expect.objectContaining({ id: refundId, status: 'SUCCEEDED' }),
    );

    const refundedOrder = await request(server)
      .get(`/api/v1/orders/${orderId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(refundedOrder.body.data.status).toBe(ProductOrderStatus.REFUNDED);

    // ---------------------------------------------------------------------
    // Post-refund grievance: the farmer raises an idempotent dispute, support
    // investigates, finance records an immutable adjustment, and the original
    // terminal order status is restored before the dispute closes.
    // ---------------------------------------------------------------------
    const disputeKey = `acceptance-dispute-${suffix}`;
    const disputeBody = {
      productOrderId: orderId,
      returnRequestId,
      category: 'REFUND_AMOUNT',
      description: 'Farmer disputes the final amount after the inspected return.',
    };
    const disputeResponse = await request(server)
      .post('/api/v1/disputes')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', disputeKey)
      .send(disputeBody)
      .expect(201);
    const disputeId = disputeResponse.body.data.id as string;
    expect(disputeResponse.body.data.status).toBe('OPEN');
    expect(disputeResponse.body.data.orderStatusBeforeDispute).toBe(ProductOrderStatus.REFUNDED);

    const replayDispute = await request(server)
      .post('/api/v1/disputes')
      .set(actors.farmerHeaders)
      .set('Idempotency-Key', disputeKey)
      .send(disputeBody)
      .expect(201);
    expect(replayDispute.body.data.id).toBe(disputeId);

    await request(server)
      .post('/api/v1/disputes')
      .set(actors.distributorHeaders)
      .set('Idempotency-Key', `acceptance-dispute-seller-${suffix}`)
      .send(disputeBody)
      .expect(409);

    const farmerDisputes = await request(server)
      .get('/api/v1/disputes/me')
      .set(actors.farmerHeaders)
      .expect(200);
    expect(farmerDisputes.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: disputeId })]),
    );

    const sellerDisputes = await request(server)
      .get('/api/v1/disputes')
      .set(actors.distributorHeaders)
      .expect(200);
    expect(sellerDisputes.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: disputeId })]),
    );

    await request(server)
      .post(`/api/v1/disputes/${disputeId}/assign`)
      .set(actors.operationsHeaders)
      .send({ assignedToUserId: actors.operationsUserId, note: 'Operations accepted review' })
      .expect(201);

    await request(server)
      .post(`/api/v1/disputes/${disputeId}/request-info`)
      .set(actors.operationsHeaders)
      .send({ target: 'DISTRIBUTOR', note: 'Please confirm the inspected refund calculation.' })
      .expect(201);

    const sellerNoteKey = `acceptance-dispute-note-${suffix}`;
    const sellerNote = await request(server)
      .post(`/api/v1/disputes/${disputeId}/notes`)
      .set(actors.distributorHeaders)
      .set('Idempotency-Key', sellerNoteKey)
      .send({ note: 'Inspection calculation and batch evidence have been rechecked.' })
      .expect(201);
    const noteEventCount = sellerNote.body.data.events.length as number;
    const replaySellerNote = await request(server)
      .post(`/api/v1/disputes/${disputeId}/notes`)
      .set(actors.distributorHeaders)
      .set('Idempotency-Key', sellerNoteKey)
      .send({ note: 'Inspection calculation and batch evidence have been rechecked.' })
      .expect(201);
    expect(replaySellerNote.body.data.events).toHaveLength(noteEventCount);

    const disputeAwardPaise = 5_000;
    const resolvedDispute = await request(server)
      .post(`/api/v1/disputes/${disputeId}/resolve`)
      .set(actors.financeManagerHeaders)
      .send({
        outcome: 'FARMER',
        resolutionAmountPaise: disputeAwardPaise,
        resolutionNote: 'Finance approved a goodwill adjustment after reviewing the calculation.',
      })
      .expect(201);
    expect(resolvedDispute.body.data.status).toBe('RESOLVED_FOR_FARMER');
    expect(resolvedDispute.body.data.resolutionAmountPaise).toBe(disputeAwardPaise);

    const orderAfterDispute = await request(server)
      .get(`/api/v1/orders/${orderId}`)
      .set(actors.farmerHeaders)
      .expect(200);
    expect(orderAfterDispute.body.data.status).toBe(ProductOrderStatus.REFUNDED);

    const adjustmentLedger = await request(server)
      .get('/api/v1/finance/ledger')
      .query({ productOrderId: orderId, entryType: 'ADJUSTMENT', limit: 50 })
      .set(actors.financeManagerHeaders)
      .expect(200);
    expect(adjustmentLedger.body.data.items).toEqual([
      expect.objectContaining({
        disputeId,
        amountPaise: -disputeAwardPaise,
        organisationId: actors.distributorOrganisationId,
      }),
    ]);

    const closedDispute = await request(server)
      .post(`/api/v1/disputes/${disputeId}/close`)
      .set(actors.financeManagerHeaders)
      .send({ note: 'Adjustment recorded and both parties notified.' })
      .expect(201);
    expect(closedDispute.body.data.status).toBe('CLOSED');

    const farmerNotifications = await request(server)
      .get('/api/v1/notifications/me')
      .query({ channel: 'IN_APP', limit: 100 })
      .set(actors.farmerHeaders)
      .expect(200);
    const paymentNotifications = (
      farmerNotifications.body.data.items as Array<{
        category: string;
        relatedResourceType: string | null;
        relatedResourceId: string | null;
        status: string;
        payloadSnapshot: Record<string, unknown>;
      }>
    ).filter((notification) => notification.relatedResourceId === checkoutId);
    expect(paymentNotifications).toEqual([
      expect.objectContaining({
        category: 'PAYMENT_SUCCEEDED',
        relatedResourceType: 'ProductCheckout',
        relatedResourceId: checkoutId,
        status: 'SENT',
        payloadSnapshot: expect.objectContaining({
          amountPaise: SELLING_PRICE_PAISE * ORDER_QUANTITY,
          paymentIntentId,
          productCheckoutId: checkoutId,
        }),
      }),
    ]);
    const returnNotifications = (
      farmerNotifications.body.data.items as Array<{
        category: string;
        relatedResourceType: string | null;
        relatedResourceId: string | null;
        status: string;
      }>
    ).filter((notification) => notification.relatedResourceId === returnRequestId);
    expect(returnNotifications).toHaveLength(7);
    expect(returnNotifications).toEqual(
      expect.arrayContaining(
        [
          'RETURN_REQUESTED',
          'RETURN_APPROVED',
          'RETURN_IN_TRANSIT',
          'RETURN_RECEIVED',
          'RETURN_INSPECTED',
          'REFUND_INITIATED',
          'REFUND_SUCCEEDED',
        ].map((category) =>
          expect.objectContaining({
            category,
            status: 'SENT',
            relatedResourceType: 'ReturnRequest',
          }),
        ),
      ),
    );
    const orderNotifications = (
      farmerNotifications.body.data.items as Array<{
        category: string;
        relatedResourceType: string | null;
        relatedResourceId: string | null;
        status: string;
      }>
    ).filter((notification) => notification.relatedResourceId === orderId);
    expect(orderNotifications).toHaveLength(8);
    expect(orderNotifications).toEqual(
      expect.arrayContaining(
        [
          'ORDER_ACCEPTED',
          'ORDER_PACKED',
          'INVOICE_GENERATED',
          'ORDER_READY_FOR_PICKUP',
          'ORDER_OUT_FOR_DELIVERY',
          'ORDER_DELIVERED',
          'DISPUTE_RAISED',
          'DISPUTE_RESOLVED',
        ].map((category) =>
          expect.objectContaining({
            category,
            status: 'SENT',
            relatedResourceType: 'ProductOrder',
          }),
        ),
      ),
    );

    const reversedCommissionResponse = await request(server)
      .get('/api/v1/finance/commission-entries')
      .query({ productOrderId: orderId })
      .set(actors.financeManagerHeaders)
      .expect(200);
    expect(reversedCommissionResponse.body.data.items).toHaveLength(4);
    expect(
      (reversedCommissionResponse.body.data.items as Array<{ status: string }>).every(
        (entry) => entry.status === 'REVERSED',
      ),
    ).toBe(true);

    const refundLedgerResponse = await request(server)
      .get('/api/v1/finance/ledger')
      .query({ productOrderId: orderId, entryType: 'REFUND', limit: 50 })
      .set(actors.financeManagerHeaders)
      .expect(200);
    expect(refundLedgerResponse.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          refundId,
          amountPaise: -(SELLING_PRICE_PAISE * ORDER_QUANTITY),
          commissionEntryId: null,
        }),
      ]),
    );

    // ---------------------------------------------------------------------
    // Step 26: every important action is visible in the audit log.
    // ---------------------------------------------------------------------
    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ limit: 100 })
      .set(actors.adminHeaders)
      .expect(200);
    const auditActions = new Set(
      (auditResponse.body.data.items as Array<{ action: string }>).map((item) => item.action),
    );
    for (const requiredAction of [
      'ORGANISATION_APPROVED',
      'BRAND_APPROVED',
      'MASTER_PRODUCT_APPROVED',
      'WAREHOUSE_CREATED',
      'INVENTORY_BATCH_CREATED',
      'DISTRIBUTOR_OFFER_APPROVED',
      'PRODUCT_CHECKOUT_CREATED',
      'INVENTORY_RESERVED_FOR_ORDER',
      'PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR',
      'PRODUCT_ORDER_PACKED',
      'PRODUCT_INVOICE_GENERATED',
      'PRODUCT_DISPATCH_CREATED',
      'PRODUCT_DELIVERY_ASSIGNED',
      'PRODUCT_ORDER_DELIVERED',
      'PRODUCT_ORDER_COMMISSION_CALCULATED',
      'COMMISSION_ENTRY_FINALIZED',
      'SETTLEMENT_CREATED',
      'PROMOTER_ATTRIBUTION_CREATED',
      'RETURN_REQUEST_CREATED',
      'RETURN_REQUEST_APPROVED',
      'RETURN_PICKUP_RECORDED',
      'RETURN_RECEIVED_BY_SELLER',
      'RETURN_INVENTORY_DISPOSITION_RECORDED',
      'RETURN_REQUEST_INSPECTED',
      'REFUND_INITIATED',
      'REFUND_SUCCEEDED',
      'DISPUTE_CREATED',
      'DISPUTE_ASSIGNED',
      'DISPUTE_INFORMATION_REQUESTED',
      'DISPUTE_NOTE_ADDED',
      'DISPUTE_RESOLVED',
      'DISPUTE_CLOSED',
      'COMMISSION_ENTRY_REVERSED',
      'NOTIFICATION_ENQUEUED',
    ]) {
      expect(auditActions).toContain(requiredAction);
    }
  });

  /** Submits a GST certificate for an organisation and approves it as reviewer. */
  async function approveKycDocument(
    server: Parameters<typeof request>[0],
    organisationId: string,
    documentNumber: string,
  ): Promise<void> {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    const createResponse = await request(server)
      .post(`/api/v1/onboarding/organisations/${organisationId}/kyc-documents`)
      .set(actors.adminHeaders)
      .send({
        documentType: KycDocumentType.GST_CERTIFICATE,
        documentNumber,
        fileName: 'gst-certificate.pdf',
        storageKey: `mock/kyc/${organisationId}/gst-certificate.pdf`,
        issuedAt: isoDate(-30),
        expiresAt: isoDate(365),
      })
      .expect(201);
    expect(createResponse.body.data.status).toBe(KycDocumentStatus.SUBMITTED);

    const documentId = createResponse.body.data.id as string;
    const reviewResponse = await request(server)
      .patch(`/api/v1/onboarding/organisations/${organisationId}/kyc-documents/${documentId}`)
      .set(actors.adminHeaders)
      .send({
        status: KycDocumentStatus.APPROVED,
        reason: 'GST certificate verified against the public portal',
      })
      .expect(200);
    expect(reviewResponse.body.data.status).toBe(KycDocumentStatus.APPROVED);
  }
});

async function seedActors(): Promise<{
  adminHeaders: Headers;
  operationsHeaders: Headers;
  financeManagerHeaders: Headers;
  companyHeaders: Headers;
  distributorHeaders: Headers;
  farmerHeaders: Headers;
  deliveryPartnerHeaders: Headers;
  companyOrganisationId: string;
  distributorOrganisationId: string;
  deliveryPartnerUserId: string;
  promoterUserId: string;
  farmerUserId: string;
  operationsUserId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `acceptance-admin-${suffix}`,
      legalName: 'Vardhnam Agrotech',
      displayName: 'Vardhnam Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const adminUser = await createUser(
    `acceptance-admin-${suffix}@example.local`,
    'Acceptance Admin',
  );
  await createMembership(adminUser.id, adminOrganisation.id, PlatformRole.SUPER_ADMIN);

  const operationsUser = await createUser(
    `acceptance-ops-${suffix}@example.local`,
    'Acceptance Operations Manager',
  );
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const financeManagerUser = await createUser(
    `acceptance-finance-${suffix}@example.local`,
    'Acceptance Finance Manager',
  );
  await createMembership(financeManagerUser.id, adminOrganisation.id, PlatformRole.FINANCE_MANAGER);

  // The global default commission rule that recordDeliveryCommission falls
  // back to whenever no distributor-specific override exists.
  await prisma.commissionRule.create({
    data: {
      sellerOrganisationId: null,
      marketplaceCommissionBps: 500,
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      reason: 'MVP acceptance spec global default commission rate',
    },
  });

  // The company and distributor start unapproved: the scenario begins with an
  // administrator approving them.
  const companyOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.COMPANY,
      slug: `acceptance-company-${suffix}`,
      legalName: 'Acceptance Seeds Private Limited',
      displayName: 'Acceptance Seeds',
      status: OrganisationStatus.PENDING_VERIFICATION,
    },
  });
  const companyUser = await createUser(
    `acceptance-company-${suffix}@example.local`,
    'Acceptance Company Owner',
  );
  await createMembership(companyUser.id, companyOrganisation.id, PlatformRole.COMPANY_OWNER);

  const distributorOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DISTRIBUTOR,
      slug: `acceptance-distributor-${suffix}`,
      legalName: 'Acceptance Distributor Private Limited',
      displayName: 'Acceptance Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.PENDING_VERIFICATION,
    },
  });
  const distributorUser = await createUser(
    `acceptance-distributor-${suffix}@example.local`,
    'Acceptance Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );

  const deliveryOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.DELIVERY_PARTNER,
      slug: `acceptance-delivery-${suffix}`,
      legalName: 'Acceptance Last Mile Logistics',
      displayName: 'Acceptance Last Mile',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const deliveryPartnerUser = await createUser(
    `acceptance-delivery-${suffix}@example.local`,
    'Acceptance Delivery Partner',
  );
  await createMembership(
    deliveryPartnerUser.id,
    deliveryOrganisation.id,
    PlatformRole.DELIVERY_PARTNER,
  );
  await prisma.deliveryPartnerProfile.create({
    data: {
      userId: deliveryPartnerUser.id,
      organisationId: deliveryOrganisation.id,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      availabilityChangedAt: new Date(),
    },
  });

  const farmerOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `acceptance-farmer-context-${suffix}`,
      legalName: 'Acceptance Farmer Context',
      displayName: 'Acceptance Farmer Context',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91005${short}`,
      profile: {
        create: {
          displayName: 'Acceptance Farmer',
        },
      },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const promoterOrganisation = await prisma.organisation.create({
    data: {
      type: OrganisationType.VARDHNAM,
      slug: `acceptance-promoter-context-${suffix}`,
      legalName: 'Acceptance Promoter Network',
      displayName: 'Acceptance Promoter Network',
      status: OrganisationStatus.ACTIVE,
    },
  });
  const promoterUser = await createUser(
    `acceptance-promoter-${suffix}@example.local`,
    'Acceptance Promoter',
  );
  await createMembership(promoterUser.id, promoterOrganisation.id, PlatformRole.PROMOTER);

  return {
    adminHeaders: headersFor(adminUser.id, PlatformRole.SUPER_ADMIN, adminOrganisation.id),
    operationsHeaders: headersFor(
      operationsUser.id,
      PlatformRole.OPERATIONS_MANAGER,
      adminOrganisation.id,
    ),
    financeManagerHeaders: headersFor(
      financeManagerUser.id,
      PlatformRole.FINANCE_MANAGER,
      adminOrganisation.id,
    ),
    companyHeaders: headersFor(companyUser.id, PlatformRole.COMPANY_OWNER, companyOrganisation.id),
    distributorHeaders: headersFor(
      distributorUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      distributorOrganisation.id,
    ),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    deliveryPartnerHeaders: headersFor(
      deliveryPartnerUser.id,
      PlatformRole.DELIVERY_PARTNER,
      deliveryOrganisation.id,
    ),
    companyOrganisationId: companyOrganisation.id,
    distributorOrganisationId: distributorOrganisation.id,
    deliveryPartnerUserId: deliveryPartnerUser.id,
    promoterUserId: promoterUser.id,
    farmerUserId: farmerUser.id,
    operationsUserId: operationsUser.id,
  };
}

function headersFor(userId: string, role: PlatformRole, organisationId: string): Headers {
  return {
    'x-user-id': userId,
    'x-user-role': role,
    'x-organisation-id': organisationId,
  };
}

async function createUser(email: string, displayName: string) {
  return prisma.user.create({
    data: {
      email,
      profile: {
        create: {
          displayName,
        },
      },
    },
  });
}

async function createMembership(
  userId: string,
  organisationId: string,
  role: PlatformRole,
): Promise<void> {
  await prisma.organisationMembership.create({
    data: {
      userId,
      organisationId,
      role,
      status: MembershipStatus.ACTIVE,
    },
  });
}

async function seedPermissions(): Promise<void> {
  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionByCode.set(savedPermission.code, savedPermission.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing permission ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as PlatformRole,
            permissionId,
          },
        },
        create: {
          role: role as PlatformRole,
          permissionId,
        },
        update: {},
      });
    }
  }
}

function isoDate(daysFromToday: number): string {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value.toISOString();
}
