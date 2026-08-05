import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganisationStatus, OrganisationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrganisationDto {
  @ApiProperty({ enum: OrganisationType })
  @IsEnum(OrganisationType)
  type!: OrganisationType;

  @ApiPropertyOptional({ example: 'demo-distributor' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @ApiProperty({ example: 'Demo Distributor Private Limited' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @ApiProperty({ example: 'Demo Distributor' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstin?: string;

  @ApiPropertyOptional({ enum: OrganisationStatus })
  @IsOptional()
  @IsEnum(OrganisationStatus)
  status?: OrganisationStatus;
}
