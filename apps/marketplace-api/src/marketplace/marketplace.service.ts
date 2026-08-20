import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  InventoryBatchStatus,
  OrganisationStatus,
  Prisma,
  StoredFileStatus,
  WarehouseStatus,
} from '@prisma/client';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { ListMarketplaceProductsQueryDto } from './dto/list-marketplace-products-query.dto';
import type { MarketplaceFilterOptionsQueryDto } from './dto/marketplace-filter-options-query.dto';
import type { MarketplaceProductDetailQueryDto } from './dto/marketplace-product-detail-query.dto';

const discoveryOfferInclude = Prisma.validator<Prisma.DistributorOfferInclude>()({
  distributorOrganisation: true,
  warehouse: true,
  batch: {
    include: {
      inventoryMovements: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
  product: {
    include: {
      brand: true,
      companyOrganisation: true,
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      },
      documents: {
        orderBy: { createdAt: 'asc' },
      },
      primaryImage: { select: { id: true, status: true } },
    },
  },
  variant: true,
});

type DiscoveryOffer = Prisma.DistributorOfferGetPayload<{ include: typeof discoveryOfferInclude }>;

type OfferStockScope = Pick<
  DiscoveryOffer,
  'distributorOrganisationId' | 'warehouseId' | 'productId' | 'variantId' | 'batchId'
>;

interface EligibleOffer {
  offer: DiscoveryOffer;
  availableQuantity: number;
}

export interface MarketplaceProgrammeEligibility {
  productId: string;
  variantId: string | null;
  displayPriority: number;
  programmeId: string;
}

export interface MarketplaceDiscoveryOptions {
  programmeEligibility?: MarketplaceProgrammeEligibility[];
}

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * A stable public URL for a product pack shot, or null when there is none.
   *
   * Deliberately *not* a signed URL embedded in the payload. Discovery results
   * are cached on the device for 24 hours, and a short-lived signature would
   * expire inside that window, turning every cached product into a broken
   * image. This URL never expires; the endpoint behind it mints a fresh
   * signature per request.
   *
   * Only an `AVAILABLE` image is advertised, so an upload still awaiting its
   * virus scan is never linked.
   */
  private productImageUrl(product: {
    id: string;
    primaryImage?: { status: StoredFileStatus } | null;
  }): string | null {
    if (product.primaryImage?.status !== StoredFileStatus.AVAILABLE) {
      return null;
    }

    const baseUrl = (this.configService.get<string>('PUBLIC_API_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    const prefix = this.configService.get<string>('API_PREFIX') ?? 'api/v1';
    return `${baseUrl}/${prefix}/marketplace/products/${product.id}/image`;
  }

  /**
   * Resolves the short-lived storage URL a product image redirect should land
   * on. Product pack shots are public marketing material, unlike the
   * permission-checked, audited downloads in `FilesService`.
   */
  async getProductImageTarget(productId: string): Promise<string | undefined> {
    const product = await this.prisma.masterProduct.findFirst({
      where: {
        id: productId,
        status: CatalogueStatus.APPROVED,
        primaryImage: { status: StoredFileStatus.AVAILABLE },
      },
      select: { primaryImage: { select: { objectKey: true } } },
    });

    if (!product?.primaryImage) {
      return undefined;
    }

    const target = await this.storage.getDownloadUrl(product.primaryImage.objectKey, 300);
    return target.url;
  }

  async listProducts(
    query: ListMarketplaceProductsQueryDto,
    options: MarketplaceDiscoveryOptions = {},
  ) {
    const { page, limit } = paginationOffset(query);
    if (options.programmeEligibility?.length === 0) {
      return { items: [], page, limit, total: 0 };
    }
    const offers = await this.findCandidateOffers(query, options);
    const eligibleOffers = await this.toEligibleOffers(offers);
    const productSummaries = this.sortForDiscoveryOptions(
      this.toProductSummaries(eligibleOffers, query.pincode),
      options,
    );
    const start = (page - 1) * limit;
    const items = productSummaries.slice(start, start + limit);

    return {
      items,
      page,
      limit,
      total: productSummaries.length,
    };
  }

  async getProduct(
    productId: string,
    query: MarketplaceProductDetailQueryDto,
    options: MarketplaceDiscoveryOptions = {},
  ) {
    if (options.programmeEligibility?.length === 0) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Marketplace product was not found for this pincode',
      });
    }
    const offers = await this.findCandidateOffers(
      {
        pincode: query.pincode,
        productId,
      },
      options,
    );
    const eligibleOffers = await this.toEligibleOffers(offers);
    const productSummaries = this.toProductSummaries(eligibleOffers, query.pincode);
    const product = productSummaries[0];

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Marketplace product was not found for this pincode',
      });
    }

    const sourceProduct = eligibleOffers[0]?.offer.product;

    return {
      ...product,
      description: sourceProduct?.description ?? null,
      variants:
        sourceProduct?.variants
          .filter((variant) => this.variantAllowedByProgramme(productId, variant.id, options))
          .map((variant) => ({
          id: variant.id,
          variantName: variant.variantName,
          packSize: variant.packSize.toString(),
          packUnit: variant.packUnit,
          mrpPaise: variant.mrpPaise,
          })) ?? [],
      documents:
        sourceProduct?.documents.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          title: document.title,
          documentNumber: document.documentNumber,
          issuedAt: document.issuedAt,
          expiresAt: document.expiresAt,
        })) ?? [],
    };
  }

  async getFilterOptions(query: MarketplaceFilterOptionsQueryDto) {
    const offers = await this.findCandidateOffers(query);
    const eligibleOffers = await this.toEligibleOffers(offers);
    const products = new Map(
      eligibleOffers.map(({ offer }) => [offer.productId, offer.product]),
    );
    const productValues = Array.from(products.values());
    const brands = new Map(
      productValues.map((product) => [product.brand.id, {
        id: product.brand.id,
        name: product.brand.name,
        slug: product.brand.slug,
      }]),
    );

    return {
      categories: this.sortedUnique(productValues.map((product) => product.category)),
      brands: Array.from(brands.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      cropTargets: this.sortedUnique(productValues.flatMap((product) => product.cropTargets)),
    };
  }

  private async findCandidateOffers(
    query:
      ListMarketplaceProductsQueryDto | (MarketplaceProductDetailQueryDto & { productId: string }),
    options: MarketplaceDiscoveryOptions = {},
  ): Promise<DiscoveryOffer[]> {
    const productWhere: Prisma.MasterProductWhereInput = {
      status: CatalogueStatus.APPROVED,
    };
    const where: Prisma.DistributorOfferWhereInput = {
      status: DistributorOfferStatus.APPROVED,
      serviceablePincodes: { has: query.pincode },
      product: productWhere,
      variant: {
        isActive: true,
      },
      warehouse: {
        status: WarehouseStatus.ACTIVE,
      },
      distributorOrganisation: {
        status: OrganisationStatus.ACTIVE,
      },
    };

    if (options.programmeEligibility) {
      const productWideIds = options.programmeEligibility
        .filter((item) => item.variantId === null)
        .map((item) => item.productId);
      const variantEntries = options.programmeEligibility.filter(
        (item): item is MarketplaceProgrammeEligibility & { variantId: string } =>
          item.variantId !== null,
      );
      const programmeScope: Prisma.DistributorOfferWhereInput = {
        OR: [
          ...(productWideIds.length > 0 ? [{ productId: { in: productWideIds } }] : []),
          ...variantEntries.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          })),
        ],
      };
      where.AND = [programmeScope];
    }

    if ('productId' in query) {
      where.productId = query.productId;
    }
    if ('category' in query && query.category) {
      productWhere.category = { equals: query.category, mode: 'insensitive' };
    }
    if ('brandId' in query && query.brandId) {
      productWhere.brandId = query.brandId;
    }
    if ('brandSlug' in query && query.brandSlug) {
      productWhere.brand = {
        slug: { equals: query.brandSlug, mode: 'insensitive' },
        status: CatalogueStatus.APPROVED,
      };
    }
    if ('cropTarget' in query && query.cropTarget) {
      productWhere.cropTargets = { has: query.cropTarget };
    }
    if ('q' in query && query.q) {
      where.OR = [
        { product: { name: { contains: query.q, mode: 'insensitive' } } },
        { product: { slug: { contains: query.q, mode: 'insensitive' } } },
        { product: { category: { contains: query.q, mode: 'insensitive' } } },
        { product: { brand: { name: { contains: query.q, mode: 'insensitive' } } } },
        { variant: { variantName: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.distributorOffer.findMany({
      where,
      include: discoveryOfferInclude,
      orderBy: [{ sellingPricePaise: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });
  }

  private async toEligibleOffers(offers: DiscoveryOffer[]): Promise<EligibleOffer[]> {
    const eligibleOffers = await Promise.all(
      offers.map(async (offer) => ({
        offer,
        availableQuantity: await this.availableQuantityForOffer(offer),
      })),
    );

    return eligibleOffers.filter(
      ({ offer, availableQuantity }) =>
        availableQuantity > 0 &&
        offer.product.status === CatalogueStatus.APPROVED &&
        offer.product.brand.status === CatalogueStatus.APPROVED &&
        offer.variant.isActive &&
        offer.warehouse.status === WarehouseStatus.ACTIVE,
    );
  }

  private toProductSummaries(eligibleOffers: EligibleOffer[], pincode: string) {
    const byProduct = new Map<string, EligibleOffer[]>();
    for (const eligibleOffer of eligibleOffers) {
      const existing = byProduct.get(eligibleOffer.offer.productId) ?? [];
      existing.push(eligibleOffer);
      byProduct.set(eligibleOffer.offer.productId, existing);
    }

    return Array.from(byProduct.values())
      .map((offers) => {
        const firstOffer = offers[0];
        if (!firstOffer) {
          throw new Error('Marketplace product grouping cannot be empty');
        }
        const product = firstOffer.offer.product;
        const lowestPricePaise = Math.min(...offers.map(({ offer }) => offer.sellingPricePaise));
        const availableQuantity = offers.reduce(
          (total, offer) => total + offer.availableQuantity,
          0,
        );
        const sellerIds = new Set(offers.map(({ offer }) => offer.distributorOrganisationId));
        const fulfilmentModes = Array.from(
          new Set(offers.map(({ offer }) => offer.fulfilmentMode)),
        ).sort();

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          category: product.category,
          cropTargets: product.cropTargets,
          primaryImageUrl: this.productImageUrl(product),
          brand: {
            id: product.brand.id,
            name: product.brand.name,
            slug: product.brand.slug,
          },
          company: {
            id: product.companyOrganisation.id,
            displayName: product.companyOrganisation.displayName,
          },
          serviceablePincode: pincode,
          lowestPricePaise,
          availableQuantity,
          offerCount: offers.length,
          sellerCount: sellerIds.size,
          fulfilmentModes,
          offers: offers.map(({ offer, availableQuantity: offerAvailability }) =>
            this.toOfferSummary(offer, offerAvailability),
          ),
        };
      })
      .sort((left, right) => left.lowestPricePaise - right.lowestPricePaise);
  }

  private toOfferSummary(offer: DiscoveryOffer, availableQuantity: number) {
    return {
      id: offer.id,
      variant: {
        id: offer.variant.id,
        variantName: offer.variant.variantName,
        packSize: offer.variant.packSize.toString(),
        packUnit: offer.variant.packUnit,
        mrpPaise: offer.variant.mrpPaise,
      },
      seller: {
        organisationId: offer.distributorOrganisation.id,
        displayName: offer.distributorOrganisation.displayName,
        legalName: offer.distributorOrganisation.legalName,
        gstin: offer.distributorOrganisation.gstin,
      },
      warehouse: {
        id: offer.warehouse.id,
        name: offer.warehouse.name,
        city: offer.warehouse.city,
        state: offer.warehouse.state,
        pincode: offer.warehouse.pincode,
      },
      batch: offer.batch
        ? {
            id: offer.batch.id,
            batchNumber: offer.batch.batchNumber,
            expiryDate: offer.batch.expiryDate,
            germinationPercentage: offer.batch.germinationPercentage?.toString() ?? null,
          }
        : null,
      sellingPricePaise: offer.sellingPricePaise,
      minimumOrderQuantity: offer.minimumOrderQuantity,
      maximumOrderQuantity: offer.maximumOrderQuantity,
      availableQuantity,
      fulfilmentMode: offer.fulfilmentMode,
      deliverySlaDays: offer.deliverySlaDays,
    };
  }

  private async availableQuantityForOffer(offer: OfferStockScope): Promise<number> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        distributorOrganisationId: offer.distributorOrganisationId,
        warehouseId: offer.warehouseId,
        productId: offer.productId,
        variantId: offer.variantId,
        ...(offer.batchId ? { id: offer.batchId } : {}),
        status: InventoryBatchStatus.ACTIVE,
        OR: [{ expiryDate: null }, { expiryDate: { gte: this.todayStartUtc() } }],
      },
      include: {
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return batches.reduce((total, batch) => {
      const balance = batch.inventoryMovements[0]?.balanceAfter ?? 0;
      return total + Math.max(0, balance);
    }, 0);
  }

  private todayStartUtc(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private sortedUnique(values: string[]): string[] {
    const byNormalizedValue = new Map<string, string>();
    for (const value of values) {
      const trimmed = value.trim();
      if (trimmed) byNormalizedValue.set(trimmed.toLocaleLowerCase(), trimmed);
    }
    return Array.from(byNormalizedValue.values()).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private sortForDiscoveryOptions<
    TProduct extends { id: string; lowestPricePaise: number },
  >(products: TProduct[], options: MarketplaceDiscoveryOptions): TProduct[] {
    if (!options.programmeEligibility) return products;
    const priorities = new Map<string, number>();
    for (const item of options.programmeEligibility) {
      priorities.set(
        item.productId,
        Math.max(priorities.get(item.productId) ?? Number.MIN_SAFE_INTEGER, item.displayPriority),
      );
    }
    return products.sort(
      (left, right) =>
        (priorities.get(right.id) ?? 0) - (priorities.get(left.id) ?? 0) ||
        left.lowestPricePaise - right.lowestPricePaise,
    );
  }

  private variantAllowedByProgramme(
    productId: string,
    variantId: string,
    options: MarketplaceDiscoveryOptions,
  ): boolean {
    if (!options.programmeEligibility) return true;
    const programmes = options.programmeEligibility.filter(
      (programme) => programme.productId === productId,
    );
    return (
      programmes.some((programme) => programme.variantId === null) ||
      programmes.some((programme) => programme.variantId === variantId)
    );
  }
}
