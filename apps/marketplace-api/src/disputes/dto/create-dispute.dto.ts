import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productOrderId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  returnRequestId?: string;

  @ApiProperty({ enum: DisputeCategory })
  @IsEnum(DisputeCategory)
  category!: DisputeCategory;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;
}
