import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner@company.example' })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ example: 'Example@12345' })
  @IsString()
  @MinLength(8)
  password!: string;
}
