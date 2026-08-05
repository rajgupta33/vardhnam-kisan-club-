import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMarketplaceProductsQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '302001' })
  @Matches(/^[1-9][0-9]{5}$/)
  pincode!: string;

  @ApiPropertyOptional({ example: 'Seeds' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: 'demo-seeds' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandSlug?: string;

  @ApiPropertyOptional({ example: 'bajra' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
