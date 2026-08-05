import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReverseCommissionEntryDto {
  @ApiProperty({ example: 'Order returned and inspected; commission reversed.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
