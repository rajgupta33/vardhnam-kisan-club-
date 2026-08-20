import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdvisoryCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAdvisoryRuleDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) cropName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) varietyName?: string;
  @ApiProperty({ enum: AdvisoryCategory }) @IsEnum(AdvisoryCategory) category!: AdvisoryCategory;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(1000) minDaysAfterSowing!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(1000) maxDaysAfterSowing!: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  eligibleStates?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  eligibleDistricts?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  seasons?: string[];
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) titleEn!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(4000) bodyEn!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(160) titleHi!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(4000) bodyHi!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) sourceReference?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
