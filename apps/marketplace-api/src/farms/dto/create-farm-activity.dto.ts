import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FarmActivityType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFarmActivityDto {
  @ApiProperty({ enum: FarmActivityType })
  @IsEnum(FarmActivityType)
  activityType!: FarmActivityType;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString({ strict: true })
  occurredOn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productOrderId?: string;
}
