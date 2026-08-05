import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganisationStatus, OrganisationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListOrganisationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrganisationType })
  @IsOptional()
  @IsEnum(OrganisationType)
  type?: OrganisationType;

  @ApiPropertyOptional({ enum: OrganisationStatus })
  @IsOptional()
  @IsEnum(OrganisationStatus)
  status?: OrganisationStatus;

  @ApiPropertyOptional({ description: 'Searches slug, legal name, display name and GSTIN.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
