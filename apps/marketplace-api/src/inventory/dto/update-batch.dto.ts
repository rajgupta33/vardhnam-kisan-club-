import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryBatchStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBatchDto {
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

  @ApiPropertyOptional({ enum: InventoryBatchStatus })
  @IsOptional()
  @IsEnum(InventoryBatchStatus)
  status?: InventoryBatchStatus;

  @ApiPropertyOptional({ example: 'Physical quarantine pending company confirmation.' })
  @ValidateIf((dto: UpdateBatchDto) => dto.status === InventoryBatchStatus.BLOCKED)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  blockedReason?: string;

  @ApiProperty({ example: 'Correcting batch expiry metadata.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
