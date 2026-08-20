import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignPromoterTerritoryDto {
  @ApiProperty()
  @IsUUID()
  promoterOrganisationId!: string;

  @ApiProperty()
  @IsUUID()
  territoryId!: string;
}
