import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogueStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListCatalogueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CatalogueStatus })
  @IsOptional()
  @IsEnum(CatalogueStatus)
  status?: CatalogueStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyOrganisationId?: string;

  @ApiPropertyOptional({ example: 'seed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
