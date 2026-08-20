import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsBoolean,
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

  @ApiPropertyOptional({ example: '1001', description: '4 to 8 digit HSN code.' })
  @IsOptional()
  @Matches(/^[0-9]{4,8}$/)
  hsnCode?: string;

  @ApiPropertyOptional({ example: 500, description: 'GST rate in basis points; 500 = 5%.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  gstRateBps?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Initial pack size.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
