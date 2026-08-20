import { ApiProperty } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class NotificationPreferenceItemDto {
  @ApiProperty({ example: 'ADVISORY' })
  @IsString()
  @MaxLength(100)
  category!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
