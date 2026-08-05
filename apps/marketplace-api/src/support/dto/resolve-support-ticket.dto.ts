import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveSupportTicketDto {
  @ApiProperty({ example: 'Delivery confirmed with the farmer over a call; issue resolved.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  resolutionNote!: string;
}
