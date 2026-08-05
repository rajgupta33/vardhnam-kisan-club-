import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductDocumentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductDocumentDto {
  @ApiProperty({ enum: ProductDocumentType })
  @IsEnum(ProductDocumentType)
  documentType!: ProductDocumentType;

  @ApiProperty({ example: 'Product label' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ example: 'REG-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'label.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @ApiPropertyOptional({ example: 'mock/catalogue/label.pdf' })
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

  @ApiPropertyOptional({ example: 'Adding product label metadata.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
