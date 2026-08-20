import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { CreateCropCycleDto } from './create-crop-cycle.dto';
import { CreateFarmDto } from './create-farm.dto';

export class CreateFarmSurveyDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string;

  @ApiProperty({ type: CreateFarmDto })
  @ValidateNested()
  @Type(() => CreateFarmDto)
  farm!: CreateFarmDto;

  @ApiPropertyOptional({ type: CreateCropCycleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCropCycleDto)
  cropCycle?: CreateCropCycleDto;
}
