import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryMovementType,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  PrismaClient,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
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

describe('Support tickets', () => {
  let app: INestApplication | undefined;
  let seeded: Awaited<ReturnType<typeof seedSupportTicketData>>;
  let ownOrderId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

    await prisma.$connect();
    await seedPermissions();
    seeded = await seedSupportTicketData();

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

    ownOrderId = await createConfirmedOrder(requireServer());
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  function requireServer(): Parameters<typeof request>[0] {
    if (!app) {
      throw new Error('Nest application did not boot');
    }
    return app.getHttpServer();
  }

  async function createConfirmedOrder(server: Parameters<typeof request>[0]): Promise<string> {
    await request(server)
      .post('/api/v1/cart/items')
      .set(seeded.farmerHeaders)
      .send({
        offerId: seeded.offerId,
        farmerAddressId: seeded.farmerAddressId,
        quantity: 1,
        reason: 'Selected item for support-ticket spec',
      })
      .expect(201);

    const checkoutResponse = await request(server)
      .post('/api/v1/checkout/from-cart')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `support-checkout-${randomUUID()}`)
      .send({ farmerAddressId: seeded.farmerAddressId, reason: 'Farmer confirmed cart' })
      .expect(201);
    const checkoutId = checkoutResponse.body.data.id as string;

    const paymentIntentResponse = await request(server)
      .post('/api/v1/payments/mock-intents')
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `support-intent-${randomUUID()}`)
      .send({ checkoutId, reason: 'Farmer started mock payment' })
      .expect(201);
    const paymentIntentId = paymentIntentResponse.body.data.id as string;

    const confirmResponse = await request(server)
      .post(`/api/v1/payments/mock-intents/${paymentIntentId}/confirm`)
      .set(seeded.farmerHeaders)
      .set('Idempotency-Key', `support-confirm-${randomUUID()}`)
      .send({ outcome: MockPaymentOutcome.SUCCESS, reason: 'Mock payment succeeded' })
      .expect(201);

    return confirmResponse.body.data.checkout.orders[0].id as string;
  }

  it('creates a ticket without an order and computes the SLA due date from priority', async () => {
    const server = requireServer();

    const beforeCreate = Date.now();
    const response = await request(server)
      .post('/api/v1/support/tickets')
      .set(seeded.farmerHeaders)
      .send({
        category: SupportTicketCategory.ACCOUNT_ISSUE,
        priority: SupportTicketPriority.URGENT,
        subject: 'Cannot log in',
        description: 'OTP is not being accepted.',
      })
      .expect(201);
    expect(response.body.data.status).toBe(SupportTicketStatus.OPEN);

    const slaDueAt = new Date(response.body.data.slaDueAt).getTime();
    const baseHoursMs = 48 * 3_600_000;
    // URGENT = base / 4
    expect(slaDueAt).toBeGreaterThan(beforeCreate + baseHoursMs / 4 - 60_000);
    expect(slaDueAt).toBeLessThan(beforeCreate + baseHoursMs / 4 + 60_000);
  });

  it('rejects referencing an order the actor has no standing on', async () => {
    const server = requireServer();

    await request(server)
      .post('/api/v1/support/tickets')
      .set(seeded.otherFarmerHeaders)
      .send({
        category: SupportTicketCategory.ORDER_ISSUE,
        subject: 'Not my order',
        description: "Trying to raise a ticket on someone else's order.",
        productOrderId: ownOrderId,
      })
      .expect(403);
  });

  it('allows the farmer who owns the order to raise a ticket against it', async () => {
    const server = requireServer();

    const response = await request(server)
      .post('/api/v1/support/tickets')
      .set(seeded.farmerHeaders)
      .send({
        category: SupportTicketCategory.ORDER_ISSUE,
        subject: 'Order delayed',
        description: 'The order has not arrived yet.',
        productOrderId: ownOrderId,
      })
      .expect(201);
    expect(response.body.data.productOrderId).toBe(ownOrderId);
  });

  it('rejects a farmer reading any ticket or listing all tickets', async () => {
    const server = requireServer();

    await request(server).get('/api/v1/support/tickets').expect(401);

    await request(server).get('/api/v1/support/tickets').set(seeded.farmerHeaders).expect(403);
  });

  it('rejects assigning a ticket to a user without an active support-agent membership', async () => {
    const server = requireServer();
    const ticketId = await createTicket(server, seeded.farmerHeaders);

    await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/assign`)
      .set(seeded.operationsHeaders)
      .send({ assignedToUserId: seeded.farmerUserId })
      .expect(400);
  });

  it('runs the full transition chain and rejects an invalid transition', async () => {
    const server = requireServer();
    const ticketId = await createTicket(server, seeded.farmerHeaders);

    await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/resolve`)
      .set(seeded.supportAgentHeaders)
      .send({ resolutionNote: 'Too early' })
      .expect(409);

    const assignResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/assign`)
      .set(seeded.operationsHeaders)
      .send({ assignedToUserId: seeded.supportAgentUserId, reason: 'Routing to support queue' })
      .expect(201);
    expect(assignResponse.body.data.status).toBe(SupportTicketStatus.ASSIGNED);
    expect(assignResponse.body.data.assignedToUserId).toBe(seeded.supportAgentUserId);

    const waitingResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/mark-waiting`)
      .set(seeded.supportAgentHeaders)
      .send({ status: SupportTicketStatus.WAITING_FOR_CUSTOMER, reason: 'Need more details' })
      .expect(201);
    expect(waitingResponse.body.data.status).toBe(SupportTicketStatus.WAITING_FOR_CUSTOMER);

    const resumeResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/resume`)
      .set(seeded.supportAgentHeaders)
      .send({ reason: 'Farmer replied' })
      .expect(201);
    expect(resumeResponse.body.data.status).toBe(SupportTicketStatus.ASSIGNED);

    const resolveResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/resolve`)
      .set(seeded.supportAgentHeaders)
      .send({ resolutionNote: 'Issue explained and confirmed resolved.' })
      .expect(201);
    expect(resolveResponse.body.data.status).toBe(SupportTicketStatus.RESOLVED);
    expect(resolveResponse.body.data.resolutionNote).toBe(
      'Issue explained and confirmed resolved.',
    );

    const closeResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/close`)
      .set(seeded.supportAgentHeaders)
      .send({ reason: 'Confirmed closed' })
      .expect(201);
    expect(closeResponse.body.data.status).toBe(SupportTicketStatus.CLOSED);

    const reopenResponse = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/reopen`)
      .set(seeded.supportAgentHeaders)
      .send({ reason: 'Issue happened again' })
      .expect(201);
    expect(reopenResponse.body.data.status).toBe(SupportTicketStatus.REOPENED);
    expect(reopenResponse.body.data.resolvedAt).toBeNull();
    expect(reopenResponse.body.data.closedAt).toBeNull();

    const notificationResponse = await request(server)
      .get('/api/v1/notifications/me')
      .query({ channel: 'IN_APP', limit: 100 })
      .set(seeded.farmerHeaders)
      .expect(200);
    const ticketNotifications = (
      notificationResponse.body.data.items as Array<{
        category: string;
        relatedResourceType: string | null;
        relatedResourceId: string | null;
        status: string;
      }>
    ).filter((notification) => notification.relatedResourceId === ticketId);
    expect(ticketNotifications).toHaveLength(7);
    expect(ticketNotifications).toEqual(
      expect.arrayContaining(
        [
          'SUPPORT_TICKET_CREATED',
          'SUPPORT_TICKET_ASSIGNED',
          'SUPPORT_TICKET_WAITING_FOR_CUSTOMER',
          'SUPPORT_TICKET_RESUMED',
          'SUPPORT_TICKET_RESOLVED',
          'SUPPORT_TICKET_CLOSED',
          'SUPPORT_TICKET_REOPENED',
        ].map((category) =>
          expect.objectContaining({
            category,
            status: 'SENT',
            relatedResourceType: 'SupportTicket',
          }),
        ),
      ),
    );
  });

  it('attaches evidence to a ticket', async () => {
    const server = requireServer();
    const ticketId = await createTicket(server, seeded.farmerHeaders);

    const response = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/evidence`)
      .set(seeded.farmerHeaders)
      .send({
        fileName: 'screenshot.png',
        storageKey: `mock/support/${ticketId}/screenshot.png`,
      })
      .expect(201);
    expect(response.body.data.fileName).toBe('screenshot.png');

    const ticket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { evidence: true },
    });
    expect(ticket.evidence).toHaveLength(1);
  });

  it('scopes /tickets/me to the requesting farmer only', async () => {
    const server = requireServer();
    await createTicket(server, seeded.farmerHeaders);

    const myTicketsResponse = await request(server)
      .get('/api/v1/support/tickets/me')
      .set(seeded.farmerHeaders)
      .expect(200);
    const myTickets = myTicketsResponse.body.data.items as Array<{ raisedByUserId: string }>;
    expect(myTickets.length).toBeGreaterThan(0);
    expect(myTickets.every((ticket) => ticket.raisedByUserId === seeded.farmerUserId)).toBe(true);

    const otherFarmerTicketsResponse = await request(server)
      .get('/api/v1/support/tickets/me')
      .set(seeded.otherFarmerHeaders)
      .expect(200);
    expect(otherFarmerTicketsResponse.body.data.items).toHaveLength(0);
  });

  it('allows a farmer to reopen only their own resolved ticket', async () => {
    const server = requireServer();
    const ticketId = await createTicket(server, seeded.farmerHeaders);

    await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/assign`)
      .set(seeded.operationsHeaders)
      .send({ assignedToUserId: seeded.supportAgentUserId })
      .expect(201);
    await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/resolve`)
      .set(seeded.supportAgentHeaders)
      .send({ resolutionNote: 'Resolved before farmer verification.' })
      .expect(201);

    await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/reopen-own`)
      .set(seeded.otherFarmerHeaders)
      .send({ reason: 'Attempting to reopen another farmer ticket' })
      .expect(403);

    const response = await request(server)
      .post(`/api/v1/support/tickets/${ticketId}/reopen-own`)
      .set(seeded.farmerHeaders)
      .send({ reason: 'The issue is still happening' })
      .expect(201);
    expect(response.body.data.status).toBe(SupportTicketStatus.REOPENED);
    expect(response.body.data.resolvedAt).toBeNull();
  });

  async function createTicket(
    server: Parameters<typeof request>[0],
    headers: Headers,
  ): Promise<string> {
    const response = await request(server)
      .post('/api/v1/support/tickets')
      .set(headers)
      .send({
        category: SupportTicketCategory.OTHER,
        subject: `Test ticket ${randomUUID()}`,
        description: 'Created for transition-chain testing.',
      })
      .expect(201);
    return response.body.data.id as string;
  }
});

