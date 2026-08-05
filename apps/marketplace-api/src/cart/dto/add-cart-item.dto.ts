import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000900' })
  @IsUUID()
  offerId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 999 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Used when no farmerAddressId is supplied.',
    example: '302001',
  })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  serviceablePincode?: string;

  @ApiPropertyOptional({
    description: 'Owned farmer address whose pincode should be used for cart validation.',
  })
  @IsOptional()
  @IsUUID()
  farmerAddressId?: string;

  @ApiPropertyOptional({ example: 'Farmer selected the 1 kg pack from marketplace detail.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
