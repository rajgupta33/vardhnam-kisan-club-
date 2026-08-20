import { ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubBenefitStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKisanClubBenefitRulesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KisanClubBenefitStatus })
  @IsOptional()
  @IsEnum(KisanClubBenefitStatus)
  status?: KisanClubBenefitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programmeId?: string;
}
