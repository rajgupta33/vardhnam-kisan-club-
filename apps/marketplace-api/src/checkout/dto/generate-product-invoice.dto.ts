import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateProductInvoiceDto {
  @ApiPropertyOptional({ example: 'Invoice generated after packing verification.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
