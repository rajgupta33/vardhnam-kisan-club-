import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertPayoutAccountDto {
  @ApiProperty({ example: 'Demo Delivery Partner' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  accountHolderName!: string;

  @ApiProperty({ example: 'State Bank of India' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName!: string;

  @ApiProperty({ example: '000123456789' })
  @IsString()
  @Matches(/^[0-9]{6,20}$/)
  accountNumber!: string;

  @ApiProperty({ example: 'SBIN0001234' })
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
  ifscCode!: string;

  @ApiPropertyOptional({ example: 'demo@upi' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  upiId?: string;
}
