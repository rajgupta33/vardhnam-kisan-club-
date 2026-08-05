import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum NotificationOutcome {
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export class ConfirmNotificationAttemptDto {
  @ApiProperty({ enum: NotificationOutcome })
  @IsEnum(NotificationOutcome)
  outcome!: NotificationOutcome;

  @ApiPropertyOptional({ example: 'MOCK-SMS-000123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerReferenceId?: string;

  @ApiPropertyOptional({ example: 'MOCK_NOTIFICATION_SEND_FAILED' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorCode?: string;

  @ApiPropertyOptional({ example: 'Mock notification delivery failed for local testing.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @ApiPropertyOptional({ example: 'Staff confirmed mock delivery outcome.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
