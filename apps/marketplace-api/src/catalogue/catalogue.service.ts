import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogueStatus,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  type Brand,
  type MasterProduct,
  type ProductDocument,
  type ProductVariant,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBrandDto } from './dto/create-brand.dto';
import type { CreateProductDocumentDto } from './dto/create-product-document.dto';
import type { CreateProductVariantDto } from './dto/create-product-variant.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListCatalogueQueryDto } from './dto/list-catalogue-query.dto';
import {
  CatalogueReviewDecision,
  type ReviewCatalogueItemDto,
} from './dto/review-catalogue-item.dto';
import type { SubmitCatalogueItemDto } from './dto/submit-catalogue-item.dto';
import type { UpdateBrandDto } from './dto/update-brand.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async listBrands(query: ListCatalogueQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildBrandWhere(query, actor);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        include: {
          companyOrganisation: true,
          reviewedBy: { include: { profile: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async listBrandReviewQueue(query: ListCatalogueQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.BrandWhereInput = {
      status: query.status ?? CatalogueStatus.SUBMITTED,
    };
    if (query.companyOrganisationId) {
      where.companyOrganisationId = query.companyOrganisationId;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        include: {
          companyOrganisation: true,
          reviewedBy: { include: { profile: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getBrand(brandId: string, actor: CurrentUser) {
    const brand = await this.findBrandOrThrow(brandId);
    await this.ensureCatalogueRead(actor, brand.companyOrganisationId);
    return brand;
  }

  async createBrand(dto: CreateBrandDto, actor: CurrentUser, requestId?: string) {
    const companyOrganisationId = await this.resolveWritableCompanyOrganisationId(
      actor,
      dto.companyOrganisationId,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const brand = await tx.brand.create({
          data: {
            companyOrganisationId,
            name: dto.name,
            slug: dto.slug ?? this.slugify(dto.name),
            description: dto.description ?? null,
            website: dto.website ?? null,
          },
        });

        const auditInput = this.withActor(actor, {
          action: 'BRAND_CREATED',
          resourceType: 'Brand',
          resourceId: brand.id,
          organisationId: companyOrganisationId,
          newValue: this.brandAuditValue(brand),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return brand;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Brand slug already exists for this company');
      throw error;
    }
  }

  async updateBrand(brandId: string, dto: UpdateBrandDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.findBrandOrThrow(brandId);
    await this.ensureCatalogueWrite(actor, existing.companyOrganisationId);

    const data: Prisma.BrandUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.website !== undefined) {
      data.website = dto.website;
    }
    if (existing.status === CatalogueStatus.APPROVED) {
      data.status = CatalogueStatus.DRAFT;
      data.reviewedAt = null;
      data.reviewedBy = { disconnect: true };
      data.reviewReason = null;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const brand = await tx.brand.update({
          where: { id: brandId },
          data,
        });
        const auditInput = this.withActor(actor, {
          action: 'BRAND_UPDATED',
          resourceType: 'Brand',
          resourceId: brand.id,
          organisationId: brand.companyOrganisationId,
          previousValue: this.brandAuditValue(existing),
          newValue: this.brandAuditValue(brand),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return brand;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Brand slug already exists for this company');
      throw error;
    }
  }

  async submitBrand(
    brandId: string,
    dto: SubmitCatalogueItemDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findBrandOrThrow(brandId);
    await this.ensureCatalogueSubmit(actor, existing.companyOrganisationId);
    this.ensureSubmittableStatus(existing.status, 'brand');

    return this.prisma.$transaction(async (tx) => {
      const brand = await tx.brand.update({
        where: { id: brandId },
        data: {
          status: CatalogueStatus.SUBMITTED,
          reviewedAt: null,
          reviewedBy: { disconnect: true },
          reviewReason: null,
        },
      });
      const auditInput = this.withActor(actor, {
        action: 'BRAND_SUBMITTED',
        resourceType: 'Brand',
        resourceId: brand.id,
        organisationId: brand.companyOrganisationId,
        previousValue: this.brandAuditValue(existing),
        newValue: this.brandAuditValue(brand),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return brand;
    });
  }

  async reviewBrand(
    brandId: string,
    dto: ReviewCatalogueItemDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureCatalogueReview(actor);
    const existing = await this.findBrandOrThrow(brandId);
    await this.ensureActiveCompanyOrganisation(existing.companyOrganisationId);
    this.ensureReviewableStatus(existing.status, 'brand');
    const nextStatus = this.reviewDecisionToStatus(dto.decision);

    return this.prisma.$transaction(async (tx) => {
      const brand = await tx.brand.update({
        where: { id: brandId },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedBy: { connect: { id: actor.userId } },
          reviewReason: dto.reason ?? null,
        },
      });
      const auditInput = this.withActor(actor, {
        action:
          dto.decision === CatalogueReviewDecision.APPROVE ? 'BRAND_APPROVED' : 'BRAND_REJECTED',
        resourceType: 'Brand',
        resourceId: brand.id,
        organisationId: brand.companyOrganisationId,
        previousValue: this.brandAuditValue(existing),
        newValue: this.brandAuditValue(brand),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return brand;
    });
  }

  async listProducts(query: ListCatalogueQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildProductWhere(query, actor);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.masterProduct.findMany({
        where,
        include: this.productInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.masterProduct.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async listProductReviewQueue(query: ListCatalogueQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.MasterProductWhereInput = {
      status: query.status ?? CatalogueStatus.SUBMITTED,
    };
    if (query.companyOrganisationId) {
      where.companyOrganisationId = query.companyOrganisationId;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
        { category: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.masterProduct.findMany({
        where,
        include: this.productInclude(),
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.masterProduct.count({ where }),
    ]);

    return {
      items: products.map((product) => this.toProductQueueItem(product)),
      page,
      limit,
      total,
    };
  }

  async getProduct(productId: string, actor: CurrentUser) {
    const product = await this.findProductOrThrow(productId);
    await this.ensureCatalogueRead(actor, product.companyOrganisationId);
    return this.toProductDetail(product);
  }

  async createProduct(dto: CreateProductDto, actor: CurrentUser, requestId?: string) {
    const brand = await this.findBrandOrThrow(dto.brandId);
    await this.ensureCatalogueWrite(actor, brand.companyOrganisationId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.masterProduct.create({
          data: {
            companyOrganisationId: brand.companyOrganisationId,
            brandId: brand.id,
            name: dto.name,
            slug: dto.slug ?? this.slugify(dto.name),
            category: dto.category,
            description: dto.description ?? null,
            cropTargets: dto.cropTargets ?? [],
          },
        });
        const auditInput = this.withActor(actor, {
          action: 'MASTER_PRODUCT_CREATED',
          resourceType: 'MasterProduct',
          resourceId: product.id,
          organisationId: product.companyOrganisationId,
          newValue: this.productAuditValue(product),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return product;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Product slug already exists for this company');
      throw error;
    }
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findProductOrThrow(productId);
    await this.ensureCatalogueWrite(actor, existing.companyOrganisationId);

    const data: Prisma.MasterProductUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.slug !== undefined) {
      data.slug = dto.slug;
    }
    if (dto.category !== undefined) {
      data.category = dto.category;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.cropTargets !== undefined) {
      data.cropTargets = dto.cropTargets;
    }
    if (existing.status === CatalogueStatus.APPROVED) {
      data.status = CatalogueStatus.DRAFT;
      data.reviewedAt = null;
      data.reviewedBy = { disconnect: true };
      data.reviewReason = null;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.masterProduct.update({
          where: { id: productId },
          data,
        });
        const auditInput = this.withActor(actor, {
          action: 'MASTER_PRODUCT_UPDATED',
          resourceType: 'MasterProduct',
          resourceId: product.id,
          organisationId: product.companyOrganisationId,
          previousValue: this.productAuditValue(existing),
          newValue: this.productAuditValue(product),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return product;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'Product slug already exists for this company');
      throw error;
    }
  }

  async addProductVariant(
    productId: string,
    dto: CreateProductVariantDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const product = await this.findProductOrThrow(productId);
    await this.ensureCatalogueWrite(actor, product.companyOrganisationId);

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          sku: dto.sku ?? null,
          variantName: dto.variantName,
          packSize: new Prisma.Decimal(dto.packSize),
          packUnit: dto.packUnit,
          mrpPaise: dto.mrpPaise ?? null,
        },
      });
      await this.markApprovedProductDraftIfChanged(tx, product, actor, requestId, dto.reason);
      const auditInput = this.withActor(actor, {
        action: 'PRODUCT_VARIANT_CREATED',
        resourceType: 'ProductVariant',
        resourceId: variant.id,
        organisationId: product.companyOrganisationId,
        newValue: this.variantAuditValue(variant),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return variant;
    });
  }

  async addProductDocument(
    productId: string,
    dto: CreateProductDocumentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const product = await this.findProductOrThrow(productId);
    await this.ensureCatalogueWrite(actor, product.companyOrganisationId);

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.ProductDocumentUncheckedCreateInput = {
        productId,
        documentType: dto.documentType,
        title: dto.title,
        documentNumber: dto.documentNumber ?? null,
        fileName: dto.fileName ?? null,
        storageKey: dto.storageKey ?? null,
      };
      if (dto.issuedAt) {
        data.issuedAt = new Date(dto.issuedAt);
      }
      if (dto.expiresAt) {
        data.expiresAt = new Date(dto.expiresAt);
      }

      const document = await tx.productDocument.create({ data });
      await this.markApprovedProductDraftIfChanged(tx, product, actor, requestId, dto.reason);
      const auditInput = this.withActor(actor, {
        action: 'PRODUCT_DOCUMENT_METADATA_CREATED',
        resourceType: 'ProductDocument',
        resourceId: document.id,
        organisationId: product.companyOrganisationId,
        newValue: this.documentAuditValue(document),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return document;
    });
  }

  async submitProduct(
    productId: string,
    dto: SubmitCatalogueItemDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findProductOrThrow(productId);
    await this.ensureCatalogueSubmit(actor, existing.companyOrganisationId);
    this.ensureSubmittableStatus(existing.status, 'product');
    this.ensureProductReadyForSubmission(existing);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.masterProduct.update({
        where: { id: productId },
        data: {
          status: CatalogueStatus.SUBMITTED,
          reviewedAt: null,
          reviewedBy: { disconnect: true },
          reviewReason: null,
        },
      });
      const auditInput = this.withActor(actor, {
        action: 'MASTER_PRODUCT_SUBMITTED',
        resourceType: 'MasterProduct',
        resourceId: product.id,
        organisationId: product.companyOrganisationId,
        previousValue: this.productAuditValue(existing),
        newValue: this.productAuditValue(product),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return product;
    });
  }

  async reviewProduct(
    productId: string,
    dto: ReviewCatalogueItemDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureCatalogueReview(actor);
    const existing = await this.findProductOrThrow(productId);
    await this.ensureActiveCompanyOrganisation(existing.companyOrganisationId);
    this.ensureReviewableStatus(existing.status, 'product');
    if (dto.decision === CatalogueReviewDecision.APPROVE) {
      this.ensureProductReadyForSubmission(existing);
    }
    const nextStatus = this.reviewDecisionToStatus(dto.decision);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.masterProduct.update({
        where: { id: productId },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedBy: { connect: { id: actor.userId } },
          reviewReason: dto.reason ?? null,
        },
      });
      const auditInput = this.withActor(actor, {
        action:
          dto.decision === CatalogueReviewDecision.APPROVE
            ? 'MASTER_PRODUCT_APPROVED'
            : 'MASTER_PRODUCT_REJECTED',
        resourceType: 'MasterProduct',
        resourceId: product.id,
        organisationId: product.companyOrganisationId,
        previousValue: this.productAuditValue(existing),
        newValue: this.productAuditValue(product),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return product;
    });
  }

  private buildBrandWhere(
    query: ListCatalogueQueryDto,
    actor: CurrentUser,
  ): Prisma.BrandWhereInput {
    const where: Prisma.BrandWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_ANY)) {
      if (query.companyOrganisationId) {
        where.companyOrganisationId = query.companyOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_OWN)) {
      where.companyOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Catalogue read permission is required');
  }

  private buildProductWhere(
    query: ListCatalogueQueryDto,
    actor: CurrentUser,
  ): Prisma.MasterProductWhereInput {
    const where: Prisma.MasterProductWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
        { category: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_ANY)) {
      if (query.companyOrganisationId) {
        where.companyOrganisationId = query.companyOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_OWN)) {
      where.companyOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Catalogue read permission is required');
  }

  private productInclude() {
    return {
      companyOrganisation: true,
      brand: true,
      variants: { orderBy: { createdAt: 'asc' as const } },
      documents: { orderBy: { createdAt: 'asc' as const } },
      reviewedBy: { include: { profile: true } },
    };
  }

  private toProductDetail(
    product: Prisma.MasterProductGetPayload<{
      include: ReturnType<CatalogueService['productInclude']>;
    }>,
  ) {
    return {
      ...product,
      missingRequirements: this.productMissingRequirements(product),
    };
  }

  private toProductQueueItem(
    product: Prisma.MasterProductGetPayload<{
      include: ReturnType<CatalogueService['productInclude']>;
    }>,
  ) {
    const activeVariantCount = product.variants.filter((variant) => variant.isActive).length;
    return {
      product,
      activeVariantCount,
      documentCount: product.documents.length,
      missingRequirements: this.productMissingRequirements(product),
    };
  }

  private productMissingRequirements(
    product: Prisma.MasterProductGetPayload<{
      include: ReturnType<CatalogueService['productInclude']>;
    }>,
  ): string[] {
    const missingRequirements: string[] = [];
    if (product.brand.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_BRAND');
    }
    if (!product.variants.some((variant) => variant.isActive)) {
      missingRequirements.push('ACTIVE_VARIANT');
    }
    if (product.documents.length === 0) {
      missingRequirements.push('PRODUCT_DOCUMENT');
    }
    return missingRequirements;
  }

  private ensureProductReadyForSubmission(
    product: Prisma.MasterProductGetPayload<{
      include: ReturnType<CatalogueService['productInclude']>;
    }>,
  ): void {
    const missingRequirements = this.productMissingRequirements(product);
    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Product is not ready for catalogue review: ${missingRequirements.join(', ')}`,
      });
    }
  }

  private async resolveWritableCompanyOrganisationId(
    actor: CurrentUser,
    requestedOrganisationId?: string,
  ): Promise<string> {
    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_WRITE_ANY)) {
      const companyOrganisationId = requestedOrganisationId ?? actor.organisationId;
      await this.ensureActiveCompanyOrganisation(companyOrganisationId);
      return companyOrganisationId;
    }

    if (!this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_WRITE_OWN)) {
      throw this.forbidden('Catalogue write permission is required');
    }

    if (requestedOrganisationId && requestedOrganisationId !== actor.organisationId) {
      throw this.forbidden(
        'Users may only write catalogue records for their active company context',
      );
    }

    await this.ensureActiveCompanyOrganisation(actor.organisationId);
    return actor.organisationId;
  }

  private async ensureCatalogueRead(
    actor: CurrentUser,
    companyOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_ANY)) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_READ_OWN) &&
      actor.organisationId === companyOrganisationId
    ) {
      return;
    }
    throw this.forbidden('Catalogue read permission is required');
  }

  private async ensureCatalogueWrite(
    actor: CurrentUser,
    companyOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_WRITE_ANY)) {
      await this.ensureActiveCompanyOrganisation(companyOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_WRITE_OWN) &&
      actor.organisationId === companyOrganisationId
    ) {
      await this.ensureActiveCompanyOrganisation(companyOrganisationId);
      return;
    }
    throw this.forbidden('Catalogue write permission is required');
  }

  private async ensureCatalogueSubmit(
    actor: CurrentUser,
    companyOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_WRITE_ANY)) {
      await this.ensureActiveCompanyOrganisation(companyOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_SUBMIT_OWN) &&
      actor.organisationId === companyOrganisationId
    ) {
      await this.ensureActiveCompanyOrganisation(companyOrganisationId);
      return;
    }
    throw this.forbidden('Catalogue submit permission is required');
  }

  private ensureCatalogueReview(actor: CurrentUser): void {
    if (!this.accessService.hasPermission(actor, PermissionCode.CATALOGUE_REVIEW)) {
      throw this.forbidden('Catalogue review permission is required');
    }
  }

  private async ensureActiveCompanyOrganisation(companyOrganisationId: string): Promise<void> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: companyOrganisationId },
    });

    if (!organisation) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Company organisation was not found',
      });
    }
    if (organisation.type !== OrganisationType.COMPANY) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Catalogue records must belong to a company organisation',
      });
    }
    if (organisation.status !== OrganisationStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Company organisation must be active before catalogue records can be managed',
      });
    }
  }

  private async findBrandOrThrow(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        companyOrganisation: true,
        products: {
          orderBy: { createdAt: 'desc' },
        },
        reviewedBy: { include: { profile: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Brand was not found',
      });
    }

    return brand;
  }

  private async findProductOrThrow(productId: string) {
    const product = await this.prisma.masterProduct.findUnique({
      where: { id: productId },
      include: this.productInclude(),
    });

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product was not found',
      });
    }

    return product;
  }

  private ensureSubmittableStatus(status: CatalogueStatus, resource: string): void {
    if (status !== CatalogueStatus.DRAFT && status !== CatalogueStatus.REJECTED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Only draft or rejected ${resource} records may be submitted`,
      });
    }
  }

  private ensureReviewableStatus(status: CatalogueStatus, resource: string): void {
    if (status !== CatalogueStatus.SUBMITTED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Only submitted ${resource} records may be reviewed`,
      });
    }
  }

  private reviewDecisionToStatus(decision: CatalogueReviewDecision): CatalogueStatus {
    return decision === CatalogueReviewDecision.APPROVE
      ? CatalogueStatus.APPROVED
      : CatalogueStatus.REJECTED;
  }

  private async markApprovedProductDraftIfChanged(
    tx: Prisma.TransactionClient,
    product: Prisma.MasterProductGetPayload<{
      include: ReturnType<CatalogueService['productInclude']>;
    }>,
    actor: CurrentUser,
    requestId?: string,
    reason?: string,
  ): Promise<void> {
    if (product.status !== CatalogueStatus.APPROVED) {
      return;
    }

    const updated = await tx.masterProduct.update({
      where: { id: product.id },
      data: {
        status: CatalogueStatus.DRAFT,
        reviewedAt: null,
        reviewedBy: { disconnect: true },
        reviewReason: null,
      },
    });
    const auditInput = this.withActor(actor, {
      action: 'MASTER_PRODUCT_REOPENED_FOR_REVIEW',
      resourceType: 'MasterProduct',
      resourceId: product.id,
      organisationId: product.companyOrganisationId,
      previousValue: this.productAuditValue(product),
      newValue: this.productAuditValue(updated),
    });
    this.attachAuditContext(auditInput, requestId, reason);
    await this.auditService.record(auditInput, tx);
  }

  private brandAuditValue(brand: Brand): Prisma.InputJsonObject {
    return {
      companyOrganisationId: brand.companyOrganisationId,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      website: brand.website,
      status: brand.status,
      reviewedAt: brand.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: brand.reviewedByUserId,
      reviewReason: brand.reviewReason,
    };
  }

  private productAuditValue(product: MasterProduct): Prisma.InputJsonObject {
    return {
      companyOrganisationId: product.companyOrganisationId,
      brandId: product.brandId,
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description,
      cropTargets: product.cropTargets,
      status: product.status,
      reviewedAt: product.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: product.reviewedByUserId,
      reviewReason: product.reviewReason,
    };
  }

  private variantAuditValue(variant: ProductVariant): Prisma.InputJsonObject {
    return {
      productId: variant.productId,
      sku: variant.sku,
      variantName: variant.variantName,
      packSize: variant.packSize.toString(),
      packUnit: variant.packUnit,
      mrpPaise: variant.mrpPaise,
      isActive: variant.isActive,
    };
  }

  private documentAuditValue(document: ProductDocument): Prisma.InputJsonObject {
    return {
      productId: document.productId,
      documentType: document.documentType,
      title: document.title,
      documentNumber: document.documentNumber,
      fileName: document.fileName,
      storageKey: document.storageKey,
      issuedAt: document.issuedAt?.toISOString() ?? null,
      expiresAt: document.expiresAt?.toISOString() ?? null,
    };
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }

  private attachAuditContext(
    auditInput: AuditRecordInput,
    requestId?: string,
    reason?: string,
  ): void {
    if (requestId) {
      auditInput.requestId = requestId;
    }
    if (reason) {
      auditInput.reason = reason;
    }
  }

  private throwConflictForKnownUniqueError(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message,
      });
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
