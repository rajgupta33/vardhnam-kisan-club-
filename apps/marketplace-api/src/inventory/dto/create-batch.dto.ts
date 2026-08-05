import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000100' })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000101' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ example: 'BATCH-2026-08' })
  @IsString()
  @Matches(/^[A-Za-z0-9 ._-]{2,80}$/)
  batchNumber!: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @ApiPropertyOptional({ example: '2027-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 92.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  germinationPercentage?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  openingQuantity?: number;

  @ApiProperty({ example: 'Opening batch stock after physical count.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
