import { ApiProperty } from '@nestjs/swagger';
import { ReturnInspectionOutcome } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InspectReturnDispositionDto {
  @ApiProperty()
  @IsUUID()
  returnRequestItemId!: string;

  @ApiProperty()
  @IsUUID()
  reservationId!: string;

  @ApiProperty({ enum: ReturnInspectionOutcome })
  @IsEnum(ReturnInspectionOutcome)
  outcome!: ReturnInspectionOutcome;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class InspectReturnRequestDto {
  @ApiProperty({ type: [InspectReturnDispositionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectReturnDispositionDto)
  dispositions!: InspectReturnDispositionDto[];

  @ApiProperty({ example: 'Packages opened and batch labels verified' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  inspectionNote!: string;
}
