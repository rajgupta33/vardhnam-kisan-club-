import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrganisationStatus, OrganisationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ApprovalQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: [OrganisationType.COMPANY, OrganisationType.DISTRIBUTOR] })
  @IsOptional()
  @IsEnum(OrganisationType)
  type?: OrganisationType;

  @ApiPropertyOptional({
    enum: OrganisationStatus,
    default: OrganisationStatus.PENDING_VERIFICATION,
  })
  @IsOptional()
  @IsEnum(OrganisationStatus)
  status?: OrganisationStatus;

  @ApiPropertyOptional({ description: 'Only return items missing profile details.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  missingProfile?: boolean;
}
