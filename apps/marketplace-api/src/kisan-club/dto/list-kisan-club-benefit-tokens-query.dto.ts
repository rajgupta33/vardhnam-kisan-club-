import { ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubBenefitTokenStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKisanClubBenefitTokensQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KisanClubBenefitTokenStatus })
  @IsOptional()
  @IsEnum(KisanClubBenefitTokenStatus)
  status?: KisanClubBenefitTokenStatus;
}
