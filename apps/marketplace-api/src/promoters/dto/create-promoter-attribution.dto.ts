import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePromoterAttributionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  promoterUserId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  farmerUserId!: string;

  @ApiProperty({ example: 'Promoter assisted this farmer with onboarding' })
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
