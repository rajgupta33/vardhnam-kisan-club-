import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListReturnRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReturnRequestStatus })
  @IsOptional()
  @IsEnum(ReturnRequestStatus)
  status?: ReturnRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiPropertyOptional({ example: 'VA-20260811' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
