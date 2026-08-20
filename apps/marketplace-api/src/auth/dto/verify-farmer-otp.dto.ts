import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';

export class VerifyFarmerOtpDto {
  @ApiProperty({ example: '+919999999999' })
  @Matches(/^(\+91)?[6-9][0-9]{9}$/)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiProperty({ enum: ['en-IN', 'hi-IN'], example: 'hi-IN' })
  @IsIn(['en-IN', 'hi-IN'])
  preferredLocale!: 'en-IN' | 'hi-IN';
}
