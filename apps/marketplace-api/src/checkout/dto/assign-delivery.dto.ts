import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignDeliveryDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000004209' })
  @IsUUID()
  deliveryPartnerUserId!: string;

  @ApiPropertyOptional({ example: 'Assigned to local route partner for pickup.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
