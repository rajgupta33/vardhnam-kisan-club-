import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FarmerLeadSource } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFarmerLeadDto {
  @ApiProperty({ example: 'Ram Singh' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '+919876543210' })
  @Matches(/^(\+91)?[6-9][0-9]{9}$/)
  phone!: string;

  @ApiProperty({ enum: FarmerLeadSource })
  @IsEnum(FarmerLeadSource)
  source!: FarmerLeadSource;

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

  @ApiPropertyOptional({ example: '207001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  pincode?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  cropInterests?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
