import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitOfferDto {
  @ApiPropertyOptional({ example: 'Ready for distributor offer review.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
