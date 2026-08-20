import { PromoterVisitLocationStatus, PromoterVisitPurpose } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePromoterVisitDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  farmerLeadId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  farmerProfileId?: string;

  @ApiProperty({ enum: PromoterVisitPurpose })
  @IsEnum(PromoterVisitPurpose)
  purpose!: PromoterVisitPurpose;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ example: '2026-08-16T10:30:00.000Z' })
  @IsISO8601({ strict: true })
  occurredAt!: string;

  @ApiProperty({ enum: PromoterVisitLocationStatus })
  @IsEnum(PromoterVisitLocationStatus)
  locationStatus!: PromoterVisitLocationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Device-reported accuracy in metres.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  accuracyMetres?: number;

  @ApiPropertyOptional({ example: '2026-08-16T10:30:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  locationCapturedAt?: string;
}
