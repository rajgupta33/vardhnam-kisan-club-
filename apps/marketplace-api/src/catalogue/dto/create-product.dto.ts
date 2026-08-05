import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000100' })
  @IsUUID()
  brandId!: string;

  @ApiProperty({ example: 'Hybrid Bajra Seed' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'hybrid-bajra-seed' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ example: 'Seeds' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: ['Bajra', 'Millet'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  cropTargets?: string[];

  @ApiPropertyOptional({ example: 'Initial product master.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
