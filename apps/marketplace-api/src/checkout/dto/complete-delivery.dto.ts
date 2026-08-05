import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CompleteDeliveryDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  otpCode!: string;

  @ApiPropertyOptional({ example: 'Delivered to farmer and OTP verified.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  proofNote?: string;
}
