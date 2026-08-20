import { ApiPropertyOptional } from '@nestjs/swagger';
import { FarmerLeadSource, FarmerLeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListFarmerLeadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FarmerLeadStatus })
  @IsOptional()
  @IsEnum(FarmerLeadStatus)
  status?: FarmerLeadStatus;

  @ApiPropertyOptional({ enum: FarmerLeadSource })
  @IsOptional()
  @IsEnum(FarmerLeadSource)
  source?: FarmerLeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
