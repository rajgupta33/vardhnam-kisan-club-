import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export enum MockRefundOutcome {
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export class ConfirmMockRefundDto {
  @ApiProperty({ enum: MockRefundOutcome })
  @IsEnum(MockRefundOutcome)
  outcome!: MockRefundOutcome;

  @ApiPropertyOptional({ maxLength: 500 })
  @ValidateIf((dto: ConfirmMockRefundDto) => dto.outcome === MockRefundOutcome.FAILED)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  failureReason?: string;
}
