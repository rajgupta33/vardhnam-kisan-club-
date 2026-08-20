import { ApiProperty } from '@nestjs/swagger';
import { DisputeResolutionOutcome } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeResolutionOutcome })
  @IsEnum(DisputeResolutionOutcome)
  outcome!: DisputeResolutionOutcome;

  @ApiProperty({ minimum: 0, maximum: 2147483647, description: 'Farmer award in paise; must be zero for a distributor outcome.' })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  resolutionAmountPaise!: number;

  @ApiProperty({ minLength: 3, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  resolutionNote!: string;
}
