import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  returnRequestId!: string;
}
