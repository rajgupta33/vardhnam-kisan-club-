import { ApiPropertyOptional } from '@nestjs/swagger';
import { PromoterTerritoryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPromoterTerritoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PromoterTerritoryStatus })
  @IsOptional()
  @IsEnum(PromoterTerritoryStatus)
  status?: PromoterTerritoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
