import { BadRequestException } from '@nestjs/common';
import {
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
import { OfferReviewDecision } from '../src/offers/dto/review-offer.dto';
import { OffersService } from '../src/offers/offers.service';

const distributorOrganisationId = '00000000-0000-4000-8000-000000000500';
const companyOrganisationId = '00000000-0000-4000-8000-000000000600';
const reviewerOrganisationId = '00000000-0000-4000-8000-000000000700';
const activeDistributorOrganisation = {
  id: distributorOrganisationId,
  type: OrganisationType.DISTRIBUTOR,
  status: OrganisationStatus.ACTIVE,
};

describe('OffersService', () => {
  const distributorActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000501',
    role: PlatformRole.DISTRIBUTOR_OWNER,
    membershipId: '00000000-0000-4000-8000-000000000502',
    organisationId: distributorOrganisationId,
    permissions: [
      PermissionCode.OFFERS_READ_OWN,
      PermissionCode.OFFERS_WRITE_OWN,
      PermissionCode.OFFERS_SUBMIT_OWN,
    ],
  };

  const reviewerActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000701',
    role: PlatformRole.CATALOGUE_REVIEWER,
    membershipId: '00000000-0000-4000-8000-000000000702',
    organisationId: reviewerOrganisationId,
    permissions: [
      PermissionCode.OFFERS_READ_ANY,
      PermissionCode.OFFERS_QUEUE_READ,
      PermissionCode.OFFERS_REVIEW,
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

  it('creates a distributor offer with backend-derived availability and audit history', async () => {
    const warehouse = warehouseFixture();
    const variant = variantFixture(CatalogueStatus.APPROVED);
    const offer = offerFixture({ status: DistributorOfferStatus.DRAFT });
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      distributorOffer: {
        create: jest.fn().mockResolvedValue(offer),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(warehouse),
      },
      productVariant: {
        findUnique: jest.fn().mockResolvedValue(variant),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 40 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OffersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createOffer(
      {
        variantId: variant.id,
        warehouseId: warehouse.id,
        offerCode: 'OFFER-001',
        sellingPricePaise: 120000,
        serviceablePincodes: ['302002', '302001'],
        fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
        deliverySlaDays: 3,
        reason: 'Initial distributor offer',
      },
      distributorActor,
      'req-offer-create',
    );

    expect(result.availableQuantity).toBe(40);
    expect(result.missingRequirements).toEqual([]);
    expect(tx.distributorOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          distributorOrganisationId,
          productId: variant.productId,
          variantId: variant.id,
          serviceablePincodes: ['302001', '302002'],
          sellingPricePaise: 120000,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISTRIBUTOR_OFFER_CREATED',
        resourceType: 'DistributorOffer',
        resourceId: offer.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-offer-create',
      }),
      tx,
    );
  });

  it('blocks offer creation when the product variant is not linked to an approved master product', async () => {
    const warehouse = warehouseFixture();
    const variant = variantFixture(CatalogueStatus.DRAFT);
    const service = new OffersService(
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
      service.createOffer(
        {
          variantId: variant.id,
          warehouseId: warehouse.id,
          sellingPricePaise: 120000,
          serviceablePincodes: ['302001'],
          fulfilmentMode: FulfilmentMode.DISTRIBUTOR_FULFILLED,
          deliverySlaDays: 3,
        },
        distributorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects offer submission when sellable inventory is unavailable', async () => {
    const offer = offerFixture({ status: DistributorOfferStatus.DRAFT });
    const service = new OffersService(
      {
        organisation: {
          findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
        },
        distributorOffer: {
          findUnique: jest.fn().mockResolvedValue(offer),
        },
        inventoryBatch: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.submitOffer(
        offer.id,
        {
          reason: 'Ready for review',
        },
        distributorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves a submitted offer with sellable inventory and records reviewer audit', async () => {
    const submittedOffer = offerFixture({ status: DistributorOfferStatus.SUBMITTED });
    const approvedOffer = {
      ...submittedOffer,
      status: DistributorOfferStatus.APPROVED,
      reviewedAt: new Date('2026-08-03T00:00:00.000Z'),
      reviewedByUserId: reviewerActor.userId,
      reviewReason: 'Verified',
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      distributorOffer: {
        update: jest.fn().mockResolvedValue(approvedOffer),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      distributorOffer: {
        findUnique: jest.fn().mockResolvedValue(submittedOffer),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 35 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OffersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.reviewOffer(
      submittedOffer.id,
      {
        decision: OfferReviewDecision.APPROVE,
        reason: 'Verified',
      },
      reviewerActor,
      'req-offer-review',
    );

    expect(result.status).toBe(DistributorOfferStatus.APPROVED);
    expect(result.availableQuantity).toBe(35);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISTRIBUTOR_OFFER_APPROVED',
        resourceType: 'DistributorOffer',
        resourceId: submittedOffer.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-offer-review',
        reason: 'Verified',
      }),
      tx,
    );
  });

  it('pauses an approved offer and records an operational audit entry', async () => {
    const approvedOffer = offerFixture({ status: DistributorOfferStatus.APPROVED });
    const pausedOffer = {
      ...approvedOffer,
      status: DistributorOfferStatus.PAUSED,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      distributorOffer: {
        update: jest.fn().mockResolvedValue(pausedOffer),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      distributorOffer: {
        findUnique: jest.fn().mockResolvedValue(approvedOffer),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 35 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OffersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.pauseOffer(
      approvedOffer.id,
      {
        reason: 'Distributor is reconciling stock before Kharif dispatch.',
      },
      distributorActor,
      'req-offer-pause',
    );

    expect(result.status).toBe(DistributorOfferStatus.PAUSED);
    expect(tx.distributorOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: DistributorOfferStatus.PAUSED,
        },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISTRIBUTOR_OFFER_PAUSED',
        resourceType: 'DistributorOffer',
        resourceId: approvedOffer.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-offer-pause',
        reason: 'Distributor is reconciling stock before Kharif dispatch.',
      }),
      tx,
    );
  });

  it('reactivates a paused offer only after backend readiness checks pass', async () => {
    const pausedOffer = offerFixture({ status: DistributorOfferStatus.PAUSED });
    const reactivatedOffer = {
      ...pausedOffer,
      status: DistributorOfferStatus.APPROVED,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      distributorOffer: {
        update: jest.fn().mockResolvedValue(reactivatedOffer),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      distributorOffer: {
        findUnique: jest.fn().mockResolvedValue(pausedOffer),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 35 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OffersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.reactivateOffer(
      pausedOffer.id,
      {
        reason: 'Stock reconciliation completed.',
      },
      distributorActor,
      'req-offer-reactivate',
    );

    expect(result.status).toBe(DistributorOfferStatus.APPROVED);
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISTRIBUTOR_OFFER_REACTIVATED',
        resourceType: 'DistributorOffer',
        resourceId: pausedOffer.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-offer-reactivate',
      }),
      tx,
    );
  });

  it('archives an offer and blocks later normal edits', async () => {
    const approvedOffer = offerFixture({ status: DistributorOfferStatus.APPROVED });
    const archivedOffer = {
      ...approvedOffer,
      status: DistributorOfferStatus.ARCHIVED,
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      distributorOffer: {
        update: jest.fn().mockResolvedValue(archivedOffer),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeDistributorOrganisation),
      },
      distributorOffer: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(approvedOffer)
          .mockResolvedValueOnce(archivedOffer),
      },
      inventoryBatch: {
        findMany: jest.fn().mockResolvedValue([batchFixture({ balanceAfter: 35 })]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new OffersService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.archiveOffer(
      approvedOffer.id,
      {
        reason: 'Offer retired after distributor campaign ended.',
      },
      distributorActor,
      'req-offer-archive',
    );

    expect(result.status).toBe(DistributorOfferStatus.ARCHIVED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DISTRIBUTOR_OFFER_ARCHIVED',
        resourceType: 'DistributorOffer',
        resourceId: approvedOffer.id,
        organisationId: distributorOrganisationId,
        requestId: 'req-offer-archive',
      }),
      tx,
    );

    await expect(
      service.updateOffer(
        approvedOffer.id,
        {
          sellingPricePaise: 119000,
          reason: 'Should not edit archived offer',
        },
        distributorActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function offerFixture({ status }: { status: DistributorOfferStatus }) {
  return {
    id: 'offer-1',
    distributorOrganisationId,
    productId: 'product-1',
    variantId: 'variant-1',
    warehouseId: 'warehouse-1',
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
    distributorOrganisation: activeDistributorOrganisation,
    product: productFixture(CatalogueStatus.APPROVED),
    variant: variantFixture(CatalogueStatus.APPROVED),
    warehouse: warehouseFixture(),
    batch: null,
    reviewedBy: null,
  };
}

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
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
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
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
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
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:00:00.000Z'),
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
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    product: productFixture(productStatus),
  };
}

function batchFixture({ balanceAfter }: { balanceAfter: number }) {
  return {
    id: 'batch-1',
    distributorOrganisationId,
    warehouseId: 'warehouse-1',
    productId: 'product-1',
    variantId: 'variant-1',
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
        warehouseId: 'warehouse-1',
        batchId: 'batch-1',
        productId: 'product-1',
        variantId: 'variant-1',
        movementType: 'OPENING_STOCK',
        quantityDelta: balanceAfter,
        balanceAfter,
        reason: 'Opening stock count',
        referenceType: null,
        referenceId: null,
        createdByUserId: distributorOrganisationId,
        createdAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ],
  };
}
