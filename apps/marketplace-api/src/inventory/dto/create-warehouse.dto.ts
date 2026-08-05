import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiPropertyOptional({
    description: 'Required for admin-created warehouses outside distributor context.',
  })
  @IsOptional()
  @IsUUID()
  distributorOrganisationId?: string;

  @ApiProperty({ example: 'JPR-01' })
  @IsString()
  @Matches(/^[A-Z0-9-]{2,32}$/)
  code!: string;

  @ApiProperty({ example: 'Jaipur Main Warehouse' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Plot 12, Agri Market Road' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Near Mandi Gate' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine2?: string;

  @ApiProperty({ example: 'Jaipur' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiProperty({ example: 'Rajasthan' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state!: string;

  @ApiProperty({ example: '302001' })
  @Matches(/^[1-9][0-9]{5}$/)
  pincode!: string;

  @ApiPropertyOptional({ example: 'Ramesh Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ example: '+919999999999' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Initial warehouse setup.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
