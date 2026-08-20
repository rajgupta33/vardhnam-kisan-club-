import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { CreateCropCycleDto } from './create-crop-cycle.dto';

export class UpdateCropCycleDto extends PartialType(CreateCropCycleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(1000000000)
  yieldQuintals?: number;
}
