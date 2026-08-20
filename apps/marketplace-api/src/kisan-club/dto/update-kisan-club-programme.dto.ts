import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { KisanClubProgrammeStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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

export class UpdateKisanClubProgrammeDto {
  @ApiPropertyOptional({ enum: KisanClubProgrammeStatus })
  @IsOptional()
  @IsEnum(KisanClubProgrammeStatus)
  status?: KisanClubProgrammeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-10000)
  @Max(10000)
  displayPriority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
