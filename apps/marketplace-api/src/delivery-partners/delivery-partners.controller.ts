import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { DeliveryPartnersService } from './delivery-partners.service';
import { UpdateDeliveryPartnerAvailabilityDto } from './dto/update-delivery-partner-availability.dto';

@ApiTags('delivery-partners')
@Controller('delivery-partners')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class DeliveryPartnersController {
  constructor(private readonly deliveryPartnersService: DeliveryPartnersService) {}

  @Get('me')
  @RequirePermissions(PermissionCode.DELIVERY_PARTNER_PROFILE_READ_OWN)
  getMyProfile(@CurrentUserContext() actor: CurrentUser) {
    return this.deliveryPartnersService.getMyProfile(actor);
  }

  @Put('me/availability')
  @RequirePermissions(PermissionCode.DELIVERY_PARTNER_PROFILE_WRITE_OWN)
  updateMyAvailability(
    @Body() dto: UpdateDeliveryPartnerAvailabilityDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.deliveryPartnersService.updateMyAvailability(dto, actor, getRequestId(request));
  }
}