async function seedSupportTicketData(): Promise<{
  operationsHeaders: Headers;
  supportAgentHeaders: Headers;
  farmerHeaders: Headers;
  otherFarmerHeaders: Headers;
  farmerUserId: string;
  supportAgentUserId: string;
  farmerAddressId: string;
  offerId: string;
}> {
  const suffix = randomUUID();
  const short = suffix.slice(0, 8);

  const adminOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `support-admin-${suffix}`,
    legalName: 'Support Ticket Admin Organisation',
    displayName: 'Support Ticket Admin',
  });
  const operationsUser = await createUser(`support-ops-${suffix}@example.local`, 'Support Ops');
  await createMembership(operationsUser.id, adminOrganisation.id, PlatformRole.OPERATIONS_MANAGER);
  const supportAgentUser = await createUser(
    `support-agent-${suffix}@example.local`,
    'Support Agent',
  );
  await createMembership(supportAgentUser.id, adminOrganisation.id, PlatformRole.SUPPORT_AGENT);

  const companyOrganisation = await createOrganisation({
    type: OrganisationType.COMPANY,
    slug: `support-company-${suffix}`,
    legalName: 'Support Ticket Seeds Private Limited',
    displayName: 'Support Ticket Seeds',
  });
  const brand = await prisma.brand.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      name: 'Support Ticket Seed Brand',
      slug: `support-seed-brand-${suffix}`,
      status: CatalogueStatus.APPROVED,
    },
  });
  const product = await prisma.masterProduct.create({
    data: {
      companyOrganisationId: companyOrganisation.id,
      brandId: brand.id,
      name: `Support Ticket Hybrid Bajra Seed ${suffix}`,
      slug: `support-hybrid-bajra-seed-${suffix}`,
      category: 'Seeds',
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `SUP-1KG-${short}`,
      variantName: '1 kg pack',
      packSize: new Prisma.Decimal(1),
      packUnit: 'kg',
      hsnCode: '1008',
      gstRateBps: 500,
      mrpPaise: 125_000,
    },
  });

  const distributorOrganisation = await createOrganisation({
    type: OrganisationType.DISTRIBUTOR,
    slug: `support-distributor-${suffix}`,
    legalName: 'Support Ticket Jaipur Distributor Private Limited',
    displayName: 'Support Ticket Jaipur Distributor',
    gstin: '08ABCDE1234F1Z5',
  });
  const distributorUser = await createUser(
    `support-distributor-${suffix}@example.local`,
    'Support Ticket Distributor Owner',
  );
  await createMembership(
    distributorUser.id,
    distributorOrganisation.id,
    PlatformRole.DISTRIBUTOR_OWNER,
  );

  const farmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `support-farmer-context-${suffix}`,
    legalName: 'Support Ticket Farmer Context',
    displayName: 'Support Ticket Farmer Context',
  });
  const farmerUser = await prisma.user.create({
    data: {
      phone: `+91009${short}`,
      profile: { create: { displayName: 'Support Ticket Farmer' } },
    },
  });
  await createMembership(farmerUser.id, farmerOrganisation.id, PlatformRole.FARMER);
  const farmerProfile = await prisma.farmerProfile.create({
    data: {
      userId: farmerUser.id,
      fullName: 'Support Ticket Farmer',
      preferredLocale: 'hi-IN',
      primaryPincode: '302001',
    },
  });
  const farmerAddress = await prisma.farmerAddress.create({
    data: {
      farmerProfileId: farmerProfile.id,
      label: 'Home',
      recipientName: 'Support Ticket Farmer',
      phone: '+919999999994',
      addressLine1: 'Khasra 45, Rampura Road',
      city: 'Jaipur',
      state: 'Rajasthan',
      stateCode: '08',
      pincode: '302001',
      isDefault: true,
    },
  });

  const otherFarmerUser = await prisma.user.create({
    data: {
      phone: `+91010${short}`,
      profile: { create: { displayName: 'Other Support Ticket Farmer' } },
    },
  });
  const otherFarmerOrganisation = await createOrganisation({
    type: OrganisationType.VARDHNAM,
    slug: `support-other-farmer-context-${suffix}`,
    legalName: 'Other Support Ticket Farmer Context',
    displayName: 'Other Support Ticket Farmer Context',
  });
  await createMembership(otherFarmerUser.id, otherFarmerOrganisation.id, PlatformRole.FARMER);

  const warehouse = await prisma.warehouse.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      code: `SUP-JPR-${short}`,
      name: 'Support Ticket Jaipur Distributor Warehouse',
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
      batchNumber: `SUP-BATCH-${short}`,
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
      reason: 'Opening stock for support-ticket validation',
    },
  });
  const offer = await prisma.distributorOffer.create({
    data: {
      distributorOrganisationId: distributorOrganisation.id,
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouse.id,
      batchId: batch.id,
      offerCode: `SUP-OFFER-${short}`,
      sellingPricePaise: 118_000,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 10,
      serviceablePincodes: ['302001'],
      fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
      deliverySlaDays: 3,
      status: DistributorOfferStatus.APPROVED,
    },
  });

  return {
    operationsHeaders: headersFor(
      operationsUser.id,
      PlatformRole.OPERATIONS_MANAGER,
      adminOrganisation.id,
    ),
    supportAgentHeaders: headersFor(
      supportAgentUser.id,
      PlatformRole.SUPPORT_AGENT,
      adminOrganisation.id,
    ),
    farmerHeaders: headersFor(farmerUser.id, PlatformRole.FARMER, farmerOrganisation.id),
    otherFarmerHeaders: headersFor(
      otherFarmerUser.id,
      PlatformRole.FARMER,
      otherFarmerOrganisation.id,
    ),
    farmerUserId: farmerUser.id,
    supportAgentUserId: supportAgentUser.id,
    farmerAddressId: farmerAddress.id,
    offerId: offer.id,
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
      profile: { create: { displayName } },
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
