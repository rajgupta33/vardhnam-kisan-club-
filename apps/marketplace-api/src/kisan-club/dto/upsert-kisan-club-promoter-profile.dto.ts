import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertKisanClubPromoterProfileDto {
  @ApiProperty()
  @IsUUID()
  promoterUserId!: string;

  @ApiProperty()
  @IsUUID()
  promoterOrganisationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  territoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeVillage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{6}$/)
  homePincode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  clubEnabled?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  acceptingNewFarmers?: boolean;

  @ApiPropertyOptional({ default: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  maxActiveFarmers?: number;
}
