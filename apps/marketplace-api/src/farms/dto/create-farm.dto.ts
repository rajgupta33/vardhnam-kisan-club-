import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FarmOwnershipType, IrrigationSource } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFarmDto {
  @ApiProperty({ example: 'North field' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiProperty({ example: '207001' })
  @Matches(/^\d{6}$/)
  pincode!: string;

  @ApiProperty({ example: 2.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000000)
  areaAcres!: number;

  @ApiProperty({ enum: FarmOwnershipType })
  @IsEnum(FarmOwnershipType)
  ownershipType!: FarmOwnershipType;

  @ApiPropertyOptional({ enum: IrrigationSource })
  @IsOptional()
  @IsEnum(IrrigationSource)
  irrigationSource?: IrrigationSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  soilType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
