import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CropCycleStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCropCycleDto {
  @ApiProperty()
  @IsUUID()
  cropId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  varietyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  varietyProductId?: string;

  @ApiProperty({ example: 2.25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000000)
  areaAcres!: number;

  @ApiProperty({ example: 'RABI_2026_27' })
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,40}$/)
  season!: string;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateString({ strict: true })
  sowingDate?: string;

  @ApiPropertyOptional({ example: '2027-04-10' })
  @IsOptional()
  @IsDateString({ strict: true })
  expectedHarvestDate?: string;

  @ApiPropertyOptional({ enum: CropCycleStatus, default: CropCycleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CropCycleStatus)
  status?: CropCycleStatus;
}
