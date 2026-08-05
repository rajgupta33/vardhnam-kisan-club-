import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListFulfilmentOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductOrderStatus })
  @IsOptional()
  @IsEnum(ProductOrderStatus)
  status?: ProductOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerOrganisationId?: string;

  @ApiPropertyOptional({ example: 'PO-20260803' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
