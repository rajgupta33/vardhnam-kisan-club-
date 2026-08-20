import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeCategory, DisputeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListDisputesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiPropertyOptional({ enum: DisputeCategory })
  @IsOptional()
  @IsEnum(DisputeCategory)
  category?: DisputeCategory;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
