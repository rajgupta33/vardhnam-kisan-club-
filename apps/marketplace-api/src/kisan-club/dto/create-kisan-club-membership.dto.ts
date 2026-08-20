import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateKisanClubMembershipDto {
  @ApiProperty({ example: '207001' })
  @Matches(/^\d{6}$/)
  homePincode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeVillage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeDistrict?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeState?: string;

  @ApiProperty({ example: '2026-08-11' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/\S/)
  termsVersion!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  termsAccepted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  referredByMembershipId?: string;
}
