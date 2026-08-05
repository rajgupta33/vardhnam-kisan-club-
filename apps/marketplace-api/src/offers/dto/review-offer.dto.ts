import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export enum OfferReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewOfferDto {
  @ApiProperty({ enum: OfferReviewDecision })
  @IsEnum(OfferReviewDecision)
  decision!: OfferReviewDecision;

  @ApiProperty({ example: 'Offer price, stock and serviceability verified.' })
  @ValidateIf((dto: ReviewOfferDto) => dto.decision === OfferReviewDecision.REJECT)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
