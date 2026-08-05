import { ApiPropertyOptional } from '@nestjs/swagger';
import { KycDocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateKycDocumentDto {
  @ApiPropertyOptional({ enum: KycDocumentStatus })
  @IsOptional()
  @IsEnum(KycDocumentStatus)
  status?: KycDocumentStatus;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'gst-certificate.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @ApiPropertyOptional({ example: 'mock/kyc/gst-certificate.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  storageKey?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '2027-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'Document is unreadable.' })
  @ValidateIf((dto: UpdateKycDocumentDto) => dto.status === KycDocumentStatus.REJECTED)
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @ApiPropertyOptional({ example: 'KYC document reviewed.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
