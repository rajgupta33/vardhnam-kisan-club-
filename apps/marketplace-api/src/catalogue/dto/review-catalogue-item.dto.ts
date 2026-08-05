import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export enum CatalogueReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewCatalogueItemDto {
  @ApiProperty({ enum: CatalogueReviewDecision })
  @IsEnum(CatalogueReviewDecision)
  decision!: CatalogueReviewDecision;

  @ApiProperty({ example: 'Catalogue metadata verified.' })
  @ValidateIf((dto: ReviewCatalogueItemDto) => dto.decision === CatalogueReviewDecision.REJECT)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
