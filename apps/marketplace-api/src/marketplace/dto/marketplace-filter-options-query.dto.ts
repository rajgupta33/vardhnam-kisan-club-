import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class MarketplaceFilterOptionsQueryDto {
  @ApiProperty({ example: '302001' })
  @Matches(/^[1-9][0-9]{5}$/)
  pincode!: string;
}
