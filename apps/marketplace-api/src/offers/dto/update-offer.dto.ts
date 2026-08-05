import { ApiPropertyOptional } from '@nestjs/swagger';
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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOfferDto {
  @ApiPropertyOptional({ example: 'OFFER-KHARIF-002' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9 ._-]{2,80}$/)
  offerCode?: string;

  @ApiPropertyOptional({ example: 120000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000000)
  sellingPricePaise?: number;

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

  @ApiPropertyOptional({ enum: FulfilmentMode })
  @IsOptional()
  @IsEnum(FulfilmentMode)
  fulfilmentMode?: FulfilmentMode;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  deliverySlaDays?: number;

  @ApiPropertyOptional({ example: 'Corrected pricing before review.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
