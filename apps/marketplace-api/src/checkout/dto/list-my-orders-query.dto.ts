import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMyOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductOrderStatus })
  @IsOptional()
  @IsEnum(ProductOrderStatus)
  status?: ProductOrderStatus;
}
