import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateFarmerAddressDto } from './dto/create-farmer-address.dto';
import { UpdateFarmerAddressDto } from './dto/update-farmer-address.dto';
import { UpsertFarmerProfileDto } from './dto/upsert-farmer-profile.dto';
import { FarmersService } from './farmers.service';

@ApiTags('farmers')
@Controller('farmers')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class FarmersController {
  constructor(private readonly farmersService: FarmersService) {}

  @Get('me')
  @RequirePermissions(PermissionCode.FARMER_PROFILE_READ_OWN)
  getMyProfile(@CurrentUserContext() actor: CurrentUser) {
    return this.farmersService.getMyProfile(actor);
  }

  @Put('me/profile')
  @RequirePermissions(PermissionCode.FARMER_PROFILE_WRITE_OWN)
  upsertMyProfile(
    @Body() dto: UpsertFarmerProfileDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmersService.upsertMyProfile(dto, actor, getRequestId(request));
  }

  @Get('me/addresses')
  @RequirePermissions(PermissionCode.FARMER_ADDRESS_READ_OWN)
  listMyAddresses(@CurrentUserContext() actor: CurrentUser) {
    return this.farmersService.listMyAddresses(actor);
  }

  @Post('me/addresses')
  @RequirePermissions(PermissionCode.FARMER_ADDRESS_WRITE_OWN)
  createMyAddress(
    @Body() dto: CreateFarmerAddressDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmersService.createMyAddress(dto, actor, getRequestId(request));
  }

  @Patch('me/addresses/:addressId')
  @RequirePermissions(PermissionCode.FARMER_ADDRESS_WRITE_OWN)
  updateMyAddress(
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateFarmerAddressDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmersService.updateMyAddress(addressId, dto, actor, getRequestId(request));
  }
}
