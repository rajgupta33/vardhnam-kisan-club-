import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBrandDto {
  @ApiPropertyOptional({
    description: 'Required for admin-created records outside active company context.',
  })
  @IsOptional()
  @IsUUID()
  companyOrganisationId?: string;

  @ApiProperty({ example: 'Vardhnam Seeds' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'vardhnam-seeds' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.local' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ example: 'Initial brand record.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
