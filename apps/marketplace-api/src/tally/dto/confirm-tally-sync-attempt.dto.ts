import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TallySyncOutcome {
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export class ConfirmTallySyncAttemptDto {
  @ApiProperty({ enum: TallySyncOutcome })
  @IsEnum(TallySyncOutcome)
  outcome!: TallySyncOutcome;

  @ApiPropertyOptional({ example: 'MOCK-TALLY-VCH-000123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tallyReferenceId?: string;

  @ApiPropertyOptional({ example: 'MOCK_TALLY_SYNC_FAILED' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorCode?: string;

  @ApiPropertyOptional({ example: 'Mock Tally sync failed for local testing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @ApiPropertyOptional({ example: 'Staff confirmed mock Tally sync outcome.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
