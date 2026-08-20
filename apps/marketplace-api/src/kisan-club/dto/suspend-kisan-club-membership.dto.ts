import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SuspendKisanClubMembershipDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
