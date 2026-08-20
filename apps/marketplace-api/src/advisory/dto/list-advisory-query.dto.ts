import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdvisoryCategory, AdvisoryEventStatus, AdvisoryRuleStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAdvisoryRulesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AdvisoryRuleStatus })
  @IsOptional()
  @IsEnum(AdvisoryRuleStatus)
  status?: AdvisoryRuleStatus;
  @ApiPropertyOptional({ enum: AdvisoryCategory })
  @IsOptional()
  @IsEnum(AdvisoryCategory)
  category?: AdvisoryCategory;
}

export class ListMyAdvisoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AdvisoryEventStatus })
  @IsOptional()
  @IsEnum(AdvisoryEventStatus)
  status?: AdvisoryEventStatus;
}
