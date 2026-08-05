import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @ApiProperty({ enum: InventoryMovementType, example: InventoryMovementType.STOCK_RECEIVED })
  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000000)
  quantity!: number;

  @ApiProperty({ example: 'Physical stock count verified by warehouse manager.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ example: 'GRN' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceType?: string;

  @ApiPropertyOptional({ example: 'GRN-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}
