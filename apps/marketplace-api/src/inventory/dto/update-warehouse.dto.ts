import { ApiPropertyOptional } from '@nestjs/swagger';
import { WarehouseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ example: 'Jaipur Main Warehouse' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Plot 12, Agri Market Road' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Near Mandi Gate' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Jaipur' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Rajasthan' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  state?: string;

  @ApiPropertyOptional({ example: '302001' })
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/)
  pincode?: string;

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

  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional({ example: 'Correcting warehouse contact details.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
