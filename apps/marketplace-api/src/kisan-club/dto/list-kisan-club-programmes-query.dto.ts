import { ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubProgrammeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKisanClubProgrammesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KisanClubProgrammeStatus })
  @IsOptional()
  @IsEnum(KisanClubProgrammeStatus)
  status?: KisanClubProgrammeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;
}
