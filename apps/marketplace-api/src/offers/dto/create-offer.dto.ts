import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FulfilmentMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOfferDto {
  @ApiPropertyOptional({ example: '00000000-0000-4000-8000-000000000200' })
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000101' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000100' })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: '00000000-0000-4000-8000-000000000102' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ example: 'OFFER-KHARIF-001' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9 ._-]{2,80}$/)
  offerCode?: string;

  @ApiProperty({ example: 125000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000000)
  sellingPricePaise!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  maximumOrderQuantity?: number;

  @ApiPropertyOptional({ example: ['302001', '302002'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @Matches(/^[1-9][0-9]{5}$/, { each: true })
  serviceablePincodes?: string[];

  @ApiProperty({ enum: FulfilmentMode })
  @IsEnum(FulfilmentMode)
  fulfilmentMode!: FulfilmentMode;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  deliverySlaDays?: number;

  @ApiPropertyOptional({ example: 'Distributor offer created for Kharif demand.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
