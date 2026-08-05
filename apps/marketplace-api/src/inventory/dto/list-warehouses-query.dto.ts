import { ApiPropertyOptional } from '@nestjs/swagger';
import { WarehouseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListWarehousesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiPropertyOptional({ example: 'jaipur' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
