import { BadRequestException } from '@nestjs/common';
import {
  CartStatus,
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryBatchStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  WarehouseStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { CartService } from '../src/cart/cart.service';

const farmerUserId = '00000000-0000-4000-8000-000000003101';
const farmerOrganisationId = '00000000-0000-4000-8000-000000003102';
const distributorOrganisationId = '00000000-0000-4000-8000-000000003201';
const productId = '00000000-0000-4000-8000-000000003301';
const variantId = '00000000-0000-4000-8000-000000003302';
const warehouseId = '00000000-0000-4000-8000-000000003401';
const offerId = '00000000-0000-4000-8000-000000003501';

const accessService = {
  hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
    actor.permissions.includes(permission),
  ),
};

describe('CartService', () => {
  const farmerActor: CurrentUser = {
    userId: farmerUserId,
    role: PlatformRole.FARMER,
    membershipId: '00000000-0000-4000-8000-000000003103',
    organisationId: farmerOrganisationId,
    permissions: [PermissionCode.CART_READ_OWN, PermissionCode.CART_WRITE_OWN],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds an approved serviceable offer to the cart with backend-derived snapshots', async () => {
    const profile = farmerProfileFixture();
    const address = farmerAddressFixture();
    const emptyCart = cartFixture({ items: [], serviceablePincode: null });
    const savedItem = cartItemFixture({ quantity: 2, availableQuantitySnapshot: 12 });
    const updatedCart = cartFixture({
      items: [savedItem],
      deliveryAddress: address,
      deliveryAddressId: address.id,
      serviceablePincode: '302001',
    });
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      cart: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(updatedCart),
      },
      cartItem: {
        upsert: jest.fn().mockResolvedValue(savedItem),
      },
    };
    const prisma = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue(emptyCart),
      },
      farmerAddress: {
        findFirst: jest.fn().mockResolvedValue(address),
      },
      distributorOffer: {
        findUnique: jest.fn().mockResolvedValue(offerFixture(DistributorOfferStatus.APPROVED)),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 12 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new CartService(prisma as never, auditService as never, accessService as never);

    const result = await service.addItem(
      {
        offerId,
        quantity: 2,
        farmerAddressId: address.id,
        reason: 'Selected from product detail',
      },
      farmerActor,
      'req-cart-add',
    );

    expect(result.itemCount).toBe(1);
    expect(result.subtotalPaise).toBe(240000);
    expect(result.serviceablePincode).toBe('302001');
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        minimumOrderQuantity: 1,
        maximumOrderQuantity: 20,
      }),
    );
    expect(tx.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          cartId: emptyCart.id,
          offerId,
          priceSnapshotPaise: 120000,
          availableQuantitySnapshot: 12,
          serviceablePincodeSnapshot: '302001',
          productNameSnapshot: 'Hybrid Bajra Seed',
          sellerNameSnapshot: 'Jaipur Krishi Distributor',
        }),
      }),
    );
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: InventoryBatchStatus.ACTIVE,
          OR: expect.arrayContaining([
            { expiryDate: null },
            expect.objectContaining({
              expiryDate: expect.objectContaining({
                gte: expect.any(Date),
              }),
            }),
          ]),
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CART_ITEM_ADDED',
        resourceType: 'CartItem',
        resourceId: savedItem.id,
        requestId: 'req-cart-add',
      }),
      tx,
    );
  });

  it('rejects paused offers before cart item creation', async () => {
    const { prisma, service } = createServiceForRejectedOffer(
      offerFixture(DistributorOfferStatus.PAUSED),
    );

    await expect(
      service.addItem(
        {
          offerId,
          quantity: 1,
          serviceablePincode: '302001',
        },
        farmerActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.inventoryBatch.findMany).not.toHaveBeenCalled();
  });

  it('rejects quantity above backend-derived sellable availability', async () => {
    const { prisma, service } = createServiceForRejectedOffer(
      offerFixture(DistributorOfferStatus.APPROVED),
    );
    prisma.inventoryBatch.findMany.mockResolvedValue([batchFixture({ balanceAfter: 1 })]);

    await expect(
      service.addItem(
        {
          offerId,
          quantity: 2,
          serviceablePincode: '302001',
        },
        farmerActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires clearing the cart before changing pincode with existing items', async () => {
    const existingCart = cartFixture({
      serviceablePincode: '302001',
      items: [cartItemFixture({ quantity: 1, availableQuantitySnapshot: 12 })],
    });
    const prisma = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue(existingCart),
      },
      distributorOffer: {
        findUnique: jest.fn(),
      },
    };
    const service = new CartService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.addItem(
        {
          offerId,
          quantity: 1,
          serviceablePincode: '305001',
        },
        farmerActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.distributorOffer.findUnique).not.toHaveBeenCalled();
  });
});

