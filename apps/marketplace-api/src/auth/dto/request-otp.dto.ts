import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+919999999999' })
  @Matches(/^(\+91)?[6-9][0-9]{9}$/)
  phone!: string;
}
