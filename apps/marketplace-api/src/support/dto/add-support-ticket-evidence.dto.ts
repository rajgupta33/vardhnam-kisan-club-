import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddSupportTicketEvidenceDto {
  @ApiProperty({ example: 'delivery-photo.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'mock/support/ticket-id/delivery-photo.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  storageKey!: string;
}
