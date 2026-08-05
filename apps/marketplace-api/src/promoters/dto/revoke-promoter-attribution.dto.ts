import { ApiProperty } from '@nestjs/swagger';
import { MaxLength, MinLength } from 'class-validator';

export class RevokePromoterAttributionDto {
  @ApiProperty({ example: 'Farmer requested a different promoter' })
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
