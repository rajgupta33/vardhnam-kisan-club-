import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PayoutAccountStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPayoutAccountsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PayoutAccountStatus })
  @IsOptional()
  @IsEnum(PayoutAccountStatus)
  status?: PayoutAccountStatus;
}
