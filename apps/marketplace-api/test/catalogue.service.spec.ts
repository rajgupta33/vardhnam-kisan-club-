import { BadRequestException } from '@nestjs/common';
import {
  CatalogueStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  ProductDocumentType,
} from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { CatalogueService } from '../src/catalogue/catalogue.service';
import { CatalogueReviewDecision } from '../src/catalogue/dto/review-catalogue-item.dto';

const companyOrganisationId = '00000000-0000-4000-8000-000000000100';
const reviewerOrganisationId = '00000000-0000-4000-8000-000000000200';
const activeCompanyOrganisation = {
  id: companyOrganisationId,
  type: OrganisationType.COMPANY,
  status: OrganisationStatus.ACTIVE,
};

describe('CatalogueService', () => {
  const companyActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000101',
    role: PlatformRole.COMPANY_OWNER,
    membershipId: '00000000-0000-4000-8000-000000000102',
    organisationId: companyOrganisationId,
    permissions: [
      PermissionCode.CATALOGUE_READ_OWN,
      PermissionCode.CATALOGUE_WRITE_OWN,
      PermissionCode.CATALOGUE_SUBMIT_OWN,
    ],
  };

  const reviewerActor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000201',
    role: PlatformRole.CATALOGUE_REVIEWER,
    membershipId: '00000000-0000-4000-8000-000000000202',
    organisationId: reviewerOrganisationId,
    permissions: [
      PermissionCode.CATALOGUE_READ_ANY,
      PermissionCode.CATALOGUE_QUEUE_READ,
      PermissionCode.CATALOGUE_REVIEW,
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

  it('creates a brand for an active company and records audit', async () => {
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const createdBrand = {
      id: 'brand-1',
      companyOrganisationId,
      name: 'Demo Seeds',
      slug: 'demo-seeds',
      description: null,
      website: null,
      status: CatalogueStatus.DRAFT,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const tx = {
      brand: {
        create: jest.fn().mockResolvedValue(createdBrand),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeCompanyOrganisation),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new CatalogueService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.createBrand(
      {
        name: 'Demo Seeds',
        reason: 'Initial brand record',
      },
      companyActor,
      'req-1',
    );

    expect(result.id).toBe('brand-1');
    expect(tx.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyOrganisationId,
          slug: 'demo-seeds',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BRAND_CREATED',
        resourceType: 'Brand',
        resourceId: 'brand-1',
        organisationId: companyOrganisationId,
        requestId: 'req-1',
        reason: 'Initial brand record',
      }),
      tx,
    );
  });

  it('blocks product submission until brand, variant and document requirements are met', async () => {
    const product = productFixture({
      brandStatus: CatalogueStatus.DRAFT,
      variants: [],
      documents: [],
    });
    const service = new CatalogueService(
      {
        organisation: {
          findUnique: jest.fn().mockResolvedValue(activeCompanyOrganisation),
        },
        masterProduct: {
          findUnique: jest.fn().mockResolvedValue(product),
        },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.submitProduct(
        product.id,
        {
          reason: 'Ready for review',
        },
        companyActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks product submission when an active variant lacks tax metadata', async () => {
    const product = productFixture({
      brandStatus: CatalogueStatus.APPROVED,
      variants: [variantFixture(null, null)],
      documents: [documentFixture()],
    });
    const service = new CatalogueService(
      {
        organisation: { findUnique: jest.fn().mockResolvedValue(activeCompanyOrganisation) },
        masterProduct: { findUnique: jest.fn().mockResolvedValue(product) },
      } as never,
      { record: jest.fn() } as never,
      accessService as never,
    );

    await expect(
      service.submitProduct(product.id, { reason: 'Ready for review' }, companyActor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringContaining('VARIANT_TAX_METADATA'),
      }),
    });
  });

  it('approves a ready product and records reviewer audit', async () => {
    const product = productFixture({
      brandStatus: CatalogueStatus.APPROVED,
      status: CatalogueStatus.SUBMITTED,
      variants: [variantFixture()],
      documents: [documentFixture()],
    });
    const updatedProduct = {
      ...product,
      status: CatalogueStatus.APPROVED,
      reviewedAt: new Date('2026-08-01T00:00:00.000Z'),
      reviewedByUserId: reviewerActor.userId,
      reviewReason: 'Verified',
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const tx = {
      masterProduct: {
        update: jest.fn().mockResolvedValue(updatedProduct),
      },
    };
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue(activeCompanyOrganisation),
      },
      masterProduct: {
        findUnique: jest.fn().mockResolvedValue(product),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new CatalogueService(
      prisma as never,
      auditService as never,
      accessService as never,
    );

    const result = await service.reviewProduct(
      product.id,
      {
        decision: CatalogueReviewDecision.APPROVE,
        reason: 'Verified',
      },
      reviewerActor,
      'req-2',
    );

    expect(result.status).toBe(CatalogueStatus.APPROVED);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MASTER_PRODUCT_APPROVED',
        resourceType: 'MasterProduct',
        resourceId: product.id,
        organisationId: companyOrganisationId,
        requestId: 'req-2',
        reason: 'Verified',
      }),
      tx,
    );
  });
});

function productFixture({
  brandStatus,
  status = CatalogueStatus.DRAFT,
  variants,
  documents,
}: {
  brandStatus: CatalogueStatus;
  status?: CatalogueStatus;
  variants: ReturnType<typeof variantFixture>[];
  documents: ReturnType<typeof documentFixture>[];
}) {
  return {
    id: 'product-1',
    companyOrganisationId,
    brandId: 'brand-1',
    name: 'Demo Bajra Seed',
    slug: 'demo-bajra-seed',
    category: 'Seeds',
    description: null,
    cropTargets: ['Bajra'],
    status,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewReason: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    companyOrganisation: activeCompanyOrganisation,
    brand: {
      id: 'brand-1',
      companyOrganisationId,
      name: 'Demo Seeds',
      slug: 'demo-seeds',
      description: null,
      website: null,
      status: brandStatus,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewReason: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    variants,
    documents,
    reviewedBy: null,
  };
}

function variantFixture(hsnCode: string | null = '1008', gstRateBps: number | null = 500) {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'DEMO-1KG',
    variantName: '1 kg pack',
    packSize: new Prisma.Decimal(1),
    packUnit: 'kg',
    mrpPaise: 125000,
    hsnCode,
    gstRateBps,
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

function documentFixture() {
  return {
    id: 'document-1',
    productId: 'product-1',
    documentType: ProductDocumentType.LABEL,
    title: 'Product label',
    documentNumber: null,
    fileName: 'label.pdf',
    storageKey: 'mock/catalogue/label.pdf',
    issuedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}
