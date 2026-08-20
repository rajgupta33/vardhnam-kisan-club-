import { PartialType } from '@nestjs/swagger';
import { CreatePromoterTerritoryDto } from './create-promoter-territory.dto';

export class UpdatePromoterTerritoryDto extends PartialType(CreatePromoterTerritoryDto) {}
