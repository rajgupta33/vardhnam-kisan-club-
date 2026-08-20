import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReturnTransitionDto {
  @ApiPropertyOptional({ example: 'Return items and quantities verified' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
