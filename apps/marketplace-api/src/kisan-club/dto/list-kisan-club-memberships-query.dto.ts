import { ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubMembershipStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListKisanClubMembershipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: KisanClubMembershipStatus })
  @IsOptional()
  @IsEnum(KisanClubMembershipStatus)
  status?: KisanClubMembershipStatus;

  @ApiPropertyOptional({ description: 'Staff-only search by member number or farmer name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
