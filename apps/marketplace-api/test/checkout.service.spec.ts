import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  CartStatus,
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  IdempotencyStatus,
  InventoryBatchStatus,
  InventoryMovementType,
  MembershipStatus,
  OrderType,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  ProductCheckoutStatus,
  ProductDeliveryAssignmentStatus,
  ProductDispatchStatus,
  ProductInvoiceStatus,
  ProductOrderStatus,
  UserStatus,
  WarehouseStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { CheckoutService } from '../src/checkout/checkout.service';

const farmerUserId = '00000000-0000-4000-8000-000000004101';
const farmerOrganisationId = '00000000-0000-4000-8000-000000004102';
const farmerProfileId = '00000000-0000-4000-8000-000000004103';
const farmerAddressId = '00000000-0000-4000-8000-000000004104';
const cartId = '00000000-0000-4000-8000-000000004105';
const cartItemId = '00000000-0000-4000-8000-000000004106';
const distributorOrganisationId = '00000000-0000-4000-8000-000000004201';
const otherDistributorOrganisationId = '00000000-0000-4000-8000-000000004202';
const productId = '00000000-0000-4000-8000-000000004301';
const variantId = '00000000-0000-4000-8000-000000004302';
const warehouseId = '00000000-0000-4000-8000-000000004401';
const batchId = '00000000-0000-4000-8000-000000004501';
const offerId = '00000000-0000-4000-8000-000000004601';
const checkoutId = '00000000-0000-4000-8000-000000004701';
const orderId = '00000000-0000-4000-8000-000000004801';
const orderItemId = '00000000-0000-4000-8000-000000004901';
const movementId = '00000000-0000-4000-8000-000000004902';
const reservationId = '00000000-0000-4000-8000-000000004903';
const releaseMovementId = '00000000-0000-4000-8000-000000004906';
const invoiceId = '00000000-0000-4000-8000-000000004907';
const dispatchId = '00000000-0000-4000-8000-000000004908';
const deliveryAssignmentId = '00000000-0000-4000-8000-000000004909';
const deliveryPartnerUserId = '00000000-0000-4000-8000-000000004209';
const deliveryPartnerOrganisationId = '00000000-0000-4000-8000-000000004210';

const accessService = {
  hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
    actor.permissions.includes(permission),
  ),
};

const financeService = {
  recordDeliveryCommission: jest.fn().mockResolvedValue(undefined),
};

