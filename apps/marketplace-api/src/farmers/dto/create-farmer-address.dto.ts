import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateFarmerAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @ApiProperty({ example: 'Ramesh Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @ApiProperty({ example: '+919999999999' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ example: 'Khasra 42, Rampura Road' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  addressLine1!: string;

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

  @ApiProperty({ example: 'Jaipur' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({ example: 'Jaipur' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  district?: string;

  @ApiProperty({ example: 'Rajasthan' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state!: string;

  @ApiPropertyOptional({ example: '08', description: 'GST state code; derived when omitted.' })
  @IsOptional()
  @Matches(/^[0-9]{2}$/)
  stateCode?: string;

  @ApiProperty({ example: '302001' })
  @Matches(/^[1-9][0-9]{5}$/)
  pincode!: string;

  @ApiPropertyOptional({ example: 'Blue gate' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
