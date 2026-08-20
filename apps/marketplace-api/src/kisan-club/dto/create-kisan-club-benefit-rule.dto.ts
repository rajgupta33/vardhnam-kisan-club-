import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { KisanClubBenefitType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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

export class CreateKisanClubBenefitRuleDto {
  @ApiProperty()
  @IsUUID()
  programmeId!: string;

  @ApiProperty({ enum: KisanClubBenefitType })
  @IsEnum(KisanClubBenefitType)
  benefitType!: KisanClubBenefitType;

  @ApiPropertyOptional({ description: 'Per-unit benefit in paise for flat and threshold rules' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  flatAmountPaise?: number;

  @ApiPropertyOptional({ description: 'Percentage in basis points; 10000 is 100%' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  percentBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBenefitPaise?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumQuantity?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Matches(/^\d{6}$/, { each: true })
  eligiblePincodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(250)
  @IsUUID('4', { each: true })
  eligibleCropIds?: string[];

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalUsageLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perMemberUsageLimit?: number;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
