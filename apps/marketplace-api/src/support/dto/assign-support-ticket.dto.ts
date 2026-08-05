import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssignSupportTicketDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignedToUserId!: string;

  @ApiPropertyOptional({ example: 'Assigning to the fulfilment support queue' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
