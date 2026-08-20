import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  CommissionRuleStatus,
  DeliveryFailureReasonCode,
  DistributorOfferStatus,
  DeliveryPartnerAvailabilityStatus,
  FulfilmentMode,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  ProductDeliveryAssignmentStatus,
  ProductDispatchStatus,
  ProductInvoiceStatus,
  ProductOrderStatus,
  WarehouseStatus,
} from '@prisma/client';
import request from 'supertest';
import { permissionDefinitions, rolePermissions } from '../../src/access/permission-codes';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { MockPaymentOutcome } from '../../src/payments/dto/confirm-mock-payment-intent.dto';

const prisma = new PrismaClient();

type Headers = Record<string, string>;

describe('Phase 4A-4E distributor fulfilment and delivery foundation', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedPhase4Data>>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedPhase4Data();

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

  it('moves a paid order through accept, pack, invoice, dispatch and OTP delivery', async () => {
    const server = requireServer();
    const orderId = await createConfirmedOrder(server, 2, 'happy-path');

    const acceptResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/accept`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Distributor confirmed stock and delivery SLA' })
      .expect(201);
    expect(acceptResponse.body.data.status).toBe(ProductOrderStatus.DISTRIBUTOR_ACCEPTED);

    const readyToPackResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-to-pack`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Picking list generated for warehouse staff' })
      .expect(201);
    expect(readyToPackResponse.body.data.status).toBe(ProductOrderStatus.READY_TO_PACK);

    const packResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/pack`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Order packed and weighed' })
      .expect(201);
    expect(packResponse.body.data.status).toBe(ProductOrderStatus.PACKED);

    const invoiceResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Invoice generated after packing verification' })
      .expect(201);
    const invoice = invoiceResponse.body.data.invoice;
    expect(invoice.status).toBe(ProductInvoiceStatus.GENERATED);
    expect(invoice.currency).toBe('INR');
    expect(invoice.itemCount).toBe(1);

    // Business truth 3: the distributor, not Vardhnam, is the seller on the invoice.
    expect(invoice.sellerOrganisationId).toBe(seeded.distributorOrganisationId);
    expect(invoice.sellerLegalNameSnapshot).toBe('Phase 4 Jaipur Distributor Private Limited');
    expect(invoice.sellerGstinSnapshot).toBe('08ABCDE1234F1Z5');
    expect(invoice.sellerStateCodeSnapshot).toBe('08');
    expect(invoice.placeOfSupplyStateCode).toBe('08');

    // Business truth 20: totals are backend-derived, never client-supplied.
    expect(invoice.subtotalPaise).toBe(236000);
    expect(invoice.taxableAmountPaise + invoice.taxPaise).toBe(invoice.subtotalPaise);
    expect(invoice.totalPaise).toBe(invoice.subtotalPaise);
    expect(invoice.cgstPaise + invoice.sgstPaise).toBe(invoice.taxPaise);
    expect(invoice.igstPaise).toBe(0);
    expect(invoice.sequenceNumber).toBe(1);
    expect(invoice.invoiceNumber).toMatch(/^[A-F0-9]{4}\/[0-9]{2}\/000001$/);
    expect(invoice.invoiceNumber.length).toBeLessThanOrEqual(16);
    expect(invoice.lineItemsSnapshot).toEqual([
      expect.objectContaining({
        hsnCode: '1008',
        gstRateBps: 500,
        cgstPaise: expect.any(Number),
        sgstPaise: expect.any(Number),
        igstPaise: 0,
      }),
    ]);

    const replayInvoiceResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Duplicate invoice request must not create a second invoice' })
      .expect(201);
    expect(replayInvoiceResponse.body.data.invoice.id).toBe(invoice.id);
    expect(replayInvoiceResponse.body.data.invoice.invoiceNumber).toBe(invoice.invoiceNumber);

    const dispatchResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Package staged at pickup bay' })
      .expect(201);
    const dispatch = dispatchResponse.body.data.dispatch;
    expect(dispatch.status).toBe(ProductDispatchStatus.READY_FOR_PICKUP);
    expect(dispatch.invoiceNumberSnapshot).toBe(invoice.invoiceNumber);

    const assignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Assigned to local route partner for pickup',
      })
      .expect(201);
    const assignment = assignmentResponse.body.data.deliveryAssignment;
    expect(assignment.status).toBe(ProductDeliveryAssignmentStatus.ASSIGNED);
    expect(assignment.deliveryPartnerUserId).toBe(seeded.deliveryPartnerUserId);
    expect(assignment.dispatchNumberSnapshot).toBe(dispatch.dispatchNumber);

    const otpCode = assignment.mockOtpCode as string;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    const acceptedAssignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Route and package accepted' })
      .expect(201);
    expect(acceptedAssignmentResponse.body.data.deliveryAssignment.status).toBe(
      ProductDeliveryAssignmentStatus.ACCEPTED,
    );
    await issueAndVerifyPackagePickup(server, orderId);

    const outForDeliveryResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Delivery partner collected the package' })
      .expect(201);
    expect(outForDeliveryResponse.body.data.status).toBe(ProductOrderStatus.OUT_FOR_DELIVERY);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        otpCode,
        proofLocationStatus: 'DENIED',
        proofLatitude: 27.559,
      })
      .expect(400);

    const deliveredResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        otpCode,
        proofNote: 'Handed to farmer at farm gate and OTP verified',
        proofLocationStatus: 'GRANTED',
        proofLatitude: 27.559,
        proofLongitude: 78.663,
        proofAccuracyMetres: 14.2,
        proofLocationCapturedAt: new Date().toISOString(),
      })
      .expect(201);
    expect(deliveredResponse.body.data.status).toBe(ProductOrderStatus.DELIVERED);
    expect(deliveredResponse.body.data.deliveryAssignment.status).toBe(
      ProductDeliveryAssignmentStatus.DELIVERED,
    );
    expect(deliveredResponse.body.data.deliveryAssignment.otpVerifiedAt).not.toBeNull();
    expect(deliveredResponse.body.data.deliveryAssignment).toMatchObject({
      proofLocationStatus: 'GRANTED',
      proofLatitude: 27.559,
      proofLongitude: 78.663,
      proofAccuracyMetres: 14.2,
    });

    // The delivered response must never leak the OTP back to the caller.
    expect(deliveredResponse.body.data.deliveryAssignment.mockOtpCode).toBeUndefined();

    const statusHistory = deliveredResponse.body.data.statusHistory as Array<{
      toStatus: ProductOrderStatus;
      actorUserId: string | null;
      reason: string | null;
    }>;
    const recordedTransitions = statusHistory.map((entry) => entry.toStatus);
    expect(recordedTransitions).toEqual(
      expect.arrayContaining([
        ProductOrderStatus.CONFIRMED,
        ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
        ProductOrderStatus.READY_TO_PACK,
        ProductOrderStatus.PACKED,
        ProductOrderStatus.OUT_FOR_DELIVERY,
        ProductOrderStatus.DELIVERED,
      ]),
    );
    // Every transition must carry an actor and a reason.
    for (const entry of statusHistory) {
      expect(entry.actorUserId).not.toBeNull();
      expect(entry.reason).toBeTruthy();
    }

    const auditResponse = await request(server)
      .get('/api/v1/audit-logs')
      .query({ limit: 100 })
      .set(seeded.adminHeaders)
      .expect(200);
    const auditActions = (auditResponse.body.data.items as Array<{ action: string }>).map(
      (item) => item.action,
    );
    expect(auditActions).toEqual(
      expect.arrayContaining([
        'PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR',
        'PRODUCT_INVOICE_GENERATED',
        'PRODUCT_DELIVERY_ASSIGNED',
        'PRODUCT_DELIVERY_ASSIGNMENT_ACCEPTED',
        'PRODUCT_ORDER_OUT_FOR_DELIVERY',
        'PRODUCT_ORDER_DELIVERED',
      ]),
    );
  });

  it('records a structured failed delivery and starts only a due retry with a fresh OTP', async () => {
    const server = requireServer();
    const orderId = await createDispatchedOrder(server, 'delivery-failure-retry');
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Assigned for failure and retry coverage',
      })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Accepted route' })
      .expect(201);
    await issueAndVerifyPackagePickup(server, orderId);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'First attempt started' })
      .expect(201);

    const retryAt = new Date(Date.now() + 60 * 60 * 1000);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-failure`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({
        reasonCode: DeliveryFailureReasonCode.FARMER_UNAVAILABLE,
        note: 'Wrong partner must not update this assignment',
        retryAt: retryAt.toISOString(),
      })
      .expect(403);

    const failedResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-failure`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        reasonCode: DeliveryFailureReasonCode.FARMER_UNAVAILABLE,
        note: 'Farmer requested another attempt',
        retryAt: retryAt.toISOString(),
      })
      .expect(201);
    expect(failedResponse.body.data.status).toBe(ProductOrderStatus.DELIVERY_FAILED);
    expect(failedResponse.body.data.deliveryAssignment).toMatchObject({
      status: ProductDeliveryAssignmentStatus.DELIVERY_FAILED,
      failureAttemptCount: 1,
      lastFailureReasonCode: DeliveryFailureReasonCode.FARMER_UNAVAILABLE,
      lastFailureNote: 'Farmer requested another attempt',
    });

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-retry`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Must wait for scheduled time' })
      .expect(409);

    await prisma.productDeliveryAssignment.update({
      where: { productOrderId: orderId },
      data: { retryScheduledAt: new Date(Date.now() - 1_000) },
    });
    const retryResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-retry`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Scheduled second attempt started' })
      .expect(201);
    expect(retryResponse.body.data.status).toBe(ProductOrderStatus.OUT_FOR_DELIVERY);
    expect(retryResponse.body.data.deliveryAssignment).toMatchObject({
      status: ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
      failureAttemptCount: 1,
      mockOtpCode: expect.stringMatching(/^[0-9]{6}$/),
    });
    expect(
      (retryResponse.body.data.statusHistory as Array<{ toStatus: ProductOrderStatus }>).map(
        (entry) => entry.toStatus,
      ),
    ).toEqual(
      expect.arrayContaining([
        ProductOrderStatus.DELIVERY_FAILED,
        ProductOrderStatus.OUT_FOR_DELIVERY,
      ]),
    );

    const auditActions = await prisma.auditLog.findMany({
      where: {
        resourceType: 'ProductDeliveryAssignment',
        resourceId: retryResponse.body.data.deliveryAssignment.id as string,
      },
      select: { action: true },
    });
    expect(auditActions.map((item) => item.action)).toEqual(
      expect.arrayContaining(['PRODUCT_DELIVERY_FAILED', 'PRODUCT_DELIVERY_RETRIED']),
    );
  });

  it('rejects a confirmed order and keeps the order out of the packing flow', async () => {
    const server = requireServer();
    const orderId = await createConfirmedOrder(server, 1, 'rejection');

    const rejectResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/reject`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Batch quarantined by quality team' })
      .expect(201);
    expect(rejectResponse.body.data.status).toBe(ProductOrderStatus.DISTRIBUTOR_REJECTED);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-to-pack`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Rejected orders must not enter picking' })
      .expect(409);
  });

  it('enforces the fulfilment state machine and refuses skipped transitions', async () => {
    const server = requireServer();
    const orderId = await createConfirmedOrder(server, 1, 'state-machine');

    // PACKED requires READY_TO_PACK, which requires DISTRIBUTOR_ACCEPTED.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/pack`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Packing before acceptance must fail' })
      .expect(409);

    // An invoice may only be generated for a packed order.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Invoicing before packing must fail' })
      .expect(409);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/accept`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Distributor accepted the order' })
      .expect(201);

    // Dispatch requires an invoice, which this order does not have yet.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Dispatch before invoicing must fail' })
      .expect(409);

    // Delivery may not be assigned before the order is ready for pickup.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Assignment before dispatch must fail',
      })
      .expect(409);

    // Accepting twice must not silently succeed.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/accept`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Duplicate acceptance must fail' })
      .expect(409);
  });

  it('isolates fulfilment orders to the owning distributor organisation', async () => {
    const server = requireServer();
    const orderId = await createConfirmedOrder(server, 1, 'tenant-isolation');

    // A different distributor organisation must not read or act on this order.
    await request(server)
      .get(`/api/v1/fulfilment/orders/${orderId}`)
      .set(seeded.rivalDistributorHeaders)
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/accept`)
      .set(seeded.rivalDistributorHeaders)
      .send({ reason: 'Cross-tenant acceptance must fail' })
      .expect(403);

    const rivalListResponse = await request(server)
      .get('/api/v1/fulfilment/orders')
      .query({ limit: 100 })
      .set(seeded.rivalDistributorHeaders)
      .expect(200);
    const rivalOrderIds = (rivalListResponse.body.data.items as Array<{ id: string }>).map(
      (item) => item.id,
    );
    expect(rivalOrderIds).not.toContain(orderId);

    // A distributor may not filter the list into another distributor's orders.
    await request(server)
      .get('/api/v1/fulfilment/orders')
      .query({ sellerOrganisationId: seeded.distributorOrganisationId, limit: 10 })
      .set(seeded.rivalDistributorHeaders)
      .expect(403);

    // The owning distributor can see its own order.
    const ownListResponse = await request(server)
      .get('/api/v1/fulfilment/orders')
      .query({ limit: 100 })
      .set(seeded.distributorHeaders)
      .expect(200);
    const ownOrderIds = (ownListResponse.body.data.items as Array<{ id: string }>).map(
      (item) => item.id,
    );
    expect(ownOrderIds).toContain(orderId);

    // A farmer holds no fulfilment permission at all.
    await request(server)
      .get(`/api/v1/fulfilment/orders/${orderId}`)
      .set(seeded.farmerHeaders)
      .expect(403);
  });

  it('restricts delivery assignment and completion to the correct actors', async () => {
    const server = requireServer();
    const orderId = await createDispatchedOrder(server, 'delivery-rbac');

    // A distributor holds fulfilment permissions but not delivery-assignment permissions.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.distributorHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Distributors must not assign delivery partners',
      })
      .expect(403);

    // A user without an active delivery-partner membership cannot be assigned.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.farmerUserId,
        reason: 'Only delivery partners may be assigned',
      })
      .expect(400);

    await request(server)
      .put('/api/v1/delivery-partners/me/availability')
      .set(seeded.deliveryPartnerHeaders)
      .send({ availabilityStatus: DeliveryPartnerAvailabilityStatus.OFFLINE })
      .expect(200);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Offline partners must not receive new assignments',
      })
      .expect(400);

    const onlineResponse = await request(server)
      .put('/api/v1/delivery-partners/me/availability')
      .set(seeded.deliveryPartnerHeaders)
      .send({ availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE })
      .expect(200);
    expect(onlineResponse.body.data.availabilityStatus).toBe(
      DeliveryPartnerAvailabilityStatus.ONLINE,
    );

    await request(server)
      .get('/api/v1/delivery-partners/me')
      .set(seeded.deliveryPartnerHeaders)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.availabilityStatus).toBe(DeliveryPartnerAvailabilityStatus.ONLINE);
      });

    await request(server).get('/api/v1/delivery-partners/me').set(seeded.farmerHeaders).expect(403);

    const assignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Assigned to route partner',
      })
      .expect(201);
    const otpCode = assignmentResponse.body.data.deliveryAssignment.mockOtpCode as string;

    const ownAssignmentList = await request(server)
      .get('/api/v1/fulfilment/orders')
      .query({ limit: 100 })
      .set(seeded.deliveryPartnerHeaders)
      .expect(200);
    expect(
      (ownAssignmentList.body.data.items as Array<{ id: string }>).map((item) => item.id),
    ).toContain(orderId);

    await request(server)
      .get(`/api/v1/fulfilment/orders/${orderId}`)
      .set(seeded.deliveryPartnerHeaders)
      .expect(200);

    await request(server)
      .get(`/api/v1/fulfilment/orders/${orderId}`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .expect(403);

    // Pickup cannot begin until the assigned partner explicitly accepts.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Pickup before acceptance must fail' })
      .expect(409);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({ reason: 'Wrong partner must not accept' })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Assigned partner accepted the route' })
      .expect(201);

    // Acceptance alone is insufficient: the physical package label must match.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Pickup without package verification must fail' })
      .expect(409);

    const labelResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/dispatch-label`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Print package pickup label' })
      .expect(201);
    const packageQrCode = labelResponse.body.data.packageQrCode as string;
    expect(packageQrCode).toMatch(/^VARDHNAM-PICKUP:/);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/dispatch-label`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Delivery partner cannot issue seller labels' })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({ packageQrCode })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ packageQrCode: `${packageQrCode}-wrong` })
      .expect(400);

    const pickupResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ packageQrCode })
      .expect(201);
    expect(pickupResponse.body.data.deliveryAssignment).toEqual(
      expect.objectContaining({
        pickupVerificationAttemptCount: 1,
        pickupVerifiedAt: expect.any(String),
        pickupVerifiedByUserId: seeded.deliveryPartnerUserId,
      }),
    );

    // A second delivery partner must not act on someone else's assignment.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({ reason: 'Wrong delivery partner must be refused' })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Assigned partner collected the package' })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({
        otpCode,
        proofNote: 'Wrong delivery partner must be refused',
        proofLocationStatus: 'UNAVAILABLE',
      })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ otpCode, proofNote: 'Delivered and OTP verified', proofLocationStatus: 'DENIED' })
      .expect(201);
  });

  it('refuses delivery completion with an invalid OTP and records the failed attempt', async () => {
    const server = requireServer();
    const orderId = await createDispatchedOrder(server, 'otp-failure');

    const assignmentResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Assigned to route partner',
      })
      .expect(201);
    const assignmentId = assignmentResponse.body.data.deliveryAssignment.id as string;
    const otpCode = assignmentResponse.body.data.deliveryAssignment.mockOtpCode as string;
    const wrongOtpCode = otpCode === '000000' ? '999999' : '000000';

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Accepted for OTP failure test' })
      .expect(201);
    await issueAndVerifyPackagePickup(server, orderId);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/out-for-delivery`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Partner collected the package' })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        otpCode: wrongOtpCode,
        proofNote: 'Incorrect OTP must be refused',
        proofLocationStatus: 'UNAVAILABLE',
      })
      .expect(400);

    const afterFailure = await prisma.productDeliveryAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    expect(afterFailure.otpAttemptCount).toBe(1);
    expect(afterFailure.status).toBe(ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY);
    expect(afterFailure.otpVerifiedAt).toBeNull();

    const failureAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'PRODUCT_DELIVERY_OTP_FAILED',
        resourceId: assignmentId,
      },
    });
    expect(failureAudit).not.toBeNull();

    // The correct OTP still works after a failed attempt.
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/deliver`)
      .set(seeded.deliveryPartnerHeaders)
      .send({
        otpCode,
        proofNote: 'Delivered after one failed attempt',
        proofLocationStatus: 'UNAVAILABLE',
      })
      .expect(201);
  });

  it('requires a rejection reason and lets operations reassign rejected delivery work', async () => {
    const server = requireServer();
    const orderId = await createDispatchedOrder(server, 'delivery-reassignment');

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Initial route assignment',
      })
      .expect(201);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/reject`)
      .set(seeded.deliveryPartnerHeaders)
      .send({})
      .expect(400);

    const rejectedResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/reject`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ reason: 'Route capacity exhausted' })
      .expect(201);
    expect(rejectedResponse.body.data.status).toBe(ProductOrderStatus.READY_FOR_PICKUP);
    expect(rejectedResponse.body.data.deliveryAssignment.status).toBe(
      ProductDeliveryAssignmentStatus.REJECTED,
    );

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/reassign`)
      .set(seeded.distributorHeaders)
      .send({
        deliveryPartnerUserId: seeded.otherDeliveryPartnerUserId,
        reason: 'Distributor cannot reassign delivery work',
      })
      .expect(403);

    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/reassign`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.deliveryPartnerUserId,
        reason: 'Must not return rejected work to the same partner',
      })
      .expect(400);

    const reassignedResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/reassign`)
      .set(seeded.operationsHeaders)
      .send({
        deliveryPartnerUserId: seeded.otherDeliveryPartnerUserId,
        reason: 'Moved to a partner with route capacity',
      })
      .expect(201);
    expect(reassignedResponse.body.data.deliveryAssignment).toEqual(
      expect.objectContaining({
        status: ProductDeliveryAssignmentStatus.ASSIGNED,
        deliveryPartnerUserId: seeded.otherDeliveryPartnerUserId,
        mockOtpCode: expect.stringMatching(/^[0-9]{6}$/),
      }),
    );

    await request(server)
      .get(`/api/v1/fulfilment/orders/${orderId}`)
      .set(seeded.deliveryPartnerHeaders)
      .expect(403);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/accept`)
      .set(seeded.otherDeliveryPartnerHeaders)
      .send({ reason: 'Reassigned route accepted' })
      .expect(201);

    const auditActions = await prisma.auditLog.findMany({
      where: {
        resourceType: 'ProductDeliveryAssignment',
        resourceId: reassignedResponse.body.data.deliveryAssignment.id as string,
      },
      select: { action: true },
    });
    expect(auditActions.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'PRODUCT_DELIVERY_ASSIGNMENT_REJECTED',
        'PRODUCT_DELIVERY_REASSIGNED',
        'PRODUCT_DELIVERY_ASSIGNMENT_ACCEPTED',
      ]),
    );
  });

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  async function issueAndVerifyPackagePickup(
    server: Parameters<typeof request>[0],
    orderId: string,
  ): Promise<void> {
    const labelResponse = await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/dispatch-label`)
      .set(seeded.distributorHeaders)
      .send({ reason: 'Issue package QR for integration delivery' })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/delivery-assignment/verify-pickup`)
      .set(seeded.deliveryPartnerHeaders)
      .send({ packageQrCode: labelResponse.body.data.packageQrCode })
      .expect(201);
  }

  /** Drives cart -> checkout -> successful mock payment so the order reaches CONFIRMED. */
  async function createConfirmedOrder(
    server: Parameters<typeof request>[0],
    quantity: number,
    keySuffix: string,
  ): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(seeded.farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId: seeded.farmerAddressId,
        quantity,
        reason: `Selected Phase 4 item for ${keySuffix}`,
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase4-checkout-${keySuffix}-${randomUUID()}`)
      .send({
        farmerAddressId: seeded.farmerAddressId,
        reason: `Farmer confirmed Phase 4 cart for ${keySuffix}`,
      })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase4-intent-${keySuffix}-${randomUUID()}`)
      .send({ checkoutId, reason: `Farmer started mock payment for ${keySuffix}` })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `phase4-confirm-${keySuffix}-${randomUUID()}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);
    expect(confirmResponse.body.data.checkout.orders[0].status).toBe(ProductOrderStatus.CONFIRMED);

    return confirmResponse.body.data.checkout.orders[0].id as string;
  }

  /** Takes an order all the way to READY_FOR_PICKUP so delivery cases can start from dispatch. */
  async function createDispatchedOrder(
    server: Parameters<typeof request>[0],
    keySuffix: string,
  ): Promise<string> {
    const orderId = await createConfirmedOrder(server, 1, keySuffix);

    for (const step of ['accept', 'ready-to-pack', 'pack'] as const) {
      await request(server)
        .post(`/api/v1/fulfilment/orders/${orderId}/${step}`)
        .set(seeded.distributorHeaders)
        .send({ reason: `Phase 4 ${step} for ${keySuffix}` })
        .expect(201);
    }
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/invoice`)
      .set(seeded.distributorHeaders)
      .send({ reason: `Invoice generated for ${keySuffix}` })
      .expect(201);
    await request(server)
      .post(`/api/v1/fulfilment/orders/${orderId}/ready-for-pickup`)
      .set(seeded.distributorHeaders)
      .send({ reason: `Dispatch staged for ${keySuffix}` })
      .expect(201);

    return orderId;
  }
});

async function seedPhase4Data(): Promise<{
  adminHeaders: Headers;
  operationsHeaders: Headers;
  distributorHeaders: Headers;
  rivalDistributorHeaders: Headers;
  deliveryPartnerHeaders: Headers;
  otherDeliveryPartnerHeaders: Headers;
  farmerHeaders: Headers;
  farmerUserId: string;
  farmerAddressId: string;
  deliveryPartnerUserId: string;
  otherDeliveryPartnerUserId: string;
  distributorOrganisationId: string;
  offerId: string;
  batchId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase4-admin-${suffix}`,
    legalName: 'Phase 4 Admin Organisation',
    displayName: 'Phase 4 Admin',
  });
  const adminUser = await createUser(`phase4-admin-${suffix}@example.local`, 'Phase 4 Admin');
  await createMembership(adminUser.id, adminOrganisation.id, PlatformRole.SUPER_ADMIN);

  const operationsUser = await createUser(`phase4-ops-${suffix}@example.local`, 'Phase 4 Ops');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `phase4-company-${suffix}`,
    legalName: 'Phase 4 Seeds Private Limited',
    displayName: 'Phase 4 Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Phase 4 Seed Brand',
      slug: `phase4-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Phase 4 Hybrid Bajra Seed ${suffix}`,
      slug: `phase4-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `P4-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125000,
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `phase4-distributor-${suffix}`,
    legalName: 'Phase 4 Jaipur Distributor Private Limited',
    displayName: 'Phase 4 Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `phase4-distributor-${suffix}@example.local`,
    'Phase 4 Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );
  await prisma.distributorProfile.create({
    data: {
      organisationId: distributorOrganisation.id,
      primaryContactName: 'Phase 4 Distributor Owner',
      primaryContactPhone: '+919000000022',
      operatingAddress: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      serviceablePincodes: ['302001'],
    },
  });

  const rivalDistributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `phase4-rival-distributor-${suffix}`,
    legalName: 'Phase 4 Ajmer Distributor Private Limited',
    displayName: 'Phase 4 Ajmer Distributor',
    gstin: '08ZZZZZ9999Z1Z5',
  });
  const rivalDistributorUser = await createUser(
    `phase4-rival-distributor-${suffix}@example.local`,
    'Phase 4 Rival Distributor Owner',
  );
  await createMembership(
    rivalDistributorUser.id,
    rivalDistributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );

  const deliveryOrganisation = await createOrganisation({
    type: OrganisationType.DELIVERY_PARTNER,
    slug: `phase4-delivery-${suffix}`,
    legalName: 'Phase 4 Last Mile Logistics',
    displayName: 'Phase 4 Last Mile',
  });
  const deliveryPartnerUser = await createUser(
    `phase4-delivery-${suffix}@example.local`,
    'Phase 4 Delivery Partner',
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
  const otherDeliveryPartnerUser = await createUser(
    `phase4-delivery-other-${suffix}@example.local`,
    'Phase 4 Other Delivery Partner',
  );
  await createMembership(
    otherDeliveryPartnerUser.id,
    deliveryOrganisation.id,
    PlatformRole.DELIVERY_PARTNER,
  );
  await prisma.deliveryPartnerProfile.create({
    data: {
      userId: otherDeliveryPartnerUser.id,
      organisationId: deliveryOrganisation.id,
      availabilityStatus: DeliveryPartnerAvailabilityStatus.ONLINE,
      availabilityChangedAt: new Date(),
    },
  });

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `phase4-farmer-context-${suffix}`,
    legalName: 'Phase 4 Farmer Context',
    displayName: 'Phase 4 Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91004${short}`,
      profile: {
        create: {
          displayName: 'Phase 4 Farmer',
        },
      },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);

  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `P4-JPR-${short}`,
      name: 'Phase 4 Jaipur Distributor Warehouse',
      addressLine1: 'Plot 12, Agri Market Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      status: WarehouseStatus.ACTIVE,
    },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      warehouseId: warehouse.id,
      productId: product.id,
      variantId: variant.id,
      batchNumber: `P4-BATCH-${short}`,
      expiryDate: futureDate(180),
    },
  });
  await prisma.inventoryMovement.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      productId: product.id,
      variantId: variant.id,
      movementType: InventoryMovementType.OPENING_STOCK,
      quantityDelta: 40,
      balanceAfter: 40,
      reason: 'Opening stock for Phase 4 fulfilment validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `P4-OFFER-${short}`,
      sellingPricePaise: 118000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Phase 4 Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: 'Phase 4 Farmer',
      phone: '+919999999999',
      addressLine1: 'Khasra 42, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      isDefault: true,
    },
  });

  await prisma.commissionRule.create({
    data: {
      marketplaceCommissionBps: 500,
      promoterCommissionBps: 0,
      deliveryFeePaise: 2500,
      status: CommissionRuleStatus.ACTIVE,
      effectiveFrom: new Date(Date.now() - 86_400_000),
      createdByUserId: adminUser.id,
      createdByRole: PlatformRole.SUPER_ADMIN,
      reason: 'Phase 4 delivery integration fixture',
    },
  });

  return {
    adminHeaders: headersFor(adminUser.id, PlatformRole.SUPER_ADMIN, adminOrganisation.id),
    operationsHeaders: headersFor(
      operationsUser.id,
      PlatformRole.OPERATIONS_MANAGER,
      adminOrganisation.id,
    ),
    distributorHeaders: headersFor(
      distributorUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      distributorOrganisation.id,
    ),
    rivalDistributorHeaders: headersFor(
      rivalDistributorUser.id,
      PlatformRole.DISTRIBUTOR_OWNER,
      rivalDistributorOrganisation.id,
    ),
    deliveryPartnerHeaders: headersFor(
      deliveryPartnerUser.id,
      PlatformRole.DELIVERY_PARTNER,
      deliveryOrganisation.id,
    ),
    otherDeliveryPartnerHeaders: headersFor(
      otherDeliveryPartnerUser.id,
      PlatformRole.DELIVERY_PARTNER,
      deliveryOrganisation.id,
    ),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    farmerUserId: farmerUser.id,
    farmerAddressId: farmerAddress.id,
    deliveryPartnerUserId: deliveryPartnerUser.id,
    otherDeliveryPartnerUserId: otherDeliveryPartnerUser.id,
    distributorOrganisationId: distributorOrganisation.id,
    offerId: offer.id,
    batchId: batch.id,
  };
}

function headersFor(userId: string, role: PlatformRole, organisationId: string): Headers {
  return {
    'x-user-id': userId,
    'x-user-role': role,
    'x-organisation-id': organisationId,
  };
}

async function createOrganisation(input: {
  type: OrganisationType;
  slug: string;
  legalName: string;
  displayName: string;
  gstin?: string;
}) {
  return prisma.organisation.create({
    data: {
      type: input.type,
      slug: input.slug,
      legalName: input.legalName,
      displayName: input.displayName,
      gstin: input.gstin ?? null,
      registeredStateCode: input.gstin?.slice(0, 2) ?? null,
      gstinVerifiedAt: input.gstin ? new Date() : null,
      status: OrganisationStatus.ACTIVE,
    },
  });
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

function futureDate(daysFromToday: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
}
