import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyPackagePickupDto {
  @ApiProperty({ example: 'VARDHNAM-PICKUP:00000000-0000-4000-8000-000000004901:token' })
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  packageQrCode!: string;
}
