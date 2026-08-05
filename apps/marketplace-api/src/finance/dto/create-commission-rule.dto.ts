import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCommissionRuleDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Distributor organisation this rule overrides for. Omit for the global default.',
  })
  @IsOptional()
  @IsUUID()
  sellerOrganisationId?: string;

  @ApiProperty({ example: 500, minimum: 0, maximum: 10000, description: 'Basis points (500 = 5%)' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  marketplaceCommissionBps!: number;

  @ApiProperty({ example: 'Initial marketplace commission rate' })
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
