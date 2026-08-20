import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum DisputeInfoTarget {
  FARMER = 'FARMER',
  DISTRIBUTOR = 'DISTRIBUTOR',
}

export class RequestDisputeInfoDto {
  @ApiProperty({ enum: DisputeInfoTarget })
  @IsEnum(DisputeInfoTarget)
  target!: DisputeInfoTarget;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}
