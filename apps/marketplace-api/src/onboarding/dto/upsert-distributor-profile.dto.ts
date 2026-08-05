import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertDistributorProfileDto {
  @ApiPropertyOptional({ example: 'DIST-JAI-001' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  distributorCode?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  pan?: string;

  @ApiProperty({ example: 'Suresh Jain' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  primaryContactName!: string;

  @ApiProperty({ example: '+919999999999' })
  @Matches(/^(\+91)?[6-9][0-9]{9}$/)
  primaryContactPhone!: string;

  @ApiPropertyOptional({ example: 'distributor@example.local' })
  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operatingAddress?: string;

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

  @ApiPropertyOptional({ example: ['302001', '302002'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(250)
  @Matches(/^[1-9][0-9]{5}$/, { each: true })
  serviceablePincodes?: string[];

  @ApiPropertyOptional({ example: 'Own delivery and Vardhnam-assisted pickup.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  fulfilmentCapability?: string;

  @ApiPropertyOptional({ example: 'Initial distributor onboarding details.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
