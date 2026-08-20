import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateKisanClubConsentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  advisoryConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  preciseLocationConsent?: boolean;
}
