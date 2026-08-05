import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PromoterAttributionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPromoterAttributionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  promoterUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  farmerUserId?: string;

  @ApiPropertyOptional({ enum: PromoterAttributionStatus })
  @IsOptional()
  @IsEnum(PromoterAttributionStatus)
  status?: PromoterAttributionStatus;
}
