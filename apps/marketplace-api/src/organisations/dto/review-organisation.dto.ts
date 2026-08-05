import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export enum OrganisationReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewOrganisationDto {
  @ApiProperty({ enum: OrganisationReviewDecision })
  @IsEnum(OrganisationReviewDecision)
  decision!: OrganisationReviewDecision;

  @ApiProperty({ example: 'GST and distributor details verified.' })
  @ValidateIf((dto: ReviewOrganisationDto) => dto.decision === OrganisationReviewDecision.REJECT)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
