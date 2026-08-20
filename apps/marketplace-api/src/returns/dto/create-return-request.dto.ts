import { ReturnReasonCode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateReturnRequestItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productOrderItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productOrderId!: string;

  @ApiProperty({ enum: ReturnReasonCode })
  @IsEnum(ReturnReasonCode)
  reasonCode!: ReturnReasonCode;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reasonNote?: string;

  @ApiProperty({ type: [CreateReturnRequestItemDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnRequestItemDto)
  items!: CreateReturnRequestItemDto[];
}
