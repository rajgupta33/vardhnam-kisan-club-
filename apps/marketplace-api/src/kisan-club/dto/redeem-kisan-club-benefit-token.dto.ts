import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RedeemKisanClubBenefitTokenDto {
  @ApiProperty({ example: 'VKC-A1B2C3D4-782165' })
  @IsString()
  @Matches(/^VKC-[A-F0-9]{8}-\d{6}$/i)
  code!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  membershipId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Farmer-owned delivery address. The default address is used when omitted.',
  })
  @IsOptional()
  @IsUUID()
  farmerAddressId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
