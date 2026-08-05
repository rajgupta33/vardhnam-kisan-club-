import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionsGuard } from '../access/permissions.guard';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateBatchDto } from './dto/create-batch.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { InventoryAgeingQueryDto } from './dto/inventory-ageing-query.dto';
import { ListBatchesQueryDto } from './dto/list-batches-query.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses')
  listWarehouses(@Query() query: ListWarehousesQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.inventoryService.listWarehouses(query, actor);
  }

  @Post('warehouses')
  createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.inventoryService.createWarehouse(dto, actor, getRequestId(request));
  }

  @Get('warehouses/:warehouseId')
  getWarehouse(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.getWarehouse(warehouseId, actor);
  }

  @Patch('warehouses/:warehouseId')
  updateWarehouse(
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.inventoryService.updateWarehouse(warehouseId, dto, actor, getRequestId(request));
  }

  @Get('batches')
  listBatches(@Query() query: ListBatchesQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.inventoryService.listBatches(query, actor);
  }

  @Get('reports/ageing')
  listInventoryAgeing(
    @Query() query: InventoryAgeingQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.listInventoryAgeing(query, actor);
  }

  @Get('reports/low-stock')
  listLowStockInventory(
    @Query() query: InventoryAgeingQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.listLowStockInventory(query, actor);
  }

  @Get('reports/expiring-batches')
  listExpiringInventory(
    @Query() query: InventoryAgeingQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.listExpiringInventory(query, actor);
  }

  @Post('batches')
  createBatch(
    @Body() dto: CreateBatchDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.inventoryService.createBatch(dto, actor, getRequestId(request));
  }

  @Get('batches/:batchId')
  getBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.getBatch(batchId, actor);
  }

  @Patch('batches/:batchId')
  updateBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: UpdateBatchDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.inventoryService.updateBatch(batchId, dto, actor, getRequestId(request));
  }

  @Post('batches/:batchId/adjustments')
  createInventoryAdjustment(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: CreateInventoryAdjustmentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.inventoryService.createInventoryAdjustment(
      batchId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('movements')
  listInventoryMovements(
    @Query() query: ListInventoryMovementsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.inventoryService.listInventoryMovements(query, actor);
  }
}
