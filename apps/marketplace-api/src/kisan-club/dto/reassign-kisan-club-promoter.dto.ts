import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KisanClubAssignmentReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReassignKisanClubPromoterDto {
  @ApiPropertyOptional({ description: 'Omit to use deterministic auto-matching.' })
  @IsOptional()
  @IsUUID()
  promoterUserId?: string;

  @ApiProperty({ enum: KisanClubAssignmentReason })
  @IsEnum(KisanClubAssignmentReason)
  assignmentReason!: KisanClubAssignmentReason;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
