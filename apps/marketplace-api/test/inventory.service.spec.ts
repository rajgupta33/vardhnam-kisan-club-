import { BadRequestException } from '@nestjs/common';
import {
  CatalogueStatus,
  InventoryBatchStatus,
  InventoryMovementType,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  WarehouseStatus,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { InventoryService } from '../src/inventory/inventory.service';

const distributorOrganisationId = '00000000-0000-4000-8000-000000000300';
const companyOrganisationId = '00000000-0000-4000-8000-000000000400';
const activeDistributorOrganisation = {
  id: distributorOrganisationId,
  type: OrganisationType.DISTRIBUTOR,
  status: OrganisationStatus.ACTIVE,
};

describe('InventoryService', () => {
  const distributorActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000301',
    role: PlatformRole.DISTRIBUTOR_OWNER,
    membershipId: '00000000-0000-4000-8000-000000000302',
    organisationId: distributorOrganisationId,
    permissions: [
      PermissionCode.WAREHOUSES_READ_OWN,
      PermissionCode.WAREHOUSES_WRITE_OWN,
      PermissionCode.INVENTORY_READ_OWN,
      PermissionCode.INVENTORY_WRITE_OWN,
      PermissionCode.INVENTORY_ADJUST_OWN,
    ],
  };

  const accessService = {
    hasPermission: jest.fn((actor: CurrentUser, permission: PermissionCode) =>
      actor.permissions.includes(permission),
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a distributor warehouse and records audit', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const warehouse = warehouseFixture();
    const tx = {
      warehouse: {
        create: jest.fn().mockResolvedValue(warehouse),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new InventoryService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createWarehouse(
      {
        code: warehouse.code,
        name: warehouse.name,
        addressLine1: warehouse.addressLine1,
        city: warehouse.city,
        state: warehouse.state,
        pincode: warehouse.pincode,
        reason: 'Initial warehouse setup',
      },
      distributorActor,
      'req-warehouse',
    );

    expect(result.id).toBe(warehouse.id);
    expect(tx.warehouse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributorOrganisationId,
          code: 'JPR-01',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WAREHOUSE_CREATED',
        resourceType: 'Warehouse',
        resourceId: warehouse.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-warehouse',
      }),
      tx,
    );
  });

  it('blocks batch creation when the product variant is not approved for catalogue use', async () => {
    const warehouse = warehouseFixture();
    const variant = variantFixture(CatalogueStatus.DRAFT);
    const service = new InventoryService(
      {
        organisation: {
          findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
        },
        warehouse: {
          findUnique: jest.fn().mockResolvedValue(warehouse),
        },
        productVariant: {
          findUnique: jest.fn().mockResolvedValue(variant),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.createBatch(
        {
          warehouseId: warehouse.id,
          variantId: variant.id,
          batchNumber: 'BATCH-DRAFT',
          openingQuantity: 10,
          reason: 'Opening stock count',
        },
        distributorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a positive inventory adjustment as an append-only movement and audit entry', async () => {
    const batch = batchFixture();
    const movement = movementFixture({
      movementType: InventoryMovementType.STOCK_RECEIVED,
      quantityDelta: 25,
      balanceAfter: 75,
    });
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue(movementFixture({ balanceAfter: 50 })),
        create: jest.fn().mockResolvedValue(movement),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      inventoryBatch: {
        findUnique: jest.fn().mockResolvedValue(batch),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new InventoryService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createInventoryAdjustment(
      batch.id,
      {
        movementType: InventoryMovementType.STOCK_RECEIVED,
        quantity: 25,
        reason: 'Received stock after physical verification',
      },
      distributorActor,
      'req-adjust',
    );

    expect(result.balanceAfter).toBe(75);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: InventoryMovementType.STOCK_RECEIVED,
          quantityDelta: 25,
          balanceAfter: 75,
          reason: 'Received stock after physical verification',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVENTORY_MOVEMENT_RECORDED',
        resourceType: 'InventoryMovement',
        resourceId: movement.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-adjust',
      }),
      tx,
    );
  });

  it('rejects stock adjustments that would make a batch balance negative', async () => {
    const batch = batchFixture();
    const tx = {
      inventoryMovement: {
        findFirst: jest.fn().mockResolvedValue(movementFixture({ balanceAfter: 5 })),
        create: jest.fn(),
      },
    };
    const service = new InventoryService(
      {
        organisation: {
          findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
        },
        inventoryBatch: {
          findUnique: jest.fn().mockResolvedValue(batch),
        },
        $transaction: jest.fn((callback) => callback(tx)),
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.createInventoryAdjustment(
        batch.id,
        {
          movementType: InventoryMovementType.MANUAL_DECREASE,
          quantity: 10,
          reason: 'Physical stock shortage',
        },
        distributorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('reports low-stock inventory while excluding blocked and expired stock from sellable alerts', async () => {
    const lowStockBatch = reportBatchFixture({
      id: 'batch-low',
      batchNumber: 'LOW-001',
      balanceAfter: 4,
      expiryDate: futureDate(90),
    });
    const healthyBatch = reportBatchFixture({
      id: 'batch-healthy',
      batchNumber: 'HEALTHY-001',
      balanceAfter: 50,
      expiryDate: futureDate(90),
    });
    const blockedBatch = reportBatchFixture({
      id: 'batch-blocked',
      batchNumber: 'BLOCKED-001',
      balanceAfter: 2,
      expiryDate: futureDate(90),
      status: InventoryBatchStatus.BLOCKED,
    });
    const expiredBatch = reportBatchFixture({
      id: 'batch-expired',
      batchNumber: 'EXPIRED-001',
      balanceAfter: 2,
      expiryDate: new Date('2000-01-01T00:00:00.000Z'),
    });
    const service = new InventoryService(
      {
        inventoryBatch: {
          findMany: jest
            .fn()
            .mockResolvedValue([lowStockBatch, healthyBatch, blockedBatch, expiredBatch]),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    const result = await service.listLowStockInventory(
      {
        lowStockThreshold: 5,
        page: 1,
        limit: 20,
      },
      distributorActor,
    );

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        sellableQuantity: 4,
        isLowStock: true,
        ageingBucket: 'LOW_STOCK',
      }),
    );
    expect(result.items[0]?.batch.batchNumber).toBe('LOW-001');
  });

  it('reports batches expiring within the configured window', async () => {
    const expiringBatch = reportBatchFixture({
      id: 'batch-expiring',
      batchNumber: 'EXPIRING-001',
      balanceAfter: 12,
      expiryDate: futureDate(7),
    });
    const laterBatch = reportBatchFixture({
      id: 'batch-later',
      batchNumber: 'LATER-001',
      balanceAfter: 12,
      expiryDate: futureDate(40),
    });
    const service = new InventoryService(
      {
        inventoryBatch: {
          findMany: jest.fn().mockResolvedValue([expiringBatch, laterBatch]),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    const result = await service.listExpiringInventory(
      {
        expiringWithinDays: 10,
        page: 1,
        limit: 20,
      },
      distributorActor,
    );

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        isExpiringSoon: true,
        ageingBucket: 'EXPIRING_SOON',
      }),
    );
    expect(result.items[0]?.batch.batchNumber).toBe('EXPIRING-001');
  });
});

function warehouseFixture() {
  return {
    id: 'warehouse-1',
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
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    distributorOrganisation: activeDistributorOrganisation,
  };
}

function productFixture(status: CatalogueStatus) {
  return {
    id: 'product-1',
    companyOrganisationId,
    brandId: 'brand-1',
    name: 'Hybrid Bajra Seed',
    slug: 'hybrid-bajra-seed',
    category: 'Seeds',
    description: null,
    cropTargets: ['Bajra'],
    status,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewReason: null,
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    brand: {
      id: 'brand-1',
      companyOrganisationId,
      name: 'Demo Seeds',
      slug: 'demo-seeds',
      description: null,
      website: null,
      status: CatalogueStatus.APPROVED,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    },
    companyOrganisation: {
      id: companyOrganisationId,
      type: OrganisationType.COMPANY,
      status: OrganisationStatus.ACTIVE,
    },
  };
}

function variantFixture(productStatus: CatalogueStatus) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'BAJRA-1KG',
    variantName: '1 kg pack',
    packSize: new Prisma.Decimal(1),
    packUnit: 'kg',
    mrpPaise: 125000,
    isActive: true,
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    product: productFixture(productStatus),
  };
}

function batchFixture() {
  return {
    id: 'batch-1',
    distributorOrganisationId,
    warehouseId: 'warehouse-1',
    productId: 'product-1',
    variantId: 'variant-1',
    batchNumber: 'BATCH-2026-08',
    manufacturingDate: null,
    expiryDate: new Date('2027-08-02T00:00:00.000Z'),
    germinationPercentage: new Prisma.Decimal(92.5),
    status: InventoryBatchStatus.ACTIVE,
    blockedReason: null,
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    warehouse: warehouseFixture(),
    distributorOrganisation: activeDistributorOrganisation,
    product: productFixture(CatalogueStatus.APPROVED),
    variant: variantFixture(CatalogueStatus.APPROVED),
    inventoryMovements: [],
  };
}

function reportBatchFixture({
  id,
  batchNumber,
  balanceAfter,
  expiryDate,
  status = InventoryBatchStatus.ACTIVE,
}: {
  id: string;
  batchNumber: string;
  balanceAfter: number;
  expiryDate: Date;
  status?: InventoryBatchStatus;
}) {
  return {
    ...batchFixture(),
    id,
    batchNumber,
    expiryDate,
    status,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    inventoryMovements: [movementFixture({ balanceAfter })],
  };
}

function futureDate(daysFromToday: number): Date {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value;
}

function movementFixture({
  movementType = InventoryMovementType.OPENING_STOCK,
  quantityDelta = 50,
  balanceAfter = 50,
}: {
  movementType?: InventoryMovementType;
  quantityDelta?: number;
  balanceAfter?: number;
}) {
  return {
    id: 'movement-1',
    distributorOrganisationId,
    warehouseId: 'warehouse-1',
    batchId: 'batch-1',
    productId: 'product-1',
    variantId: 'variant-1',
    movementType,
    quantityDelta,
    balanceAfter,
    reason: 'Opening stock count',
    referenceType: null,
    referenceId: null,
    createdByUserId: '00000000-0000-4000-8000-000000000301',
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
  };
}
