import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PayoutAccountStatus } from '@prisma/client';

export class VerifyPayoutAccountDto {
  @ApiProperty({ enum: [PayoutAccountStatus.VERIFIED, PayoutAccountStatus.REJECTED] })
  @IsEnum(PayoutAccountStatus)
  status!: PayoutAccountStatus;

  @ApiPropertyOptional({ example: 'IFSC does not match the stated bank name' })
  @ValidateIf((dto: VerifyPayoutAccountDto) => dto.status === PayoutAccountStatus.REJECTED)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