function deliveryOtpHash(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

describe('CheckoutService', () => {
  const farmerActor: CurrentUser = {
    userId: farmerUserId,
    role: PlatformRole.FARMER,
    membershipId: '00000000-0000-4000-8000-000000004107',
    organisationId: farmerOrganisationId,
    permissions: [
      PermissionCode.CHECKOUT_CREATE_OWN,
      PermissionCode.CHECKOUT_READ_OWN,
      PermissionCode.CHECKOUT_CANCEL_OWN,
      PermissionCode.ORDERS_READ_OWN,
      PermissionCode.ORDERS_CANCEL_OWN,
    ],
  };
  const distributorActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000004203',
    role: PlatformRole.DISTRIBUTOR_OWNER,
    membershipId: '00000000-0000-4000-8000-000000004204',
    organisationId: distributorOrganisationId,
    permissions: [
      PermissionCode.FULFILMENT_ORDERS_READ_OWN,
      PermissionCode.FULFILMENT_ORDERS_MANAGE_OWN,
    ],
  };
  const otherDistributorActor: CurrentUser = {
    ...distributorActor,
    membershipId: '00000000-0000-4000-8000-000000004205',
    organisationId: otherDistributorOrganisationId,
  };
  const operationsActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000004206',
    role: PlatformRole.OPERATIONS_MANAGER,
    membershipId: '00000000-0000-4000-8000-000000004207',
    organisationId: '00000000-0000-4000-8000-000000004208',
    permissions: [PermissionCode.DELIVERY_ASSIGNMENTS_MANAGE_ANY],
  };
  const deliveryPartnerActor: CurrentUser = {
    userId: deliveryPartnerUserId,
    role: PlatformRole.DELIVERY_PARTNER,
    membershipId: '00000000-0000-4000-8000-000000004211',
    organisationId: deliveryPartnerOrganisationId,
    permissions: [
      PermissionCode.DELIVERY_ASSIGNMENTS_READ_OWN,
      PermissionCode.DELIVERY_ASSIGNMENTS_MANAGE_OWN,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires an idempotency key before checkout creation', async () => {
    const service = new CheckoutService(
      {} as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(service.checkoutFromCart({}, farmerActor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates child product orders and reservation movements from the cart', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const checkoutDetail = checkoutDetailFixture();
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue(cartFixture()),
        update: jest.fn().mockResolvedValue(clearedCartFixture()),
      },
      farmerAddress: {
        findFirst: jest.fn().mockResolvedValue(farmerAddressFixture()),
      },
      distributorOffer: {
        findUnique: jest.fn().mockResolvedValue(offerFixture()),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture(4)]),
      },
      productCheckout: {
        create: jest.fn().mockResolvedValue(productCheckoutFixture()),
        findFirst: jest.fn().mockResolvedValue(checkoutDetail),
      },
      productOrder: {
        create: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.PENDING_PAYMENT)),
        update: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.INVENTORY_RESERVED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      productOrderItem: {
        create: jest.fn().mockResolvedValue(productOrderItemFixture()),
      },
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue(inventoryMovementFixture(4)),
        create: jest.fn().mockResolvedValue(inventoryMovementFixture(2)),
      },
      productOrderItemReservation: {
        create: jest.fn().mockResolvedValue(productOrderItemReservationFixture()),
      },
      cartItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.checkoutFromCart(
      {
        farmerAddressId,
        reason: 'Farmer confirmed cart',
      },
      farmerActor,
      'checkout-key-1',
      'req-checkout-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: checkoutId,
        status: ProductCheckoutStatus.PENDING_PAYMENT,
        subtotalPaise: 236000,
        itemCount: 1,
        childOrderCount: 1,
      }),
    );
    expect(tx.productOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderType: OrderType.PRODUCT_ORDER,
          farmerProfileId,
          sellerOrganisationId: distributorOrganisationId,
          status: ProductOrderStatus.PENDING_PAYMENT,
          subtotalPaise: 236000,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: InventoryMovementType.RESERVED_FOR_ORDER,
          quantityDelta: -2,
          balanceAfter: 2,
          referenceType: 'ProductOrder',
          referenceId: orderId,
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductOrderStatus.INVENTORY_RESERVED,
        },
      }),
    );
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId } });
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IdempotencyStatus.COMPLETED,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVENTORY_RESERVED_FOR_ORDER',
        resourceType: 'InventoryMovement',
        resourceId: movementId,
      }),
      tx,
    );
  });

  it('requires an idempotency key before checkout cancellation', async () => {
    const service = new CheckoutService(
      {} as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(service.cancelMyCheckout(checkoutId, {}, farmerActor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancels an eligible checkout and releases reserved inventory movements', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      productCheckout: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            checkoutDetailFixture({
              checkoutStatus: ProductCheckoutStatus.PAYMENT_FAILED,
              orderStatus: ProductOrderStatus.PAYMENT_FAILED,
            }),
          )
          .mockResolvedValueOnce(
            checkoutDetailFixture({
              checkoutStatus: ProductCheckoutStatus.CANCELLED,
              orderStatus: ProductOrderStatus.CANCELLED,
            }),
          ),
        update: jest
          .fn()
          .mockResolvedValue(productCheckoutFixture(ProductCheckoutStatus.CANCELLED)),
      },
      productOrder: {
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.CANCELLED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(inventoryMovementFixture(2)),
        create: jest.fn().mockResolvedValue(releaseMovementFixture(4)),
      },
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.cancelMyCheckout(
      checkoutId,
      { reason: 'Farmer cancelled after failed mock payment' },
      farmerActor,
      'checkout-cancel-key-1',
      'req-checkout-cancel-1',
    );

    expect(result.status).toBe(ProductCheckoutStatus.CANCELLED);
    expect(result.orders[0]?.status).toBe(ProductOrderStatus.CANCELLED);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: InventoryMovementType.RELEASED_FROM_ORDER,
          quantityDelta: 2,
          balanceAfter: 4,
          referenceType: 'ProductOrderCancellation',
          referenceId: orderId,
        }),
      }),
    );
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductOrderStatus.CANCELLED,
        },
      }),
    );
    expect(tx.productCheckout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductCheckoutStatus.CANCELLED,
        },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVENTORY_RELEASED_FROM_ORDER',
        resourceType: 'InventoryMovement',
        resourceId: releaseMovementId,
      }),
      tx,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_ORDER_CANCELLED_BY_FARMER',
        resourceType: 'ProductOrder',
        resourceId: orderId,
      }),
      tx,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_CHECKOUT_CANCELLED_BY_FARMER',
        resourceType: 'ProductCheckout',
        resourceId: checkoutId,
      }),
      tx,
    );
  });

  it('cancels an eligible child order with its own idempotency scope', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.INVENTORY_RESERVED))
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.CANCELLED)),
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.CANCELLED)),
      },
      productCheckout: {
        findFirst: jest.fn().mockResolvedValue(checkoutDetailFixture()),
        update: jest
          .fn()
          .mockResolvedValue(productCheckoutFixture(ProductCheckoutStatus.CANCELLED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(inventoryMovementFixture(2)),
        create: jest.fn().mockResolvedValue(releaseMovementFixture(4)),
      },
    };
    const prisma = {
      idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.cancelMyOrder(
      orderId,
      { reason: 'Farmer cancelled child order before payment' },
      farmerActor,
      'order-cancel-key-1',
      'req-order-cancel-1',
    );

    expect(result.status).toBe(ProductOrderStatus.CANCELLED);
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: `orders:cancel:${farmerUserId}:${orderId}`,
          key: 'order-cancel-key-1',
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: InventoryMovementType.RELEASED_FROM_ORDER,
          quantityDelta: 2,
          referenceType: 'ProductOrderCancellation',
          referenceId: orderId,
        }),
      }),
    );
  });

  it('accepts a confirmed fulfilment order for the seller distributor', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.CONFIRMED))
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.DISTRIBUTOR_ACCEPTED)),
        update: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.DISTRIBUTOR_ACCEPTED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.acceptFulfilmentOrder(
      orderId,
      { reason: 'Distributor confirmed stock and delivery SLA' },
      distributorActor,
      'req-fulfil-accept-1',
    );

    expect(result.status).toBe(ProductOrderStatus.DISTRIBUTOR_ACCEPTED);
    expect(tx.productOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
        },
      }),
    );
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.CONFIRMED,
          toStatus: ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
          actorUserId: distributorActor.userId,
          requestId: 'req-fulfil-accept-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_ORDER_ACCEPTED_BY_DISTRIBUTOR',
        resourceType: 'ProductOrder',
        resourceId: orderId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('marks an accepted fulfilment order ready to pack', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.DISTRIBUTOR_ACCEPTED))
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.READY_TO_PACK)),
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.READY_TO_PACK)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.markFulfilmentOrderReadyToPack(
      orderId,
      { reason: 'Items picked and checked' },
      distributorActor,
      'req-fulfil-pick-1',
    );

    expect(result.status).toBe(ProductOrderStatus.READY_TO_PACK);
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.DISTRIBUTOR_ACCEPTED,
          toStatus: ProductOrderStatus.READY_TO_PACK,
          actorUserId: distributorActor.userId,
          requestId: 'req-fulfil-pick-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_ORDER_READY_TO_PACK',
        resourceType: 'ProductOrder',
        resourceId: orderId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('packs a ready-to-pack fulfilment order', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.READY_TO_PACK))
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.PACKED)),
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.PACKED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.packFulfilmentOrder(
      orderId,
      { reason: 'Packed for dispatch' },
      distributorActor,
      'req-fulfil-pack-1',
    );

    expect(result.status).toBe(ProductOrderStatus.PACKED);
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.READY_TO_PACK,
          toStatus: ProductOrderStatus.PACKED,
          actorUserId: distributorActor.userId,
          requestId: 'req-fulfil-pack-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_ORDER_PACKED',
        resourceType: 'ProductOrder',
        resourceId: orderId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('generates an invoice snapshot for a packed fulfilment order', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      productInvoice: {
        create: jest.fn().mockResolvedValue(invoice),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.PACKED))
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.PACKED, { invoice })),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.generateFulfilmentOrderInvoice(
      orderId,
      { reason: 'Invoice checked against packed items' },
      distributorActor,
      'req-invoice-1',
    );

    expect(result.invoice).toEqual(
      expect.objectContaining({
        id: invoiceId,
        invoiceNumber: 'INV-20260803-TEST0001',
        subtotalPaise: 236000,
        taxPaise: 0,
        totalPaise: 236000,
      }),
    );
    expect(tx.productInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productOrderId: orderId,
          checkoutId,
          farmerProfileId,
          sellerOrganisationId: distributorOrganisationId,
          status: ProductInvoiceStatus.GENERATED,
          subtotalPaise: 236000,
          taxPaise: 0,
          totalPaise: 236000,
          sellerLegalNameSnapshot: 'Phase 4A Distributor Private Limited',
          sellerDisplayNameSnapshot: 'Phase 4A Distributor',
          sellerGstinSnapshot: '08ABCDE1234F1Z5',
          farmerNameSnapshot: 'Phase 3B Farmer',
          generatedByUserId: distributorActor.userId,
          generatedByRole: PlatformRole.DISTRIBUTOR_OWNER,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_INVOICE_GENERATED',
        resourceType: 'ProductInvoice',
        resourceId: invoiceId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('blocks invoice generation before the order is packed', async () => {
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValue(orderDetailFixture(ProductOrderStatus.READY_TO_PACK)),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(
      service.generateFulfilmentOrderInvoice(orderId, {}, distributorActor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks a packed invoiced fulfilment order ready for pickup', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const dispatch = productDispatchFixture();
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productDispatch: {
        create: jest.fn().mockResolvedValue(dispatch),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(orderDetailFixture(ProductOrderStatus.PACKED, { invoice }))
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.READY_FOR_PICKUP, { invoice, dispatch }),
          ),
        update: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.READY_FOR_PICKUP)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.markFulfilmentOrderReadyForPickup(
      orderId,
      { reason: 'Packages ready at warehouse' },
      distributorActor,
      'req-dispatch-1',
    );

    expect(result.status).toBe(ProductOrderStatus.READY_FOR_PICKUP);
    expect(result.dispatch).toEqual(
      expect.objectContaining({
        id: dispatchId,
        dispatchNumber: 'DSP-20260803-TEST0001',
        status: ProductDispatchStatus.READY_FOR_PICKUP,
        invoiceNumberSnapshot: 'INV-20260803-TEST0001',
      }),
    );
    expect(tx.productDispatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productOrderId: orderId,
          invoiceId,
          sellerOrganisationId: distributorOrganisationId,
          status: ProductDispatchStatus.READY_FOR_PICKUP,
          serviceablePincode: '302001',
          invoiceNumberSnapshot: 'INV-20260803-TEST0001',
          readyForPickupReason: 'Packages ready at warehouse',
          readyByUserId: distributorActor.userId,
          readyByRole: PlatformRole.DISTRIBUTOR_OWNER,
        }),
      }),
    );
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.PACKED,
          toStatus: ProductOrderStatus.READY_FOR_PICKUP,
          actorUserId: distributorActor.userId,
          requestId: 'req-dispatch-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_ORDER_READY_FOR_PICKUP',
        resourceType: 'ProductOrder',
        resourceId: orderId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_DISPATCH_CREATED',
        resourceType: 'ProductDispatch',
        resourceId: dispatchId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('blocks ready-for-pickup dispatch before invoice generation', async () => {
    const tx = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisationFixture()),
      },
      productOrder: {
        findFirst: jest.fn().mockResolvedValue(orderDetailFixture(ProductOrderStatus.PACKED)),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(
      service.markFulfilmentOrderReadyForPickup(orderId, {}, distributorActor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('assigns a ready-for-pickup fulfilment order to an active delivery partner', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const dispatch = productDispatchFixture();
    const assignment = productDeliveryAssignmentFixture();
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeDeliveryPartnerUserFixture()),
      },
      productDeliveryAssignment: {
        create: jest.fn().mockResolvedValue(assignment),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.READY_FOR_PICKUP, { invoice, dispatch }),
          )
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.READY_FOR_PICKUP, {
              invoice,
              dispatch,
              deliveryAssignment: assignment,
            }),
          ),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.assignFulfilmentOrderDelivery(
      orderId,
      {
        deliveryPartnerUserId,
        reason: 'Assigned to local route partner',
      },
      operationsActor,
      'req-delivery-assign-1',
    );

    expect(result.deliveryAssignment).toEqual(
      expect.objectContaining({
        id: deliveryAssignmentId,
        assignmentNumber: 'DLV-20260803-TEST0001',
        status: ProductDeliveryAssignmentStatus.ASSIGNED,
        deliveryPartnerUserId,
        mockOtpCode: expect.stringMatching(/^[0-9]{6}$/),
      }),
    );
    expect(tx.productDeliveryAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productOrderId: orderId,
          checkoutId,
          dispatchId,
          farmerProfileId,
          sellerOrganisationId: distributorOrganisationId,
          deliveryPartnerUserId,
          status: ProductDeliveryAssignmentStatus.ASSIGNED,
          serviceablePincode: '302001',
          dispatchNumberSnapshot: 'DSP-20260803-TEST0001',
          invoiceNumberSnapshot: 'INV-20260803-TEST0001',
          assignedByUserId: operationsActor.userId,
          assignedByRole: PlatformRole.OPERATIONS_MANAGER,
          otpHash: expect.any(String),
          otpSalt: expect.any(String),
          otpExpiresAt: expect.any(Date),
        }),
      }),
    );
    const createdData = tx.productDeliveryAssignment.create.mock.calls[0][0].data;
    expect(createdData.otpCode).toBeUndefined();
    expect(createdData.otpHash).not.toBe(result.deliveryAssignment?.mockOtpCode);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_DELIVERY_ASSIGNED',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: deliveryAssignmentId,
        organisationId: distributorOrganisationId,
      }),
      tx,
    );
  });

  it('moves an assigned delivery out for delivery by the assigned partner', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const dispatch = productDispatchFixture();
    const assignment = productDeliveryAssignmentFixture();
    const outForDeliveryAssignment = productDeliveryAssignmentFixture(
      ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
    );
    const tx = {
      productDeliveryAssignment: {
        update: jest.fn().mockResolvedValue(outForDeliveryAssignment),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.READY_FOR_PICKUP, {
              invoice,
              dispatch,
              deliveryAssignment: assignment,
            }),
          )
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.OUT_FOR_DELIVERY, {
              invoice,
              dispatch,
              deliveryAssignment: outForDeliveryAssignment,
            }),
          ),
        update: jest
          .fn()
          .mockResolvedValue(productOrderFixture(ProductOrderStatus.OUT_FOR_DELIVERY)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.markFulfilmentOrderOutForDelivery(
      orderId,
      { reason: 'Partner collected packages' },
      deliveryPartnerActor,
      'req-delivery-start-1',
    );

    expect(result.status).toBe(ProductOrderStatus.OUT_FOR_DELIVERY);
    expect(result.deliveryAssignment?.status).toBe(
      ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
    );
    expect(tx.productDeliveryAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: deliveryAssignmentId },
        data: expect.objectContaining({
          status: ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
          startedByUserId: deliveryPartnerUserId,
          startedByRole: PlatformRole.DELIVERY_PARTNER,
          startedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.READY_FOR_PICKUP,
          toStatus: ProductOrderStatus.OUT_FOR_DELIVERY,
          actorUserId: deliveryPartnerUserId,
          requestId: 'req-delivery-start-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_DELIVERY_OUT_FOR_DELIVERY',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: deliveryAssignmentId,
      }),
      tx,
    );
  });

  it('completes an out-for-delivery order after delivery OTP verification', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const dispatch = productDispatchFixture();
    const assignment = productDeliveryAssignmentFixture(
      ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
      { otpCode: '123456' },
    );
    const deliveredAssignment = productDeliveryAssignmentFixture(
      ProductDeliveryAssignmentStatus.DELIVERED,
      {
        otpCode: '123456',
        deliveryProofNote: 'Delivered to farmer and OTP verified',
      },
    );
    const tx = {
      productDeliveryAssignment: {
        update: jest.fn().mockResolvedValue(deliveredAssignment),
      },
      productOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.OUT_FOR_DELIVERY, {
              invoice,
              dispatch,
              deliveryAssignment: assignment,
            }),
          )
          .mockResolvedValueOnce(
            orderDetailFixture(ProductOrderStatus.DELIVERED, {
              invoice,
              dispatch,
              deliveryAssignment: deliveredAssignment,
            }),
          ),
        update: jest.fn().mockResolvedValue(productOrderFixture(ProductOrderStatus.DELIVERED)),
      },
      productOrderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    const result = await service.completeFulfilmentOrderDelivery(
      orderId,
      {
        otpCode: '123456',
        proofNote: 'Delivered to farmer and OTP verified',
      },
      deliveryPartnerActor,
      'req-delivery-complete-1',
    );

    expect(result.status).toBe(ProductOrderStatus.DELIVERED);
    expect(result.deliveryAssignment?.status).toBe(ProductDeliveryAssignmentStatus.DELIVERED);
    expect(tx.productDeliveryAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: deliveryAssignmentId },
        data: expect.objectContaining({
          status: ProductDeliveryAssignmentStatus.DELIVERED,
          completedByUserId: deliveryPartnerUserId,
          completedByRole: PlatformRole.DELIVERY_PARTNER,
          deliveryProofNote: 'Delivered to farmer and OTP verified',
          otpVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.productOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: ProductOrderStatus.OUT_FOR_DELIVERY,
          toStatus: ProductOrderStatus.DELIVERED,
          actorUserId: deliveryPartnerUserId,
          requestId: 'req-delivery-complete-1',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_DELIVERY_DELIVERED',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: deliveryAssignmentId,
      }),
      tx,
    );
  });

  it('increments delivery OTP attempts and rejects invalid OTP completion', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const invoice = productInvoiceFixture();
    const dispatch = productDispatchFixture();
    const assignment = productDeliveryAssignmentFixture(
      ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY,
      { otpCode: '123456' },
    );
    const failedAssignment = {
      ...assignment,
      otpAttemptCount: assignment.otpAttemptCount + 1,
      updatedAt: new Date('2026-08-03T00:20:00.000Z'),
    };
    const tx = {
      productDeliveryAssignment: {
        update: jest.fn().mockResolvedValue(failedAssignment),
      },
      productOrder: {
        findFirst: jest.fn().mockResolvedValue(
          orderDetailFixture(ProductOrderStatus.OUT_FOR_DELIVERY, {
            invoice,
            dispatch,
            deliveryAssignment: assignment,
          }),
        ),
        update: jest.fn(),
      },
      productOrderStatusHistory: {
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      productDeliveryAssignment: {
        update: jest.fn().mockResolvedValue(failedAssignment),
      },
    };
    const service = new CheckoutService(
      prisma as never,
      auditService as never,
      accessService as never,
      financeService as never,
    );

    await expect(
      service.completeFulfilmentOrderDelivery(
        orderId,
        { otpCode: '000000' },
        deliveryPartnerActor,
        'req-delivery-otp-failed-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The failed-attempt increment and audit record are written via `prisma`
    // directly, not `tx` — the enclosing transaction aborts right after this
    // throws, which would otherwise roll back the very record being written.
    expect(prisma.productDeliveryAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: deliveryAssignmentId },
        data: {
          otpAttemptCount: {
            increment: 1,
          },
        },
      }),
    );
    expect(tx.productOrder.update).not.toHaveBeenCalled();
    expect(tx.productOrderStatusHistory.create).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PRODUCT_DELIVERY_OTP_FAILED',
        resourceType: 'ProductDeliveryAssignment',
        resourceId: deliveryAssignmentId,
        organisationId: distributorOrganisationId,
      }),
    );
  });

  it('requires a rejection reason for fulfilment order rejection', async () => {
    const service = new CheckoutService(
      {} as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(
      service.rejectFulfilmentOrder(orderId, {}, distributorActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks distributor fulfilment access outside the active seller organisation', async () => {
    const prisma = {
      productOrder: {
        findFirst: jest.fn().mockResolvedValue(orderDetailFixture(ProductOrderStatus.CONFIRMED)),
      },
      organisation: {
        findUnique: jest.fn(),
      },
    };
    const service = new CheckoutService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
      financeService as never,
    );

    await expect(service.getFulfilmentOrder(orderId, otherDistributorActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
  });
});

function farmerProfileFixture() {
  return {
    id: farmerProfileId,
    userId: farmerUserId,
    fullName: 'Phase 3B Farmer',
    alternatePhone: null,
    preferredLocale: 'hi-IN',
    village: 'Rampura',
    district: 'Jaipur',
    state: 'Rajasthan',
    primaryPincode: '302001',
    cropInterests: ['Bajra'],
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function farmerAddressFixture() {
  return {
    id: farmerAddressId,
    farmerProfileId,
    label: 'Home',
    recipientName: 'Phase 3B Farmer',
    phone: '+919999999999',
    addressLine1: 'Khasra 42, Rampura Road',
    addressLine2: null,
    village: 'Rampura',
    city: 'Jaipur',
    district: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    landmark: null,
    isDefault: true,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function activeDistributorOrganisationFixture() {
  return {
    id: distributorOrganisationId,
    type: OrganisationType.DISTRIBUTOR,
    slug: 'phase-4a-distributor',
    legalName: 'Phase 4A Distributor Private Limited',
    displayName: 'Phase 4A Distributor',
    gstin: '08ABCDE1234F1Z5',
    status: OrganisationStatus.ACTIVE,
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function activeDeliveryPartnerOrganisationFixture() {
  return {
    id: deliveryPartnerOrganisationId,
    type: OrganisationType.SERVICE_PROVIDER,
    slug: 'phase4e-delivery-partner',
    legalName: 'Phase 4E Delivery Partner',
    displayName: 'Phase 4E Delivery Partner',
    gstin: null,
    status: OrganisationStatus.ACTIVE,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function activeDeliveryPartnerUserFixture() {
  return {
    id: deliveryPartnerUserId,
    email: null,
    phone: '+919876543210',
    passwordHash: null,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    memberships: [
      {
        id: '00000000-0000-4000-8000-000000004211',
        userId: deliveryPartnerUserId,
        organisationId: deliveryPartnerOrganisationId,
        role: PlatformRole.DELIVERY_PARTNER,
        status: MembershipStatus.ACTIVE,
        organisation: activeDeliveryPartnerOrganisationFixture(),
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ],
  };
}

function cartFixture() {
  return {
    id: cartId,
    farmerProfileId,
    deliveryAddressId: farmerAddressId,
    deliveryAddress: farmerAddressFixture(),
    serviceablePincode: '302001',
    status: CartStatus.ACTIVE,
    items: [cartItemFixture()],
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function clearedCartFixture() {
  return {
    ...cartFixture(),
    deliveryAddressId: null,
    deliveryAddress: null,
    serviceablePincode: null,
    items: [],
  };
}

function cartItemFixture() {
  return {
    id: cartItemId,
    cartId,
    offerId,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    batchId,
    quantity: 2,
    priceSnapshotPaise: 120000,
    availableQuantitySnapshot: 4,
    serviceablePincodeSnapshot: '302001',
    productNameSnapshot: 'Hybrid Bajra Seed',
    variantNameSnapshot: '1 kg pack',
    sellerNameSnapshot: 'Phase 3B Distributor',
    warehouseNameSnapshot: 'Jaipur Warehouse',
    fulfilmentModeSnapshot: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDaysSnapshot: 3,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function offerFixture() {
  return {
    id: offerId,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    batchId,
    offerCode: 'PHASE3B-OFFER',
    sellingPricePaise: 118000,
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 6,
    serviceablePincodes: ['302001'],
    fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDays: 3,
    status: DistributorOfferStatus.APPROVED,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    distributorOrganisation: {
      id: distributorOrganisationId,
      type: OrganisationType.DISTRIBUTOR,
      slug: 'phase3b-distributor',
      legalName: 'Phase 3B Distributor Private Limited',
      displayName: 'Phase 3B Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    product: {
      id: productId,
      companyOrganisationId: '00000000-0000-4000-8000-000000004202',
      brandId: '00000000-0000-4000-8000-000000004203',
      name: 'Hybrid Bajra Seed',
      slug: 'hybrid-bajra-seed',
      category: 'Seeds',
      description: null,
      cropTargets: ['Bajra'],
      status: CatalogueStatus.APPROVED,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      brand: {
        id: '00000000-0000-4000-8000-000000004203',
        companyOrganisationId: '00000000-0000-4000-8000-000000004202',
        name: 'Phase 3B Seeds',
        slug: 'phase3b-seeds',
        description: null,
        website: null,
        status: CatalogueStatus.APPROVED,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewReason: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      companyOrganisation: {
        id: '00000000-0000-4000-8000-000000004202',
        type: OrganisationType.COMPANY,
        slug: 'phase3b-company',
        legalName: 'Phase 3B Seeds Private Limited',
        displayName: 'Phase 3B Seeds',
        gstin: null,
        status: OrganisationStatus.ACTIVE,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewReason: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    },
    variant: {
      id: variantId,
      productId,
      sku: 'P3B-1KG',
      variantName: '1 kg pack',
      packSize: '1',
      packUnit: 'kg',
      mrpPaise: 125000,
      isActive: true,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    warehouse: {
      id: warehouseId,
      distributorOrganisationId,
      code: 'P3B-JPR-01',
      name: 'Jaipur Warehouse',
      addressLine1: 'Plot 12, Agri Market Road',
      addressLine2: null,
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      contactName: null,
      contactPhone: null,
      status: WarehouseStatus.ACTIVE,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    batch: batchFixture(4),
  };
}

function batchFixture(balanceAfter: number) {
  return {
    id: batchId,
    distributorOrganisationId,
    warehouseId,
    productId,
    variantId,
    batchNumber: 'P3B-BATCH',
    manufacturingDate: null,
    expiryDate: new Date('2027-08-03T00:00:00.000Z'),
    germinationPercentage: null,
    status: InventoryBatchStatus.ACTIVE,
    blockedReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    inventoryMovements: [inventoryMovementFixture(balanceAfter)],
  };
}

function productCheckoutFixture(
  status: ProductCheckoutStatus = ProductCheckoutStatus.PENDING_PAYMENT,
) {
  return {
    id: checkoutId,
    farmerProfileId,
    sourceCartId: cartId,
    deliveryAddressId: farmerAddressId,
    serviceablePincode: '302001',
    status,
    subtotalPaise: 236000,
    itemCount: 1,
    childOrderCount: 1,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productOrderFixture(status: ProductOrderStatus) {
  return {
    id: orderId,
    checkoutId,
    orderType: OrderType.PRODUCT_ORDER,
    farmerProfileId,
    deliveryAddressId: farmerAddressId,
    sellerOrganisationId: distributorOrganisationId,
    orderNumber: 'PO-20260803-TEST0001',
    status,
    serviceablePincode: '302001',
    sellerNameSnapshot: 'Phase 3B Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    deliveryAddressSnapshot: {
      pincode: '302001',
    },
    subtotalPaise: 236000,
    itemCount: 1,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productOrderItemFixture() {
  return {
    id: orderItemId,
    productOrderId: orderId,
    sourceCartItemId: cartItemId,
    offerId,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    quantity: 2,
    unitPricePaise: 118000,
    lineTotalPaise: 236000,
    productNameSnapshot: 'Hybrid Bajra Seed',
    variantNameSnapshot: '1 kg pack',
    sellerNameSnapshot: 'Phase 3B Distributor',
    warehouseNameSnapshot: 'Jaipur Warehouse',
    fulfilmentModeSnapshot: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDaysSnapshot: 3,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function inventoryMovementFixture(balanceAfter: number) {
  return {
    id: movementId,
    distributorOrganisationId,
    warehouseId,
    batchId,
    productId,
    variantId,
    movementType:
      balanceAfter === 4
        ? InventoryMovementType.OPENING_STOCK
        : InventoryMovementType.RESERVED_FOR_ORDER,
    quantityDelta: balanceAfter === 4 ? 4 : -2,
    balanceAfter,
    reason: 'Reserved during checkout',
    referenceType: balanceAfter === 4 ? null : 'ProductOrder',
    referenceId: balanceAfter === 4 ? null : orderId,
    createdByUserId: farmerUserId,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function releaseMovementFixture(balanceAfter: number) {
  return {
    ...inventoryMovementFixture(balanceAfter),
    id: releaseMovementId,
    movementType: InventoryMovementType.RELEASED_FROM_ORDER,
    quantityDelta: 2,
    balanceAfter,
    reason: 'Farmer cancelled after failed mock payment',
    referenceType: 'ProductOrderCancellation',
    referenceId: orderId,
  };
}

function productOrderItemReservationFixture() {
  return {
    id: reservationId,
    productOrderItemId: orderItemId,
    batchId,
    inventoryMovementId: movementId,
    quantity: 2,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productInvoiceFixture() {
  return {
    id: invoiceId,
    productOrderId: orderId,
    checkoutId,
    farmerProfileId,
    sellerOrganisationId: distributorOrganisationId,
    invoiceNumber: 'INV-20260803-TEST0001',
    status: ProductInvoiceStatus.GENERATED,
    currency: 'INR',
    subtotalPaise: 236000,
    taxPaise: 0,
    totalPaise: 236000,
    itemCount: 1,
    sellerLegalNameSnapshot: 'Phase 4A Distributor Private Limited',
    sellerDisplayNameSnapshot: 'Phase 4A Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    farmerNameSnapshot: 'Phase 3B Farmer',
    deliveryAddressSnapshot: {
      pincode: '302001',
    },
    lineItemsSnapshot: [
      {
        productOrderItemId: orderItemId,
        productNameSnapshot: 'Hybrid Bajra Seed',
        variantNameSnapshot: '1 kg pack',
        quantity: 2,
        unitPricePaise: 118000,
        lineTotalPaise: 236000,
      },
    ],
    generatedByUserId: '00000000-0000-4000-8000-000000004203',
    generatedByRole: PlatformRole.DISTRIBUTOR_OWNER,
    generatedAt: new Date('2026-08-03T00:00:00.000Z'),
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productDispatchFixture() {
  return {
    id: dispatchId,
    productOrderId: orderId,
    checkoutId,
    invoiceId,
    farmerProfileId,
    sellerOrganisationId: distributorOrganisationId,
    dispatchNumber: 'DSP-20260803-TEST0001',
    status: ProductDispatchStatus.READY_FOR_PICKUP,
    serviceablePincode: '302001',
    invoiceNumberSnapshot: 'INV-20260803-TEST0001',
    sellerNameSnapshot: 'Phase 3B Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    deliveryAddressSnapshot: {
      pincode: '302001',
    },
    warehouseSnapshot: [
      {
        warehouseId,
        warehouseNameSnapshot: 'Jaipur Warehouse',
        itemCount: 1,
        totalQuantity: 2,
      },
    ],
    itemsSnapshot: [
      {
        productOrderItemId: orderItemId,
        offerId,
        productId,
        variantId,
        warehouseId,
        productNameSnapshot: 'Hybrid Bajra Seed',
        variantNameSnapshot: '1 kg pack',
        warehouseNameSnapshot: 'Jaipur Warehouse',
        quantity: 2,
      },
    ],
    readyForPickupReason: 'Packages ready at warehouse',
    readyByUserId: '00000000-0000-4000-8000-000000004203',
    readyByRole: PlatformRole.DISTRIBUTOR_OWNER,
    readyAt: new Date('2026-08-03T00:00:00.000Z'),
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function productDeliveryAssignmentFixture(
  status: ProductDeliveryAssignmentStatus = ProductDeliveryAssignmentStatus.ASSIGNED,
  input: {
    otpCode?: string;
    otpAttemptCount?: number;
    deliveryProofNote?: string | null;
  } = {},
) {
  const otpSalt = 'phase4e-test-salt';
  const startedAt =
    status === ProductDeliveryAssignmentStatus.OUT_FOR_DELIVERY ||
    status === ProductDeliveryAssignmentStatus.DELIVERED
      ? new Date('2026-08-03T00:10:00.000Z')
      : null;
  const completedAt =
    status === ProductDeliveryAssignmentStatus.DELIVERED
      ? new Date('2026-08-03T00:20:00.000Z')
      : null;

  return {
    id: deliveryAssignmentId,
    productOrderId: orderId,
    checkoutId,
    dispatchId,
    farmerProfileId,
    sellerOrganisationId: distributorOrganisationId,
    deliveryPartnerUserId,
    assignmentNumber: 'DLV-20260803-TEST0001',
    status,
    serviceablePincode: '302001',
    dispatchNumberSnapshot: 'DSP-20260803-TEST0001',
    invoiceNumberSnapshot: 'INV-20260803-TEST0001',
    sellerNameSnapshot: 'Phase 3B Distributor',
    sellerGstinSnapshot: '08ABCDE1234F1Z5',
    deliveryAddressSnapshot: {
      pincode: '302001',
    },
    pickupSnapshot: productDispatchFixture().warehouseSnapshot,
    itemsSnapshot: productDispatchFixture().itemsSnapshot,
    otpHash: deliveryOtpHash(input.otpCode ?? '123456', otpSalt),
    otpSalt,
    otpExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    otpAttemptCount: input.otpAttemptCount ?? 0,
    otpVerifiedAt: completedAt,
    assignedByUserId: '00000000-0000-4000-8000-000000004206',
    assignedByRole: PlatformRole.OPERATIONS_MANAGER,
    assignedAt: new Date('2026-08-03T00:05:00.000Z'),
    startedByUserId: startedAt ? deliveryPartnerUserId : null,
    startedByRole: startedAt ? PlatformRole.DELIVERY_PARTNER : null,
    startedAt,
    completedByUserId: completedAt ? deliveryPartnerUserId : null,
    completedByRole: completedAt ? PlatformRole.DELIVERY_PARTNER : null,
    completedAt,
    deliveryProofNote: input.deliveryProofNote ?? null,
    createdAt: new Date('2026-08-03T00:05:00.000Z'),
    updatedAt: completedAt ?? startedAt ?? new Date('2026-08-03T00:05:00.000Z'),
  };
}

function orderDetailFixture(
  status: ProductOrderStatus = ProductOrderStatus.INVENTORY_RESERVED,
  input: {
    invoice?: ReturnType<typeof productInvoiceFixture> | null;
    dispatch?: ReturnType<typeof productDispatchFixture> | null;
    deliveryAssignment?: ReturnType<typeof productDeliveryAssignmentFixture> | null;
  } = {},
) {
  return {
    ...productOrderFixture(status),
    invoice: input.invoice ?? null,
    dispatch: input.dispatch ?? null,
    deliveryAssignment: input.deliveryAssignment ?? null,
    items: [
      {
        ...productOrderItemFixture(),
        reservations: [
          {
            ...productOrderItemReservationFixture(),
            batch: batchFixture(2),
            inventoryMovement: inventoryMovementFixture(2),
          },
        ],
      },
    ],
    statusHistory: [
      {
        id: '00000000-0000-4000-8000-000000004904',
        productOrderId: orderId,
        fromStatus: null,
        toStatus: ProductOrderStatus.PENDING_PAYMENT,
        actorUserId: farmerUserId,
        actorRole: PlatformRole.FARMER,
        reason: 'Product order created from farmer cart',
        requestId: 'req-checkout-1',
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
      {
        id: '00000000-0000-4000-8000-000000004905',
        productOrderId: orderId,
        fromStatus: ProductOrderStatus.PENDING_PAYMENT,
        toStatus: ProductOrderStatus.INVENTORY_RESERVED,
        actorUserId: farmerUserId,
        actorRole: PlatformRole.FARMER,
        reason: 'Inventory reserved for child order',
        requestId: 'req-checkout-1',
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ],
  };
}

function checkoutDetailFixture(
  input: {
    checkoutStatus?: ProductCheckoutStatus;
    orderStatus?: ProductOrderStatus;
  } = {},
) {
  return {
    ...productCheckoutFixture(input.checkoutStatus),
    deliveryAddress: farmerAddressFixture(),
    orders: [orderDetailFixture(input.orderStatus)],
  };
}
