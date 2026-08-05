import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCatalogueItemDto {
  @ApiPropertyOptional({ example: 'Ready for catalogue review.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
