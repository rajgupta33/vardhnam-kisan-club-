import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubBenefitStatus, KisanClubBenefitType } from '@prisma/client';
import { Type } from 'class-transformer';
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

export class UpdateKisanClubBenefitRuleDto {
  @ApiPropertyOptional({ enum: KisanClubBenefitStatus })
  @IsOptional()
  @IsEnum(KisanClubBenefitStatus)
  status?: KisanClubBenefitStatus;

  @ApiPropertyOptional({ enum: KisanClubBenefitType })
  @IsOptional()
  @IsEnum(KisanClubBenefitType)
  benefitType?: KisanClubBenefitType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  flatAmountPaise?: number;

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

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
