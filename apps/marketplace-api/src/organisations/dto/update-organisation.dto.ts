import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganisationDto {
  @ApiPropertyOptional({ example: 'updated-distributor' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiPropertyOptional({ example: 'Updated Distributor Private Limited' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: 'Updated Distributor' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5' })
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i)
  gstin?: string;

  @ApiPropertyOptional({ example: 'Corrected legal profile from verification document.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
