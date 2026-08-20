import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class HarvestCropCycleDto {
  @ApiProperty({ example: '2027-04-05' })
  @IsDateString({ strict: true })
  actualHarvestDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1000000000)
  yieldQuintals?: number;
}
