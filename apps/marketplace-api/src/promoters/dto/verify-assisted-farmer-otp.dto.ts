import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

export class VerifyAssistedFarmerOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @ApiProperty({ enum: ['en-IN', 'hi-IN'], example: 'hi-IN' })
  @IsIn(['en-IN', 'hi-IN'])
  preferredLocale!: 'en-IN' | 'hi-IN';
}
