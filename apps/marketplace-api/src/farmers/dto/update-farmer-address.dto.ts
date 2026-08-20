import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateFarmerAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label?: string;

  @ApiPropertyOptional({ example: 'Ramesh Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName?: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Khasra 42, Rampura Road' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Near Primary School' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Rampura' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  village?: string;

  @ApiPropertyOptional({ example: 'Jaipur' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Jaipur' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @ApiPropertyOptional({ example: 'Rajasthan' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: '08' })
  @IsOptional()
  @Matches(/^[0-9]{2}$/)
  stateCode?: string;

  @ApiPropertyOptional({ example: '302001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  pincode?: string;

  @ApiPropertyOptional({ example: 'Blue gate' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
