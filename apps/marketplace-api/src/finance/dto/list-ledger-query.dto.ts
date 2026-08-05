import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { FinancialLedgerEntryType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListLedgerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FinancialLedgerEntryType })
  @IsOptional()
  @IsEnum(FinancialLedgerEntryType)
  entryType?: FinancialLedgerEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organisationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productOrderId?: string;
}