function createServiceForRejectedOffer(offer: ReturnType<typeof offerFixture>): {
  prisma: {
    farmerProfile: { findUnique: jest.Mock };
    cart: { findUnique: jest.Mock };
    distributorOffer: { findUnique: jest.Mock };
    inventoryBatch: { findMany: jest.Mock };
  };
  service: CartService;
} {
  const prisma = {
    farmerProfile: {
      findUnique: jest.fn().mockResolvedValue(farmerProfileFixture()),
    },
    cart: {
      findUnique: jest.fn().mockResolvedValue(
        cartFixture({
          items: [],
          serviceablePincode: null,
        }),
      ),
    },
    distributorOffer: {
      findUnique: jest.fn().mockResolvedValue(offer),
    },
    inventoryBatch: {
      findMany: jest.fn(),
    },
  };

  return {
    prisma,
    service: new CartService(
      prisma as never,
      { record: jest.fn() } as never,
      accessService as never,
    ),
  };
}

function farmerProfileFixture() {
  return {
    id: 'farmer-profile-1',
    userId: farmerUserId,
    fullName: 'Ramesh Sharma',
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
    id: 'farmer-address-1',
    farmerProfileId: 'farmer-profile-1',
    label: 'Home',
    recipientName: 'Ramesh Sharma',
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

function cartFixture(input: {
  items: ReturnType<typeof cartItemFixture>[];
  serviceablePincode: string | null;
  deliveryAddress?: ReturnType<typeof farmerAddressFixture> | null;
  deliveryAddressId?: string | null;
}) {
  return {
    id: 'cart-1',
    farmerProfileId: 'farmer-profile-1',
    deliveryAddressId: input.deliveryAddressId ?? null,
    deliveryAddress: input.deliveryAddress ?? null,
    serviceablePincode: input.serviceablePincode,
    status: CartStatus.ACTIVE,
    items: input.items,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function cartItemFixture(input: { quantity: number; availableQuantitySnapshot: number }) {
  return {
    id: 'cart-item-1',
    cartId: 'cart-1',
    offerId,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    batchId: null,
    quantity: input.quantity,
    priceSnapshotPaise: 120000,
    availableQuantitySnapshot: input.availableQuantitySnapshot,
    serviceablePincodeSnapshot: '302001',
    productNameSnapshot: 'Hybrid Bajra Seed',
    variantNameSnapshot: '1 kg pack',
    sellerNameSnapshot: 'Jaipur Krishi Distributor',
    warehouseNameSnapshot: 'Jaipur Main Warehouse',
    fulfilmentModeSnapshot: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDaysSnapshot: 3,
    offer: {
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 20,
    },
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function offerFixture(status: DistributorOfferStatus) {
  return {
    id: offerId,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    batchId: null,
    offerCode: 'OFFER-001',
    sellingPricePaise: 120000,
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 20,
    serviceablePincodes: ['302001'],
    fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDays: 3,
    status,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    distributorOrganisation: {
      id: distributorOrganisationId,
      type: OrganisationType.DISTRIBUTOR,
      slug: 'jaipur-krishi-distributor',
      legalName: 'Jaipur Krishi Distributor Private Limited',
      displayName: 'Jaipur Krishi Distributor',
      gstin: '08ABCDE1234F1Z5',
      status: OrganisationStatus.ACTIVE,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
    product: productFixture(),
    variant: variantFixture(),
    warehouse: warehouseFixture(),
    batch: null,
  };
}

function productFixture() {
  return {
    id: productId,
    companyOrganisationId: 'company-1',
    brandId: 'brand-1',
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
      id: 'brand-1',
      companyOrganisationId: 'company-1',
      name: 'Demo Seeds',
      slug: 'demo-seeds',
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
      id: 'company-1',
      type: OrganisationType.COMPANY,
      slug: 'demo-seeds-company',
      legalName: 'Demo Seeds Private Limited',
      displayName: 'Demo Seeds',
      gstin: '08ABCDE1234F1Z6',
      status: OrganisationStatus.ACTIVE,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    },
  };
}

function variantFixture() {
  return {
    id: variantId,
    productId,
    sku: 'BAJRA-1KG',
    variantName: '1 kg pack',
    packSize: new Prisma.Decimal(1),
    packUnit: 'kg',
    mrpPaise: 125000,
    isActive: true,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function warehouseFixture() {
  return {
    id: warehouseId,
    distributorOrganisationId,
    code: 'JPR-01',
    name: 'Jaipur Main Warehouse',
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
  };
}

function batchFixture({ balanceAfter }: { balanceAfter: number }) {
  return {
    id: 'batch-1',
    distributorOrganisationId,
    warehouseId,
    productId,
    variantId,
    batchNumber: 'BATCH-2026-08',
    manufacturingDate: null,
    expiryDate: new Date('2027-08-03T00:00:00.000Z'),
    germinationPercentage: new Prisma.Decimal(92.5),
    status: InventoryBatchStatus.ACTIVE,
    blockedReason: null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    inventoryMovements: [
      {
        id: 'movement-1',
        distributorOrganisationId,
        warehouseId,
        batchId: 'batch-1',
        productId,
        variantId,
        movementType: 'OPENING_STOCK',
        quantityDelta: balanceAfter,
        balanceAfter,
        reason: 'Opening stock count',
        referenceType: null,
        referenceId: null,
        createdByUserId: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ],
  };
}
