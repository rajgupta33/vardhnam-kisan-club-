import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  InventoryBatchStatus,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  WarehouseStatus,
  type DistributorOffer,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { ListOffersQueryDto } from './dto/list-offers-query.dto';
import type { OfferStatusOperationDto } from './dto/offer-status-operation.dto';
import { OfferReviewDecision, type ReviewOfferDto } from './dto/review-offer.dto';
import type { SubmitOfferDto } from './dto/submit-offer.dto';
import type { UpdateOfferDto } from './dto/update-offer.dto';

const offerInclude = Prisma.validator<Prisma.DistributorOfferInclude>()({
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
  product: { include: { brand: true, companyOrganisation: true } },
  variant: true,
  reviewedBy: { include: { profile: true } },
});

type OfferWithRelations = Prisma.DistributorOfferGetPayload<{ include: typeof offerInclude }>;

type OfferStockScope = Pick<
  DistributorOffer,
  'distributorOrganisationId' | 'warehouseId' | 'productId' | 'variantId' | 'batchId'
>;

@Injectable()
export class OffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async listOffers(query: ListOffersQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildOfferWhere(query, actor);

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.distributorOffer.findMany({
        where,
        include: offerInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.distributorOffer.count({ where }),
    ]);

    return {
      items: await Promise.all(offers.map((offer) => this.toOfferDetail(offer))),
      page,
      limit,
      total,
    };
  }

  async listOfferReviewQueue(query: ListOffersQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.DistributorOfferWhereInput = {
      status: query.status ?? DistributorOfferStatus.SUBMITTED,
    };
    if (query.distributorOrganisationId) {
      where.distributorOrganisationId = query.distributorOrganisationId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.batchId) {
      where.batchId = query.batchId;
    }
    if (query.serviceablePincode) {
      where.serviceablePincodes = { has: query.serviceablePincode };
    }
    if (query.q) {
      where.OR = this.offerSearch(query.q);
    }

    const [offers, total] = await this.prisma.$transaction([
      this.prisma.distributorOffer.findMany({
        where,
        include: offerInclude,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.distributorOffer.count({ where }),
    ]);
    const items = await Promise.all(offers.map((offer) => this.toOfferQueueItem(offer)));

    return { items, page, limit, total };
  }

  async getOffer(offerId: string, actor: CurrentUser) {
    const offer = await this.findOfferOrThrow(offerId);
    await this.ensureOfferRead(actor, offer.distributorOrganisationId);
    return this.toOfferDetail(offer);
  }

  async createOffer(dto: CreateOfferDto, actor: CurrentUser, requestId?: string) {
    const warehouse = await this.findWarehouseOrThrow(dto.warehouseId);
    const distributorOrganisationId =
      dto.distributorOrganisationId ?? warehouse.distributorOrganisationId;

    if (distributorOrganisationId !== warehouse.distributorOrganisationId) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Offer distributor organisation must match the warehouse owner',
      });
    }

    await this.ensureOfferWrite(actor, distributorOrganisationId);
    this.ensureActiveWarehouse(warehouse);

    const variant = await this.findApprovedVariantOrThrow(dto.variantId);
    const batch = dto.batchId ? await this.findBatchOrThrow(dto.batchId) : undefined;
    if (batch) {
      this.ensureBatchMatchesOffer(batch, warehouse, variant);
    }
    this.ensureQuantityRange(dto.minimumOrderQuantity ?? 1, dto.maximumOrderQuantity);

    try {
      const offer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.distributorOffer.create({
          data: {
            distributorOrganisationId,
            productId: variant.productId,
            variantId: variant.id,
            warehouseId: warehouse.id,
            batchId: batch?.id ?? null,
            offerCode: dto.offerCode ?? null,
            sellingPricePaise: dto.sellingPricePaise,
            minimumOrderQuantity: dto.minimumOrderQuantity ?? 1,
            maximumOrderQuantity: dto.maximumOrderQuantity ?? null,
            serviceablePincodes: this.normalisePincodes(dto.serviceablePincodes ?? []),
            fulfilmentMode: dto.fulfilmentMode,
            deliverySlaDays: dto.deliverySlaDays ?? null,
          },
          include: offerInclude,
        });

        const auditInput = this.withActor(actor, {
          action: 'DISTRIBUTOR_OFFER_CREATED',
          resourceType: 'DistributorOffer',
          resourceId: created.id,
          organisationId: distributorOrganisationId,
          newValue: this.offerAuditValue(created),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return created;
      });

      return this.toOfferDetail(offer);
    } catch (error) {
      this.throwConflictForKnownUniqueError(
        error,
        'Offer code already exists for this distributor',
      );
      throw error;
    }
  }

  async updateOffer(offerId: string, dto: UpdateOfferDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureOfferWrite(actor, existing.distributorOrganisationId);
    this.ensureOfferNotArchived(existing.status);

    const nextMinimumOrderQuantity = dto.minimumOrderQuantity ?? existing.minimumOrderQuantity;
    const nextMaximumOrderQuantity =
      dto.maximumOrderQuantity ?? existing.maximumOrderQuantity ?? undefined;
    this.ensureQuantityRange(nextMinimumOrderQuantity, nextMaximumOrderQuantity);

    const data: Prisma.DistributorOfferUpdateInput = {};
    if (dto.offerCode !== undefined) {
      data.offerCode = dto.offerCode;
    }
    if (dto.sellingPricePaise !== undefined) {
      data.sellingPricePaise = dto.sellingPricePaise;
    }
    if (dto.minimumOrderQuantity !== undefined) {
      data.minimumOrderQuantity = dto.minimumOrderQuantity;
    }
    if (dto.maximumOrderQuantity !== undefined) {
      data.maximumOrderQuantity = dto.maximumOrderQuantity;
    }
    if (dto.serviceablePincodes !== undefined) {
      data.serviceablePincodes = this.normalisePincodes(dto.serviceablePincodes);
    }
    if (dto.fulfilmentMode !== undefined) {
      data.fulfilmentMode = dto.fulfilmentMode;
    }
    if (dto.deliverySlaDays !== undefined) {
      data.deliverySlaDays = dto.deliverySlaDays;
    }

    if (
      Object.keys(data).length > 0 &&
      (existing.status === DistributorOfferStatus.APPROVED ||
        existing.status === DistributorOfferStatus.SUBMITTED)
    ) {
      data.status = DistributorOfferStatus.DRAFT;
      data.reviewedAt = null;
      data.reviewedBy = { disconnect: true };
      data.reviewReason = null;
    }

    try {
      const offer = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.distributorOffer.update({
          where: { id: offerId },
          data,
          include: offerInclude,
        });

        const auditInput = this.withActor(actor, {
          action: 'DISTRIBUTOR_OFFER_UPDATED',
          resourceType: 'DistributorOffer',
          resourceId: updated.id,
          organisationId: updated.distributorOrganisationId,
          previousValue: this.offerAuditValue(existing),
          newValue: this.offerAuditValue(updated),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return updated;
      });

      return this.toOfferDetail(offer);
    } catch (error) {
      this.throwConflictForKnownUniqueError(
        error,
        'Offer code already exists for this distributor',
      );
      throw error;
    }
  }

  async pauseOffer(
    offerId: string,
    dto: OfferStatusOperationDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureOfferWrite(actor, existing.distributorOrganisationId);
    this.ensureOfferStatus(
      existing.status,
      DistributorOfferStatus.APPROVED,
      'Only approved offers may be paused',
    );

    return this.transitionOfferStatus({
      offerId,
      existing,
      actor,
      requestId,
      reason: dto.reason,
      nextStatus: DistributorOfferStatus.PAUSED,
      action: 'DISTRIBUTOR_OFFER_PAUSED',
    });
  }

  async reactivateOffer(
    offerId: string,
    dto: OfferStatusOperationDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureOfferWrite(actor, existing.distributorOrganisationId);
    this.ensureOfferStatus(
      existing.status,
      DistributorOfferStatus.PAUSED,
      'Only paused offers may be reactivated',
    );
    await this.ensureOfferReadyForSubmission(existing);

    return this.transitionOfferStatus({
      offerId,
      existing,
      actor,
      requestId,
      reason: dto.reason,
      nextStatus: DistributorOfferStatus.APPROVED,
      action: 'DISTRIBUTOR_OFFER_REACTIVATED',
    });
  }

  async archiveOffer(
    offerId: string,
    dto: OfferStatusOperationDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureOfferWrite(actor, existing.distributorOrganisationId);
    this.ensureOfferNotArchived(existing.status);

    return this.transitionOfferStatus({
      offerId,
      existing,
      actor,
      requestId,
      reason: dto.reason,
      nextStatus: DistributorOfferStatus.ARCHIVED,
      action: 'DISTRIBUTOR_OFFER_ARCHIVED',
    });
  }

  async submitOffer(offerId: string, dto: SubmitOfferDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureOfferSubmit(actor, existing.distributorOrganisationId);
    this.ensureSubmittableStatus(existing.status);
    await this.ensureOfferReadyForSubmission(existing);

    const offer = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.distributorOffer.update({
        where: { id: offerId },
        data: {
          status: DistributorOfferStatus.SUBMITTED,
          reviewedAt: null,
          reviewedBy: { disconnect: true },
          reviewReason: null,
        },
        include: offerInclude,
      });

      const auditInput = this.withActor(actor, {
        action: 'DISTRIBUTOR_OFFER_SUBMITTED',
        resourceType: 'DistributorOffer',
        resourceId: updated.id,
        organisationId: updated.distributorOrganisationId,
        previousValue: this.offerAuditValue(existing),
        newValue: this.offerAuditValue(updated),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return this.toOfferDetail(offer);
  }

  async reviewOffer(offerId: string, dto: ReviewOfferDto, actor: CurrentUser, requestId?: string) {
    this.ensureOfferReview(actor);
    const existing = await this.findOfferOrThrow(offerId);
    await this.ensureActiveDistributorOrganisation(existing.distributorOrganisationId);
    this.ensureReviewableStatus(existing.status);
    if (dto.decision === OfferReviewDecision.APPROVE) {
      await this.ensureOfferReadyForSubmission(existing);
    }

    const nextStatus =
      dto.decision === OfferReviewDecision.APPROVE
        ? DistributorOfferStatus.APPROVED
        : DistributorOfferStatus.REJECTED;

    const offer = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.distributorOffer.update({
        where: { id: offerId },
        data: {
          status: nextStatus,
          reviewedAt: new Date(),
          reviewedBy: { connect: { id: actor.userId } },
          reviewReason: dto.reason ?? null,
        },
        include: offerInclude,
      });

      const auditInput = this.withActor(actor, {
        action:
          dto.decision === OfferReviewDecision.APPROVE
            ? 'DISTRIBUTOR_OFFER_APPROVED'
            : 'DISTRIBUTOR_OFFER_REJECTED',
        resourceType: 'DistributorOffer',
        resourceId: updated.id,
        organisationId: updated.distributorOrganisationId,
        previousValue: this.offerAuditValue(existing),
        newValue: this.offerAuditValue(updated),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return this.toOfferDetail(offer);
  }

  private async transitionOfferStatus(input: {
    offerId: string;
    existing: OfferWithRelations;
    actor: CurrentUser;
    requestId: string | undefined;
    reason: string;
    nextStatus: DistributorOfferStatus;
    action:
      'DISTRIBUTOR_OFFER_PAUSED' | 'DISTRIBUTOR_OFFER_REACTIVATED' | 'DISTRIBUTOR_OFFER_ARCHIVED';
  }) {
    const offer = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.distributorOffer.update({
        where: { id: input.offerId },
        data: {
          status: input.nextStatus,
        },
        include: offerInclude,
      });

      const auditInput = this.withActor(input.actor, {
        action: input.action,
        resourceType: 'DistributorOffer',
        resourceId: updated.id,
        organisationId: updated.distributorOrganisationId,
        previousValue: this.offerAuditValue(input.existing),
        newValue: this.offerAuditValue(updated),
      });
      this.attachAuditContext(auditInput, input.requestId, input.reason);
      await this.auditService.record(auditInput, tx);

      return updated;
    });

    return this.toOfferDetail(offer);
  }

  private buildOfferWhere(
    query: ListOffersQueryDto,
    actor: CurrentUser,
  ): Prisma.DistributorOfferWhereInput {
    const where: Prisma.DistributorOfferWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.batchId) {
      where.batchId = query.batchId;
    }
    if (query.serviceablePincode) {
      where.serviceablePincodes = { has: query.serviceablePincode };
    }
    if (query.q) {
      where.OR = this.offerSearch(query.q);
    }

    if (this.accessService.hasPermission(actor, PermissionCode.OFFERS_READ_ANY)) {
      if (query.distributorOrganisationId) {
        where.distributorOrganisationId = query.distributorOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.OFFERS_READ_OWN)) {
      where.distributorOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Offer read permission is required');
  }

  private offerSearch(query: string): Prisma.DistributorOfferWhereInput[] {
    return [
      { offerCode: { contains: query, mode: 'insensitive' } },
      { product: { name: { contains: query, mode: 'insensitive' } } },
      { product: { slug: { contains: query, mode: 'insensitive' } } },
      { product: { category: { contains: query, mode: 'insensitive' } } },
      { variant: { variantName: { contains: query, mode: 'insensitive' } } },
      { warehouse: { name: { contains: query, mode: 'insensitive' } } },
      { distributorOrganisation: { displayName: { contains: query, mode: 'insensitive' } } },
    ];
  }

  private async toOfferQueueItem(offer: OfferWithRelations) {
    const detail = await this.toOfferDetail(offer);
    return {
      offer: detail,
      availableQuantity: detail.availableQuantity,
      missingRequirements: detail.missingRequirements,
    };
  }

  private async toOfferDetail(offer: OfferWithRelations) {
    const availableQuantity = await this.availableQuantityForOffer(offer);
    return {
      ...offer,
      availableQuantity,
      missingRequirements: this.offerMissingRequirements(offer, availableQuantity),
    };
  }

  private offerMissingRequirements(offer: OfferWithRelations, availableQuantity: number): string[] {
    const missingRequirements: string[] = [];
    if (offer.product.status !== CatalogueStatus.APPROVED) {
      missingRequirements.push('APPROVED_PRODUCT');
    }
    if (!offer.variant.isActive) {
      missingRequirements.push('ACTIVE_VARIANT');
    }
    if (offer.warehouse.status !== WarehouseStatus.ACTIVE) {
      missingRequirements.push('ACTIVE_WAREHOUSE');
    }
    if (offer.sellingPricePaise <= 0) {
      missingRequirements.push('VALID_PRICE');
    }
    if (offer.serviceablePincodes.length === 0) {
      missingRequirements.push('SERVICEABLE_PINCODE');
    }
    if (
      offer.maximumOrderQuantity !== null &&
      offer.maximumOrderQuantity < offer.minimumOrderQuantity
    ) {
      missingRequirements.push('ORDER_QUANTITY_RANGE');
    }
    if (offer.fulfilmentMode !== 'PICKUP' && offer.deliverySlaDays === null) {
      missingRequirements.push('DELIVERY_SLA');
    }
    if (offer.batch && !this.isBatchSellable(offer.batch)) {
      missingRequirements.push('BATCH_ELIGIBLE');
    }
    if (availableQuantity <= 0) {
      missingRequirements.push('SELLABLE_INVENTORY');
    }
    return missingRequirements;
  }

  private async ensureOfferReadyForSubmission(offer: OfferWithRelations): Promise<void> {
    const availableQuantity = await this.availableQuantityForOffer(offer);
    const missingRequirements = this.offerMissingRequirements(offer, availableQuantity);
    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: `Offer is not ready for review: ${missingRequirements.join(', ')}`,
      });
    }
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

  private async ensureOfferRead(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.OFFERS_READ_ANY)) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.OFFERS_READ_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      return;
    }
    throw this.forbidden('Offer read permission is required');
  }

  private async ensureOfferWrite(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.OFFERS_WRITE_ANY)) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.OFFERS_WRITE_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    throw this.forbidden('Offer write permission is required');
  }

  private async ensureOfferSubmit(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.OFFERS_WRITE_ANY)) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.OFFERS_SUBMIT_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    throw this.forbidden('Offer submit permission is required');
  }

  private ensureOfferReview(actor: CurrentUser): void {
    if (!this.accessService.hasPermission(actor, PermissionCode.OFFERS_REVIEW)) {
      throw this.forbidden('Offer review permission is required');
    }
  }

  private async ensureActiveDistributorOrganisation(
    distributorOrganisationId: string,
  ): Promise<void> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: distributorOrganisationId },
    });

    if (!organisation) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Distributor organisation was not found',
      });
    }
    if (organisation.type !== OrganisationType.DISTRIBUTOR) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Offers must belong to a distributor organisation',
      });
    }
    if (organisation.status !== OrganisationStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor organisation must be active before offers can be managed',
      });
    }
  }

  private ensureActiveWarehouse(warehouse: { status: WarehouseStatus }): void {
    if (warehouse.status !== WarehouseStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Offer warehouse must be active',
      });
    }
  }

  private async findOfferOrThrow(offerId: string) {
    const offer = await this.prisma.distributorOffer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });

    if (!offer) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Distributor offer was not found',
      });
    }

    return offer;
  }

  private async findWarehouseOrThrow(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: { distributorOrganisation: true },
    });

    if (!warehouse) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Warehouse was not found',
      });
    }

    return warehouse;
  }

  private async findBatchOrThrow(batchId: string) {
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: {
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!batch) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Inventory batch was not found',
      });
    }

    return batch;
  }

  private async findApprovedVariantOrThrow(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            brand: true,
            companyOrganisation: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product variant was not found',
      });
    }
    if (!variant.isActive) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor offers require an active product variant',
      });
    }
    if (variant.product.status !== CatalogueStatus.APPROVED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor offers require an approved master product',
      });
    }

    return variant;
  }

  private ensureBatchMatchesOffer(
    batch: Prisma.InventoryBatchGetPayload<{
      include: { inventoryMovements: { orderBy: { createdAt: 'desc' }; take: 1 } };
    }>,
    warehouse: { id: string; distributorOrganisationId: string },
    variant: Prisma.ProductVariantGetPayload<{ include: { product: true } }>,
  ): void {
    if (
      batch.distributorOrganisationId !== warehouse.distributorOrganisationId ||
      batch.warehouseId !== warehouse.id ||
      batch.productId !== variant.productId ||
      batch.variantId !== variant.id
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Offer batch must match the distributor, warehouse, product and variant',
      });
    }
  }

  private ensureSubmittableStatus(status: DistributorOfferStatus): void {
    if (status !== DistributorOfferStatus.DRAFT && status !== DistributorOfferStatus.REJECTED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Only draft or rejected offers may be submitted',
      });
    }
  }

  private ensureReviewableStatus(status: DistributorOfferStatus): void {
    if (status !== DistributorOfferStatus.SUBMITTED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Only submitted offers may be reviewed',
      });
    }
  }

  private ensureOfferNotArchived(status: DistributorOfferStatus): void {
    if (status === DistributorOfferStatus.ARCHIVED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Archived offers cannot be changed',
      });
    }
  }

  private ensureOfferStatus(
    actual: DistributorOfferStatus,
    expected: DistributorOfferStatus,
    message: string,
  ): void {
    if (actual !== expected) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message,
      });
    }
  }

  private ensureQuantityRange(minimumOrderQuantity: number, maximumOrderQuantity?: number): void {
    if (
      maximumOrderQuantity !== undefined &&
      maximumOrderQuantity !== null &&
      maximumOrderQuantity < minimumOrderQuantity
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Maximum order quantity cannot be lower than minimum order quantity',
      });
    }
  }

  private isBatchSellable(batch: {
    status: InventoryBatchStatus;
    expiryDate?: Date | null;
  }): boolean {
    return batch.status === InventoryBatchStatus.ACTIVE && !this.isBatchExpired(batch.expiryDate);
  }

  private isBatchExpired(expiryDate?: Date | null): boolean {
    if (!expiryDate) {
      return false;
    }

    return expiryDate.getTime() < this.todayStartUtc().getTime();
  }

  private todayStartUtc(): Date {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private normalisePincodes(pincodes: string[]): string[] {
    return Array.from(new Set(pincodes.map((pincode) => pincode.trim()).filter(Boolean))).sort();
  }

  private offerAuditValue(offer: DistributorOffer): Prisma.InputJsonObject {
    return {
      distributorOrganisationId: offer.distributorOrganisationId,
      productId: offer.productId,
      variantId: offer.variantId,
      warehouseId: offer.warehouseId,
      batchId: offer.batchId,
      offerCode: offer.offerCode,
      sellingPricePaise: offer.sellingPricePaise,
      minimumOrderQuantity: offer.minimumOrderQuantity,
      maximumOrderQuantity: offer.maximumOrderQuantity,
      serviceablePincodes: offer.serviceablePincodes,
      fulfilmentMode: offer.fulfilmentMode,
      deliverySlaDays: offer.deliverySlaDays,
      status: offer.status,
      reviewedAt: offer.reviewedAt?.toISOString() ?? null,
      reviewedByUserId: offer.reviewedByUserId,
      reviewReason: offer.reviewReason,
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
}
