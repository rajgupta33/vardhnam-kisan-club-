import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiPropertyOptional({ example: 'SEED-BAJRA-1KG' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiProperty({ example: '1 kg pack' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  variantName!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(100000)
  packSize!: number;

  @ApiProperty({ example: 'kg' })
  @Matches(/^[A-Za-z0-9 .-]{1,24}$/)
  packUnit!: string;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  mrpPaise?: number;

  @ApiPropertyOptional({ example: 'Initial pack size.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
