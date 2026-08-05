import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipientUserId!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: 'SUPPORT_TICKET_ASSIGNED' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  category!: string;

  @ApiProperty({ example: 'Your support ticket was assigned' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'A support agent has been assigned to your ticket.' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'SupportTicket' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedResourceType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  relatedResourceId?: string;

  @ApiPropertyOptional({ example: 'Triggered by ticket assignment' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
