import { ApiPropertyOptional } from '@nestjs/swagger';
import { CropCycleStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class KisanClubCropIntelligenceQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cropId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  season?: string;

  @ApiPropertyOptional({ enum: CropCycleStatus })
  @IsOptional()
  @IsEnum(CropCycleStatus)
  status?: CropCycleStatus;
}
