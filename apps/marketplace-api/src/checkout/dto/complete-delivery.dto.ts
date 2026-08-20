import { DeliveryProofLocationStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CompleteDeliveryDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  otpCode!: string;

  @ApiPropertyOptional({ example: 'Delivered to farmer and OTP verified.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofNote?: string;

  @ApiProperty({ enum: DeliveryProofLocationStatus, example: 'GRANTED' })
  @IsEnum(DeliveryProofLocationStatus)
  proofLocationStatus!: DeliveryProofLocationStatus;

  @ApiPropertyOptional({ example: 20.593684 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  proofLatitude?: number;

  @ApiPropertyOptional({ example: 78.96288 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  proofLongitude?: number;

  @ApiPropertyOptional({ example: 12.5, description: 'Device-reported accuracy in metres.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  proofAccuracyMetres?: number;

  @ApiPropertyOptional({ example: '2026-08-14T08:30:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  proofLocationCapturedAt?: string;
}
