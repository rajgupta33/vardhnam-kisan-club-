import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus, PlatformRole } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  recipientUserId!: string;

  @ApiProperty({ enum: NotificationChannel })
  channel!: NotificationChannel;

  @ApiProperty({ example: 'SUPPORT_TICKET_ASSIGNED' })
  category!: string;

  @ApiProperty({ example: 'Your support ticket was assigned' })
  title!: string;

  @ApiProperty({ example: 'A support agent has been assigned to your ticket.' })
  body!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  payloadSnapshot!: Record<string, unknown> | null;

  @ApiProperty({ enum: NotificationStatus })
  status!: NotificationStatus;

  @ApiProperty({ minimum: 0 })
  attemptCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastAttemptAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastErrorCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastErrorMessage!: string | null;

  @ApiProperty({ type: String, nullable: true })
  providerReferenceId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  relatedResourceType!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  relatedResourceId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  triggeredByUserId!: string | null;

  @ApiProperty({ enum: PlatformRole, nullable: true })
  triggeredByRole!: PlatformRole | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class NotificationPageDataResponseDto {
  @ApiProperty({ type: () => [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class NotificationPageResponseDto {
  @ApiProperty({ type: () => NotificationPageDataResponseDto })
  data!: NotificationPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class NotificationDispatchDataResponseDto {
  @ApiProperty({ format: 'uuid' })
  notificationId!: string;

  @ApiProperty({ example: true })
  queued!: boolean;
}

export class NotificationDispatchResponseDto {
  @ApiProperty({ type: () => NotificationDispatchDataResponseDto })
  data!: NotificationDispatchDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
