import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogueStatus,
  InventoryBatchStatus,
  InventoryMovementType,
  OrganisationStatus,
  OrganisationType,
  Prisma,
  WarehouseStatus,
  type InventoryBatch,
  type InventoryMovement,
  type Warehouse,
} from '@prisma/client';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBatchDto } from './dto/create-batch.dto';
import type { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { InventoryAgeingQueryDto } from './dto/inventory-ageing-query.dto';
import type { ListBatchesQueryDto } from './dto/list-batches-query.dto';
import type { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import type { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import type { UpdateBatchDto } from './dto/update-batch.dto';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto';

type InventoryAgeingReportKind = 'ALL' | 'LOW_STOCK' | 'EXPIRING_SOON';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
  ) {}

  async listWarehouses(query: ListWarehousesQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildWarehouseWhere(query, actor);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where,
        include: {
          distributorOrganisation: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async getWarehouse(warehouseId: string, actor: CurrentUser) {
    const warehouse = await this.findWarehouseOrThrow(warehouseId);
    await this.ensureWarehouseRead(actor, warehouse.distributorOrganisationId);
    return warehouse;
  }

  async createWarehouse(dto: CreateWarehouseDto, actor: CurrentUser, requestId?: string) {
    const distributorOrganisationId = await this.resolveWritableDistributorOrganisationId(
      actor,
      dto.distributorOrganisationId,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.create({
          data: {
            distributorOrganisationId,
            code: dto.code,
            name: dto.name,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2 ?? null,
            city: dto.city,
            state: dto.state,
            pincode: dto.pincode,
            contactName: dto.contactName ?? null,
            contactPhone: dto.contactPhone ?? null,
          },
        });

        const auditInput = this.withActor(actor, {
          action: 'WAREHOUSE_CREATED',
          resourceType: 'Warehouse',
          resourceId: warehouse.id,
          organisationId: distributorOrganisationId,
          newValue: this.warehouseAuditValue(warehouse),
        });
        this.attachAuditContext(auditInput, requestId, dto.reason);
        await this.auditService.record(auditInput, tx);

        return warehouse;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(
        error,
        'Warehouse code already exists for this distributor',
      );
      throw error;
    }
  }

  async updateWarehouse(
    warehouseId: string,
    dto: UpdateWarehouseDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const existing = await this.findWarehouseOrThrow(warehouseId);
    await this.ensureWarehouseWrite(actor, existing.distributorOrganisationId);

    const data: Prisma.WarehouseUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.addressLine1 !== undefined) {
      data.addressLine1 = dto.addressLine1;
    }
    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = dto.addressLine2;
    }
    if (dto.city !== undefined) {
      data.city = dto.city;
    }
    if (dto.state !== undefined) {
      data.state = dto.state;
    }
    if (dto.pincode !== undefined) {
      data.pincode = dto.pincode;
    }
    if (dto.contactName !== undefined) {
      data.contactName = dto.contactName;
    }
    if (dto.contactPhone !== undefined) {
      data.contactPhone = dto.contactPhone;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({
        where: { id: warehouseId },
        data,
      });

      const auditInput = this.withActor(actor, {
        action: 'WAREHOUSE_UPDATED',
        resourceType: 'Warehouse',
        resourceId: warehouse.id,
        organisationId: warehouse.distributorOrganisationId,
        previousValue: this.warehouseAuditValue(existing),
        newValue: this.warehouseAuditValue(warehouse),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      return warehouse;
    });
  }

  async listBatches(query: ListBatchesQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildBatchWhere(query, actor);

    const [batches, total] = await this.prisma.$transaction([
      this.prisma.inventoryBatch.findMany({
        where,
        include: this.batchInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryBatch.count({ where }),
    ]);

    return {
      items: batches.map((batch) => this.toBatchView(batch)),
      page,
      limit,
      total,
    };
  }

  async listInventoryAgeing(query: InventoryAgeingQueryDto, actor: CurrentUser) {
    return this.listInventoryAgeingReport(query, actor, 'ALL');
  }

  async listLowStockInventory(query: InventoryAgeingQueryDto, actor: CurrentUser) {
    return this.listInventoryAgeingReport(query, actor, 'LOW_STOCK');
  }

  async listExpiringInventory(query: InventoryAgeingQueryDto, actor: CurrentUser) {
    return this.listInventoryAgeingReport(query, actor, 'EXPIRING_SOON');
  }

  async getBatch(batchId: string, actor: CurrentUser) {
    const batch = await this.findBatchOrThrow(batchId);
    await this.ensureInventoryRead(actor, batch.distributorOrganisationId);
    return this.toBatchDetail(batch);
  }

  async createBatch(dto: CreateBatchDto, actor: CurrentUser, requestId?: string) {
    const warehouse = await this.findWarehouseOrThrow(dto.warehouseId);
    await this.ensureInventoryWrite(actor, warehouse.distributorOrganisationId);
    this.ensureActiveWarehouse(warehouse);

    const variant = await this.findApprovedVariantOrThrow(dto.variantId);
    const openingQuantity = dto.openingQuantity ?? 0;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const batch = await tx.inventoryBatch.create({
          data: {
            distributorOrganisationId: warehouse.distributorOrganisationId,
            warehouseId: warehouse.id,
            productId: variant.productId,
            variantId: variant.id,
            batchNumber: dto.batchNumber,
            manufacturingDate: this.optionalDate(dto.manufacturingDate),
            expiryDate: this.optionalDate(dto.expiryDate),
            germinationPercentage:
              dto.germinationPercentage === undefined
                ? null
                : new Prisma.Decimal(dto.germinationPercentage),
          },
        });

        const batchAuditInput = this.withActor(actor, {
          action: 'INVENTORY_BATCH_CREATED',
          resourceType: 'InventoryBatch',
          resourceId: batch.id,
          organisationId: batch.distributorOrganisationId,
          newValue: this.batchAuditValue(batch),
        });
        this.attachAuditContext(batchAuditInput, requestId, dto.reason);
        await this.auditService.record(batchAuditInput, tx);

        if (openingQuantity > 0) {
          const movement = await this.createMovement(tx, {
            actor,
            batch,
            movementType: InventoryMovementType.OPENING_STOCK,
            quantityDelta: openingQuantity,
            balanceAfter: openingQuantity,
            reason: dto.reason,
          });
          await this.auditMovement(tx, movement, actor, requestId, dto.reason);
        }

        const savedBatch = await tx.inventoryBatch.findUniqueOrThrow({
          where: { id: batch.id },
          include: this.batchDetailInclude(),
        });

        return this.toBatchDetail(savedBatch);
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(
        error,
        'Batch number already exists for this warehouse and variant',
      );
      throw error;
    }
  }

  async updateBatch(batchId: string, dto: UpdateBatchDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.findBatchOrThrow(batchId);
    await this.ensureInventoryWrite(actor, existing.distributorOrganisationId);

    if (dto.status === InventoryBatchStatus.BLOCKED && !dto.blockedReason) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Blocked batches require a blocked reason',
      });
    }

    const data: Prisma.InventoryBatchUpdateInput = {};
    if (dto.manufacturingDate !== undefined) {
      data.manufacturingDate = this.optionalDate(dto.manufacturingDate);
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = this.optionalDate(dto.expiryDate);
    }
    if (dto.germinationPercentage !== undefined) {
      data.germinationPercentage = new Prisma.Decimal(dto.germinationPercentage);
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.blockedReason =
        dto.status === InventoryBatchStatus.BLOCKED ? (dto.blockedReason ?? null) : null;
    } else if (dto.blockedReason !== undefined) {
      data.blockedReason = dto.blockedReason;
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.update({
        where: { id: batchId },
        data,
      });

      const auditInput = this.withActor(actor, {
        action: 'INVENTORY_BATCH_UPDATED',
        resourceType: 'InventoryBatch',
        resourceId: batch.id,
        organisationId: batch.distributorOrganisationId,
        previousValue: this.batchAuditValue(existing),
        newValue: this.batchAuditValue(batch),
      });
      this.attachAuditContext(auditInput, requestId, dto.reason);
      await this.auditService.record(auditInput, tx);

      const savedBatch = await tx.inventoryBatch.findUniqueOrThrow({
        where: { id: batch.id },
        include: this.batchDetailInclude(),
      });

      return this.toBatchDetail(savedBatch);
    });
  }

  async listInventoryMovements(query: ListInventoryMovementsQueryDto, actor: CurrentUser) {
    const { page, limit, skip } = paginationOffset(query);
    const where = this.buildMovementWhere(query, actor);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: this.movementInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async createInventoryAdjustment(
    batchId: string,
    dto: CreateInventoryAdjustmentDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    if (
      dto.movementType === InventoryMovementType.OPENING_STOCK ||
      dto.movementType === InventoryMovementType.RESERVED_FOR_ORDER ||
      dto.movementType === InventoryMovementType.RELEASED_FROM_ORDER ||
      dto.movementType === InventoryMovementType.RETURN_QUARANTINED ||
      dto.movementType === InventoryMovementType.RETURN_RESTOCKED
    ) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'This inventory movement type is created only by its owning workflow',
      });
    }

    const batch = await this.findBatchOrThrow(batchId);
    await this.ensureInventoryAdjust(actor, batch.distributorOrganisationId);
    this.ensureActiveWarehouse(batch.warehouse);

    const quantityDelta = this.resolveQuantityDelta(dto.movementType, dto.quantity);

    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.currentBatchBalance(tx, batch.id);
      const balanceAfter = currentBalance + quantityDelta;

      if (balanceAfter < 0) {
        throw new BadRequestException({
          code: ApiErrorCode.VALIDATION_FAILED,
          message: 'Inventory adjustment cannot reduce batch stock below zero',
        });
      }

      const movement = await this.createMovement(tx, {
        actor,
        batch,
        movementType: dto.movementType,
        quantityDelta,
        balanceAfter,
        reason: dto.reason,
        ...(dto.referenceType ? { referenceType: dto.referenceType } : {}),
        ...(dto.referenceId ? { referenceId: dto.referenceId } : {}),
      });
      await this.auditMovement(tx, movement, actor, requestId, dto.reason);

      return movement;
    });
  }

  private async listInventoryAgeingReport(
    query: InventoryAgeingQueryDto,
    actor: CurrentUser,
    kind: InventoryAgeingReportKind,
  ) {
    const { page, limit } = paginationOffset(query);
    const lowStockThreshold = query.lowStockThreshold ?? 10;
    const expiringWithinDays = query.expiringWithinDays ?? 30;
    const where = this.buildAgeingWhere(query, actor);
    const batches = await this.prisma.inventoryBatch.findMany({
      where,
      include: this.batchInclude(),
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
    });

    const allRows = batches
      .map((batch) =>
        this.toInventoryAgeingReportItem(batch, {
          lowStockThreshold,
          expiringWithinDays,
        }),
      )
      .filter((item) => this.matchesInventoryAgeingKind(item, kind))
      .sort((left, right) => {
        const severity =
          this.alertSeverity(left.ageingBucket) - this.alertSeverity(right.ageingBucket);
        if (severity !== 0) {
          return severity;
        }

        return (
          (left.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER) -
          (right.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER)
        );
      });
    const start = (page - 1) * limit;

    return {
      items: allRows.slice(start, start + limit),
      page,
      limit,
      total: allRows.length,
      lowStockThreshold,
      expiringWithinDays,
    };
  }

  private buildWarehouseWhere(
    query: ListWarehousesQueryDto,
    actor: CurrentUser,
  ): Prisma.WarehouseWhereInput {
    const where: Prisma.WarehouseWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.q) {
      where.OR = [
        { code: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { state: { contains: query.q, mode: 'insensitive' } },
        { pincode: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_READ_ANY)) {
      if (query.distributorOrganisationId) {
        where.distributorOrganisationId = query.distributorOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_READ_OWN)) {
      where.distributorOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Warehouse read permission is required');
  }

  private buildBatchWhere(
    query: ListBatchesQueryDto,
    actor: CurrentUser,
  ): Prisma.InventoryBatchWhereInput {
    const where: Prisma.InventoryBatchWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.batchId) {
      where.id = query.batchId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.q) {
      where.OR = [
        { batchNumber: { contains: query.q, mode: 'insensitive' } },
        { warehouse: { name: { contains: query.q, mode: 'insensitive' } } },
        { product: { name: { contains: query.q, mode: 'insensitive' } } },
        { variant: { variantName: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_ANY)) {
      if (query.distributorOrganisationId) {
        where.distributorOrganisationId = query.distributorOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_OWN)) {
      where.distributorOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Inventory read permission is required');
  }

  private buildAgeingWhere(
    query: InventoryAgeingQueryDto,
    actor: CurrentUser,
  ): Prisma.InventoryBatchWhereInput {
    const where: Prisma.InventoryBatchWhereInput = {};
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_ANY)) {
      if (query.distributorOrganisationId) {
        where.distributorOrganisationId = query.distributorOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_OWN)) {
      where.distributorOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Inventory read permission is required');
  }

  private buildMovementWhere(
    query: ListInventoryMovementsQueryDto,
    actor: CurrentUser,
  ): Prisma.InventoryMovementWhereInput {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query.batchId) {
      where.batchId = query.batchId;
    }
    if (query.productId) {
      where.productId = query.productId;
    }
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.movementType) {
      where.movementType = query.movementType;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_ANY)) {
      if (query.distributorOrganisationId) {
        where.distributorOrganisationId = query.distributorOrganisationId;
      }
      return where;
    }

    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_OWN)) {
      where.distributorOrganisationId = actor.organisationId;
      return where;
    }

    throw this.forbidden('Inventory read permission is required');
  }

  private batchInclude() {
    return {
      distributorOrganisation: true,
      warehouse: true,
      product: { include: { brand: true, companyOrganisation: true } },
      variant: true,
      inventoryMovements: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    };
  }

  private batchDetailInclude() {
    return {
      distributorOrganisation: true,
      warehouse: true,
      product: { include: { brand: true, companyOrganisation: true } },
      variant: true,
      inventoryMovements: {
        include: this.movementInclude(),
        orderBy: { createdAt: 'desc' as const },
        take: 50,
      },
    };
  }

  private movementInclude() {
    return {
      warehouse: true,
      batch: true,
      product: { include: { brand: true, companyOrganisation: true } },
      variant: true,
      distributorOrganisation: true,
      createdBy: { include: { profile: true } },
    };
  }

  private toBatchView(
    batch: Prisma.InventoryBatchGetPayload<{
      include: ReturnType<InventoryService['batchInclude']>;
    }>,
  ) {
    const onHandQuantity = this.latestBalance(batch.inventoryMovements);
    const isExpired = this.isBatchExpired(batch.expiryDate);

    return {
      ...batch,
      onHandQuantity,
      sellableQuantity:
        batch.status === InventoryBatchStatus.ACTIVE && !isExpired ? onHandQuantity : 0,
      isExpired,
    };
  }

  private toBatchDetail(
    batch: Prisma.InventoryBatchGetPayload<{
      include: ReturnType<InventoryService['batchDetailInclude']>;
    }>,
  ) {
    const onHandQuantity = this.latestBalance(batch.inventoryMovements);
    const isExpired = this.isBatchExpired(batch.expiryDate);

    return {
      ...batch,
      onHandQuantity,
      sellableQuantity:
        batch.status === InventoryBatchStatus.ACTIVE && !isExpired ? onHandQuantity : 0,
      isExpired,
    };
  }

  private toInventoryAgeingReportItem(
    batch: Prisma.InventoryBatchGetPayload<{
      include: ReturnType<InventoryService['batchInclude']>;
    }>,
    options: {
      lowStockThreshold: number;
      expiringWithinDays: number;
    },
  ) {
    const stockView = this.toBatchView(batch);
    const ageInDays = this.daysBetween(batch.createdAt, this.todayStartUtc());
    const daysUntilExpiry = batch.expiryDate
      ? this.daysBetween(this.todayStartUtc(), batch.expiryDate)
      : null;
    const isExpired = stockView.isExpired || batch.status === InventoryBatchStatus.EXPIRED;
    const isBlocked = batch.status === InventoryBatchStatus.BLOCKED;
    const isLowStock =
      !isExpired &&
      !isBlocked &&
      batch.status === InventoryBatchStatus.ACTIVE &&
      stockView.sellableQuantity <= options.lowStockThreshold;
    const isExpiringSoon =
      !isExpired &&
      !isBlocked &&
      daysUntilExpiry !== null &&
      daysUntilExpiry >= 0 &&
      daysUntilExpiry <= options.expiringWithinDays;
    const ageingBucket = this.resolveAgeingBucket({
      isBlocked,
      isExpired,
      isLowStock,
      isExpiringSoon,
    });

    return {
      batch: stockView,
      distributorOrganisation: batch.distributorOrganisation,
      warehouse: batch.warehouse,
      product: batch.product,
      variant: batch.variant,
      onHandQuantity: stockView.onHandQuantity,
      sellableQuantity: stockView.sellableQuantity,
      ageInDays,
      stockAgeBucket: this.resolveStockAgeBucket(ageInDays),
      daysUntilExpiry,
      isLowStock,
      isExpiringSoon,
      isExpired,
      isBlocked,
      ageingBucket,
    };
  }

  private matchesInventoryAgeingKind(
    item: ReturnType<InventoryService['toInventoryAgeingReportItem']>,
    kind: InventoryAgeingReportKind,
  ): boolean {
    if (kind === 'LOW_STOCK') {
      return item.isLowStock;
    }
    if (kind === 'EXPIRING_SOON') {
      return item.isExpiringSoon;
    }
    return true;
  }

  private resolveAgeingBucket(input: {
    isBlocked: boolean;
    isExpired: boolean;
    isLowStock: boolean;
    isExpiringSoon: boolean;
  }): 'BLOCKED' | 'EXPIRED' | 'LOW_STOCK' | 'EXPIRING_SOON' | 'HEALTHY' {
    if (input.isBlocked) {
      return 'BLOCKED';
    }
    if (input.isExpired) {
      return 'EXPIRED';
    }
    if (input.isLowStock) {
      return 'LOW_STOCK';
    }
    if (input.isExpiringSoon) {
      return 'EXPIRING_SOON';
    }
    return 'HEALTHY';
  }

  private resolveStockAgeBucket(
    ageInDays: number,
  ): 'DAYS_0_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'DAYS_90_PLUS' {
    if (ageInDays <= 30) {
      return 'DAYS_0_30';
    }
    if (ageInDays <= 60) {
      return 'DAYS_31_60';
    }
    if (ageInDays <= 90) {
      return 'DAYS_61_90';
    }
    return 'DAYS_90_PLUS';
  }

  private alertSeverity(ageingBucket: string): number {
    const order: Record<string, number> = {
      EXPIRED: 0,
      BLOCKED: 1,
      LOW_STOCK: 2,
      EXPIRING_SOON: 3,
      HEALTHY: 4,
    };
    return order[ageingBucket] ?? 5;
  }

  private latestBalance(movements: Array<Pick<InventoryMovement, 'balanceAfter'>>): number {
    return movements[0]?.balanceAfter ?? 0;
  }

  private async resolveWritableDistributorOrganisationId(
    actor: CurrentUser,
    requestedOrganisationId?: string,
  ): Promise<string> {
    if (this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_WRITE_ANY)) {
      const distributorOrganisationId = requestedOrganisationId ?? actor.organisationId;
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return distributorOrganisationId;
    }

    if (!this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_WRITE_OWN)) {
      throw this.forbidden('Warehouse write permission is required');
    }

    if (requestedOrganisationId && requestedOrganisationId !== actor.organisationId) {
      throw this.forbidden('Users may only write warehouses for their active distributor context');
    }

    await this.ensureActiveDistributorOrganisation(actor.organisationId);
    return actor.organisationId;
  }

  private async ensureWarehouseRead(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_READ_ANY)) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_READ_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      return;
    }
    throw this.forbidden('Warehouse read permission is required');
  }

  private async ensureWarehouseWrite(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_WRITE_ANY)) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.WAREHOUSES_WRITE_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    throw this.forbidden('Warehouse write permission is required');
  }

  private async ensureInventoryRead(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_ANY)) {
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.INVENTORY_READ_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      return;
    }
    throw this.forbidden('Inventory read permission is required');
  }

  private async ensureInventoryWrite(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_WRITE_ANY)) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.INVENTORY_WRITE_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    throw this.forbidden('Inventory write permission is required');
  }

  private async ensureInventoryAdjust(
    actor: CurrentUser,
    distributorOrganisationId: string,
  ): Promise<void> {
    if (this.accessService.hasPermission(actor, PermissionCode.INVENTORY_ADJUST_ANY)) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    if (
      this.accessService.hasPermission(actor, PermissionCode.INVENTORY_ADJUST_OWN) &&
      actor.organisationId === distributorOrganisationId
    ) {
      await this.ensureActiveDistributorOrganisation(distributorOrganisationId);
      return;
    }
    throw this.forbidden('Inventory adjustment permission is required');
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
        message: 'Inventory records must belong to a distributor organisation',
      });
    }
    if (organisation.status !== OrganisationStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Distributor organisation must be active before inventory can be managed',
      });
    }
  }

  private ensureActiveWarehouse(warehouse: Warehouse): void {
    if (warehouse.status !== WarehouseStatus.ACTIVE) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Warehouse must be active before inventory can be managed',
      });
    }
  }

  private async findWarehouseOrThrow(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: {
        distributorOrganisation: true,
      },
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
      include: this.batchDetailInclude(),
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
        message: 'Inventory batches require an active product variant',
      });
    }
    if (variant.product.status !== CatalogueStatus.APPROVED) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Inventory batches require an approved master product',
      });
    }

    return variant;
  }

  private resolveQuantityDelta(movementType: InventoryMovementType, quantity: number): number {
    if (
      movementType === InventoryMovementType.MANUAL_DECREASE ||
      movementType === InventoryMovementType.DAMAGE_WRITE_OFF
    ) {
      return -quantity;
    }

    return quantity;
  }

  private async currentBatchBalance(
    tx: Prisma.TransactionClient,
    batchId: string,
  ): Promise<number> {
    const latestMovement = await tx.inventoryMovement.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });

    return latestMovement?.balanceAfter ?? 0;
  }

  private async createMovement(
    tx: Prisma.TransactionClient,
    input: {
      actor: CurrentUser;
      batch: InventoryBatch;
      movementType: InventoryMovementType;
      quantityDelta: number;
      balanceAfter: number;
      reason: string;
      referenceType?: string;
      referenceId?: string;
    },
  ) {
    return tx.inventoryMovement.create({
      data: {
        distributorOrganisationId: input.batch.distributorOrganisationId,
        warehouseId: input.batch.warehouseId,
        batchId: input.batch.id,
        productId: input.batch.productId,
        variantId: input.batch.variantId,
        movementType: input.movementType,
        quantityDelta: input.quantityDelta,
        balanceAfter: input.balanceAfter,
        reason: input.reason,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        createdByUserId: input.actor.userId,
      },
    });
  }

  private async auditMovement(
    tx: Prisma.TransactionClient,
    movement: InventoryMovement,
    actor: CurrentUser,
    requestId?: string,
    reason?: string,
  ): Promise<void> {
    const auditInput = this.withActor(actor, {
      action: 'INVENTORY_MOVEMENT_RECORDED',
      resourceType: 'InventoryMovement',
      resourceId: movement.id,
      organisationId: movement.distributorOrganisationId,
      newValue: this.movementAuditValue(movement),
    });
    this.attachAuditContext(auditInput, requestId, reason);
    await this.auditService.record(auditInput, tx);
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

  private daysBetween(start: Date, end: Date): number {
    const startUtc = new Date(start);
    startUtc.setUTCHours(0, 0, 0, 0);
    const endUtc = new Date(end);
    endUtc.setUTCHours(0, 0, 0, 0);

    return Math.floor((endUtc.getTime() - startUtc.getTime()) / 86_400_000);
  }

  private optionalDate(value?: string): Date | null {
    return value ? new Date(value) : null;
  }

  private warehouseAuditValue(warehouse: Warehouse): Prisma.InputJsonObject {
    return {
      distributorOrganisationId: warehouse.distributorOrganisationId,
      code: warehouse.code,
      name: warehouse.name,
      addressLine1: warehouse.addressLine1,
      addressLine2: warehouse.addressLine2,
      city: warehouse.city,
      state: warehouse.state,
      pincode: warehouse.pincode,
      contactName: warehouse.contactName,
      contactPhone: warehouse.contactPhone,
      status: warehouse.status,
    };
  }

  private batchAuditValue(batch: InventoryBatch): Prisma.InputJsonObject {
    return {
      distributorOrganisationId: batch.distributorOrganisationId,
      warehouseId: batch.warehouseId,
      productId: batch.productId,
      variantId: batch.variantId,
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate?.toISOString() ?? null,
      expiryDate: batch.expiryDate?.toISOString() ?? null,
      germinationPercentage: batch.germinationPercentage?.toString() ?? null,
      status: batch.status,
      blockedReason: batch.blockedReason,
    };
  }

  private movementAuditValue(movement: InventoryMovement): Prisma.InputJsonObject {
    return {
      distributorOrganisationId: movement.distributorOrganisationId,
      warehouseId: movement.warehouseId,
      batchId: movement.batchId,
      productId: movement.productId,
      variantId: movement.variantId,
      movementType: movement.movementType,
      quantityDelta: movement.quantityDelta,
      balanceAfter: movement.balanceAfter,
      reason: movement.reason,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      createdByUserId: movement.createdByUserId,
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
