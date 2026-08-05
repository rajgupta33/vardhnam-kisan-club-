import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckoutFromCartDto {
  @ApiPropertyOptional({
    description:
      'Owned farmer address to use for checkout. Required when the cart has no selected delivery address.',
  })
  @IsOptional()
  @IsUUID()
  farmerAddressId?: string;

  @ApiPropertyOptional({ example: 'Farmer confirmed checkout from cart.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
