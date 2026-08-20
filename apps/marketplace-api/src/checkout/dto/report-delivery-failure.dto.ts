import { DeliveryFailureReasonCode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportDeliveryFailureDto {
  @ApiProperty({ enum: DeliveryFailureReasonCode, example: 'FARMER_UNAVAILABLE' })
  @IsEnum(DeliveryFailureReasonCode)
  reasonCode!: DeliveryFailureReasonCode;

  @ApiPropertyOptional({ example: 'Farmer requested delivery tomorrow morning.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    example: '2026-08-15T03:30:00.000Z',
    description: 'Backend-validated UTC time for the next delivery attempt.',
  })
  @IsISO8601({ strict: true })
  retryAt!: string;
}
