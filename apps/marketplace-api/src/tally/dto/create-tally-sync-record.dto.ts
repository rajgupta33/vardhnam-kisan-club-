import { ApiPropertyOptional } from '@nestjs/swagger';
import { TallySyncRecordType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTallySyncRecordDto {
  @ApiPropertyOptional({ enum: TallySyncRecordType })
  @IsEnum(TallySyncRecordType)
  recordType!: TallySyncRecordType;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for PARTY_MASTER' })
  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for ITEM_MASTER' })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for INVOICE' })
  @IsOptional()
  @IsUUID()
  productInvoiceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for SETTLEMENT' })
  @IsOptional()
  @IsUUID()
  settlementId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for COMMISSION_INVOICE' })
  @IsOptional()
  @IsUUID()
  commissionEntryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for CREDIT_NOTE and RECEIPT' })
  @IsOptional()
  @IsUUID()
  financialLedgerEntryId?: string;

  @ApiPropertyOptional({ description: 'Required for VOUCHER' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  referenceLabel?: string;

  @ApiPropertyOptional({ description: 'Required for VOUCHER' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Enqueued for month-end Tally sync' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
