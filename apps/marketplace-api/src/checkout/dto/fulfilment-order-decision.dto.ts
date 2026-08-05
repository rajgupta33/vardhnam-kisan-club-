import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FulfilmentOrderDecisionDto {
  @ApiPropertyOptional({ example: 'Distributor confirmed stock and SLA' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
