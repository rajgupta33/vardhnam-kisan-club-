import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromoterTerritoryStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePromoterTerritoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  state!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  district!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  blocks?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Matches(/^\d{6}$/, { each: true })
  pincodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  villages?: string[];

  @ApiPropertyOptional({ enum: PromoterTerritoryStatus })
  @IsOptional()
  @IsEnum(PromoterTerritoryStatus)
  status?: PromoterTerritoryStatus;
}
