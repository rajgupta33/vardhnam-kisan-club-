import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertFarmerProfileDto {
  @ApiProperty({ example: 'Ramesh Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternatePhone?: string;

  @ApiPropertyOptional({ example: 'hi-IN', default: 'en-IN' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  preferredLocale?: string;

  @ApiPropertyOptional({ example: 'Rampura' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  village?: string;

  @ApiPropertyOptional({ example: 'Jaipur' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @ApiPropertyOptional({ example: 'Rajasthan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: '302001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  primaryPincode?: string;

  @ApiPropertyOptional({ example: ['Bajra', 'Wheat'], type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  cropInterests?: string[];
}
