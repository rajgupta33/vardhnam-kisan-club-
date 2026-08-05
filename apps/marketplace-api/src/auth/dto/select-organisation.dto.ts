import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class SelectOrganisationDto {
  @ApiProperty({ description: 'Short-lived selection token returned by otp/verify or login' })
  @IsString()
  selectionToken!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organisationId!: string;
}
