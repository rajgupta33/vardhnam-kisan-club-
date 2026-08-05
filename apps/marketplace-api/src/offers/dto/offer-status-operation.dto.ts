import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class OfferStatusOperationDto {
  @ApiProperty({ example: 'Temporarily paused due to distributor stock reconciliation.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
