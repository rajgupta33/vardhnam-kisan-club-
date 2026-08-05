import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertCompanyProfileDto {
  @ApiPropertyOptional({ example: 'Vardhnam Seeds' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string;

  @ApiPropertyOptional({ example: 'U01100RJ2026PTC000001' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  pan?: string;

  @ApiProperty({ example: 'Ramesh Sharma' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  primaryContactName!: string;

  @ApiProperty({ example: '+919999999999' })
  @Matches(/^(\+91)?[6-9][0-9]{9}$/)
  primaryContactPhone!: string;

  @ApiPropertyOptional({ example: 'company@example.local' })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @ApiPropertyOptional({ example: 'https://example.local' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  registeredAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: '302001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  pincode?: string;

  @ApiPropertyOptional({ example: 'Initial company onboarding details.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
