import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPaymentIntentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter mock payment intents by an owned checkout.' })
  @IsOptional()
  @IsUUID()
  checkoutId?: string;
}
