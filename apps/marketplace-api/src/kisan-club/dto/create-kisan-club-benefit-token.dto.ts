import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateKisanClubBenefitTokenDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  offerId!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}
