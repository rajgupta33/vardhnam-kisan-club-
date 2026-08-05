import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}

export interface PaginatedResult<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
}

export function paginationOffset(query: PaginationQueryDto): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
