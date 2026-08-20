import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReassignKisanClubFulfilmentDto {
  @ApiProperty()
  @IsUUID()
  promoterUserId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
