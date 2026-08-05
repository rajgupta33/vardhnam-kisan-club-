import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryBatchStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListBatchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryBatchStatus })
  @IsOptional()
  @IsEnum(InventoryBatchStatus)
  status?: InventoryBatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ example: 'batch' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
