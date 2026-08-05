import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum MockPaymentOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export class ConfirmMockPaymentIntentDto {
  @ApiProperty({ enum: MockPaymentOutcome })
  @IsEnum(MockPaymentOutcome)
  outcome!: MockPaymentOutcome;

  @ApiPropertyOptional({ example: 'MOCK_DECLINED' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  failureCode?: string;

  @ApiPropertyOptional({ example: 'Mock payment was declined for local testing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureMessage?: string;

  @ApiPropertyOptional({ example: 'Farmer completed mock payment confirmation.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
