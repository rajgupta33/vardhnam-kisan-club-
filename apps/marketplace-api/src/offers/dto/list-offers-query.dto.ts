import { ApiPropertyOptional } from '@nestjs/swagger';
import { DistributorOfferStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListOffersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DistributorOfferStatus })
  @IsOptional()
  @IsEnum(DistributorOfferStatus)
  status?: DistributorOfferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ example: '302001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  serviceablePincode?: string;

  @ApiPropertyOptional({ example: 'hybrid seed' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
