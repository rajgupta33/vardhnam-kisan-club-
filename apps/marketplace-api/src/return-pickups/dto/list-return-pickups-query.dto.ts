import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnPickupAssignmentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListReturnPickupsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReturnPickupAssignmentStatus })
  @IsOptional()
  @IsEnum(ReturnPickupAssignmentStatus)
  status?: ReturnPickupAssignmentStatus;
}
