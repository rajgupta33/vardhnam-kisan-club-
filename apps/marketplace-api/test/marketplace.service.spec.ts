import { NotFoundException } from '@nestjs/common';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  FulfilmentMode,
  InventoryBatchStatus,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  WarehouseStatus,
} from '@prisma/client';
import { MarketplaceService } from '../src/marketplace/marketplace.service';

const productId = 'product-1';
const variantId = 'variant-1';
const distributorOrganisationId = 'distributor-1';
const warehouseId = 'warehouse-1';

describe('MarketplaceService', () => {
  it('lists public marketplace products from approved offers with backend-derived availability', async () => {
    const { prisma, service } = createService();
    prisma.distributorOffer.findMany.mockResolvedValue([
      offerFixture({ id: 'offer-1', sellingPricePaise: 120000 }),
      offerFixture({ id: 'offer-2', sellingPricePaise: 118000 }),
    ]);
    prisma.inventoryBatch.findMany
      .mockResolvedValueOnce([batchFixture({ balanceAfter: 30 })])
      .mockResolvedValueOnce([batchFixture({ balanceAfter: 7 })]);

    const result = await service.listProducts({
      pincode: '302001',
      category: 'Seeds',
      q: 'bajra',
      page: 1,
      limit: 20,
    });

    expect(prisma.distributorOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: DistributorOfferStatus.APPROVED,
          serviceablePincodes: { has: '302001' },
          product: expect.objectContaining({
            status: CatalogueStatus.APPROVED,
            category: { equals: 'Seeds', mode: 'insensitive' },
          }),
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: productId,
        serviceablePincode: '302001',
        lowestPricePaise: 118000,
        availableQuantity: 37,
        offerCount: 2,
        sellerCount: 1,
        fulfilmentModes: [FulfilmentMode.DISTRIBUTOR_FULFILLED],
      }),
    );
    expect(result.items[0]?.offers[0]).toEqual(
      expect.objectContaining({
        seller: expect.objectContaining({
          organisationId: distributorOrganisationId,
          legalName: 'Jaipur Krishi Distributor Private Limited',
          gstin: '08ABCDE1234F1Z5',
        }),
        warehouse: expect.objectContaining({
          pincode: '302001',
        }),
        availableQuantity: 30,
      }),
    );
  });

  it('filters approved offers when inventory-derived availability is zero', async () => {
    const { prisma, service } = createService();
    prisma.distributorOffer.findMany.mockResolvedValue([offerFixture({ id: 'offer-1' })]);
    prisma.inventoryBatch.findMany.mockResolvedValue([batchFixture({ balanceAfter: 0 })]);

    const result = await service.listProducts({
      pincode: '302001',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
    });
  });

  it('excludes offers when only blocked or expired stock would otherwise exist', async () => {
    const { prisma, service } = createService();
    prisma.distributorOffer.findMany.mockResolvedValue([offerFixture({ id: 'offer-1' })]);
    prisma.inventoryBatch.findMany.mockImplementation(
      (args: { where: Record<string, unknown> }) => {
        expect(args.where).toEqual(
          expect.objectContaining({
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
        );
        return Promise.resolve([]);
      },
    );

    const result = await service.listProducts({
      pincode: '302001',
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('returns marketplace product detail without private product document storage fields', async () => {
    const { prisma, service } = createService();
    prisma.distributorOffer.findMany.mockResolvedValue([offerFixture({ id: 'offer-1' })]);
    prisma.inventoryBatch.findMany.mockResolvedValue([batchFixture({ balanceAfter: 14 })]);

    const result = await service.getProduct(productId, {
      pincode: '302001',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: productId,
        description: 'Rainfed bajra seed for Rajasthan farms.',
        availableQuantity: 14,
        variants: [
          expect.objectContaining({
            id: variantId,
            packSize: '1',
            mrpPaise: 125000,
          }),
        ],
        documents: [
          {
            id: 'document-1',
            documentType: 'LABEL',
            title: 'Approved product label',
            documentNumber: 'LBL-2026-01',
            issuedAt: new Date('2026-07-01T00:00:00.000Z'),
            expiresAt: null,
          },
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(JSON.stringify(result)).not.toContain('fileName');
  });

  it('throws not found when no eligible offer is serviceable for the pincode', async () => {
    const { prisma, service } = createService();
    prisma.distributorOffer.findMany.mockResolvedValue([]);

    await expect(
      service.getProduct(productId, {
        pincode: '400001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createService(): {
  prisma: {
    distributorOffer: { findMany: jest.Mock };
    inventoryBatch: { findMany: jest.Mock };
  };
  service: MarketplaceService;
} {
  const prisma = {
    distributorOffer: {
      findMany: jest.fn(),
    },
    inventoryBatch: {
      findMany: jest.fn(),
    },
  };

  return {
    prisma,
    service: new MarketplaceService(prisma as never),
  };
}

function offerFixture({
  id,
  sellingPricePaise = 120000,
}: {
  id: string;
  sellingPricePaise?: number;
}) {
  return {
    id,
    distributorOrganisationId,
    productId,
    variantId,
    warehouseId,
    batchId: null,
    offerCode: id,
    sellingPricePaise,
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 20,
    serviceablePincodes: ['302001', '302002'],
    fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
    deliverySlaDays: 3,
    status: DistributorOfferStatus.APPROVED,
    reviewedAt: new Date('2026-08-03T00:00:00.000Z'),
    reviewedByUserId: null,
    reviewReason: 'Approved for marketplace discovery',
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
    description: 'Rainfed bajra seed for Rajasthan farms.',
    cropTargets: ['Bajra'],
    status: CatalogueStatus.APPROVED,
    reviewedAt: new Date('2026-08-03T00:00:00.000Z'),
    reviewedByUserId: null,
    reviewReason: 'Approved master product',
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
      reviewedAt: new Date('2026-08-03T00:00:00.000Z'),
      reviewedByUserId: null,
      reviewReason: 'Approved brand',
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
    variants: [variantFixture()],
    documents: [
      {
        id: 'document-1',
        productId,
        documentType: 'LABEL',
        title: 'Approved product label',
        documentNumber: 'LBL-2026-01',
        fileName: 'label.pdf',
        storageKey: 'private/product-documents/label.pdf',
        issuedAt: new Date('2026-07-01T00:00:00.000Z'),
        expiresAt: null,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
        updatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ],
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
