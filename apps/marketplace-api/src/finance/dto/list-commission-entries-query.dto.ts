import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CommissionEntryStatus, CommissionEntryType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCommissionEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerOrganisationId?: string;

  @ApiPropertyOptional({ enum: CommissionEntryType })
  @IsOptional()
  @IsEnum(CommissionEntryType)
  entryType?: CommissionEntryType;

  @ApiPropertyOptional({ enum: CommissionEntryStatus })
  @IsOptional()
  @IsEnum(CommissionEntryStatus)
  status?: CommissionEntryStatus;
}
