import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class MarkSupportTicketWaitingDto {
  @ApiProperty({
    enum: [SupportTicketStatus.WAITING_FOR_CUSTOMER, SupportTicketStatus.WAITING_FOR_SELLER],
  })
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @ApiPropertyOptional({ example: 'Waiting on the farmer to confirm delivery details' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
