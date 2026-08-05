import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMockPaymentIntentDto {
  @ApiProperty({
    description: 'Owned product checkout that is ready for mock payment.',
  })
  @IsUUID()
  checkoutId!: string;

  @ApiPropertyOptional({ example: 'Farmer started mock payment from checkout review.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
