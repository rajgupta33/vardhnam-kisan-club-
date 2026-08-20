import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RetryDeliveryDto {
  @ApiPropertyOptional({ example: 'Starting the scheduled second delivery attempt.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
