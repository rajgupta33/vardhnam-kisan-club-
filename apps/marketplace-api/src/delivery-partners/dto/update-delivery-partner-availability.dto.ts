import { ApiProperty } from '@nestjs/swagger';
import { DeliveryPartnerAvailabilityStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDeliveryPartnerAvailabilityDto {
  @ApiProperty({ enum: DeliveryPartnerAvailabilityStatus })
  @IsEnum(DeliveryPartnerAvailabilityStatus)
  availabilityStatus!: DeliveryPartnerAvailabilityStatus;
}
