import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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

export class CreateKisanClubProgrammeDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Matches(/^\d{6}$/, { each: true })
  eligiblePincodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  eligibleDistricts?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-10000)
  @Max(10000)
  displayPriority?: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
