import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FarmerLeadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateFarmerLeadDto } from './create-farmer-lead.dto';

export class UpdateFarmerLeadDto extends PartialType(CreateFarmerLeadDto) {
  @ApiPropertyOptional({ enum: FarmerLeadStatus })
  @IsOptional()
  @IsEnum(FarmerLeadStatus)
  status?: FarmerLeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  statusReason?: string;
}
