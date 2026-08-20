import { ApiPropertyOptional } from '@nestjs/swagger';
import { RefundStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListRefundsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RefundStatus })
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productOrderId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  returnRequestId?: string;
}
