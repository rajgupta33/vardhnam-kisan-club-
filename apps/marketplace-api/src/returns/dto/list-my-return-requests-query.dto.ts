import { ReturnRequestStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMyReturnRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReturnRequestStatus })
  @IsOptional()
  @IsEnum(ReturnRequestStatus)
  status?: ReturnRequestStatus;
}
