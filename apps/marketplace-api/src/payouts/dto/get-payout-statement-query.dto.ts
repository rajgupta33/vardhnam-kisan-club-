import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CommissionEntryStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class GetPayoutStatementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CommissionEntryStatus })
  @IsOptional()
  @IsEnum(CommissionEntryStatus)
  status?: CommissionEntryStatus;
}
