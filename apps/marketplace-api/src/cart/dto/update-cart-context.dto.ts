import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateCartContextDto {
  @ApiPropertyOptional({
    description: 'Used when no farmerAddressId is supplied.',
    example: '302001',
  })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  serviceablePincode?: string;

  @ApiPropertyOptional({
    description: 'Owned farmer address whose pincode should become the cart pincode.',
  })
  @IsOptional()
  @IsUUID()
  farmerAddressId?: string;

  @ApiPropertyOptional({ example: 'Farmer selected default delivery address.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
