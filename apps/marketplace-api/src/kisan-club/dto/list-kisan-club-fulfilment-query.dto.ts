import { ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubFulfilmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKisanClubFulfilmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KisanClubFulfilmentStatus })
  @IsOptional()
  @IsEnum(KisanClubFulfilmentStatus)
  status?: KisanClubFulfilmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  promoterUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productOrderId?: string;
}
