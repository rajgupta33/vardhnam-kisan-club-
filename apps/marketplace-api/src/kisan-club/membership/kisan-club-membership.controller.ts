import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../../access/permission-codes';
import { PermissionsGuard } from '../../access/permissions.guard';
import { RequirePermissions } from '../../access/require-permissions.decorator';
import { CurrentUserContext } from '../../auth/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.interface';
import { MockAuthGuard } from '../../auth/mock-auth.guard';
import { getRequestId } from '../../common/middleware/correlation-id.middleware';
import { CloseKisanClubMembershipDto } from '../dto/close-kisan-club-membership.dto';
import { CreateKisanClubMembershipDto } from '../dto/create-kisan-club-membership.dto';
import { ListKisanClubMembershipsQueryDto } from '../dto/list-kisan-club-memberships-query.dto';
import { SuspendKisanClubMembershipDto } from '../dto/suspend-kisan-club-membership.dto';
import { UpdateKisanClubConsentsDto } from '../dto/update-kisan-club-consents.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubMembershipService } from './kisan-club-membership.service';

@ApiTags('kisan-club')
@Controller('kisan-club')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubMembershipController {
  constructor(private readonly membershipService: KisanClubMembershipService) {}

  @Post('membership')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIP_WRITE_OWN)
  createMembership(
    @Body() dto: CreateKisanClubMembershipDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.membershipService.createMembership(dto, actor, getRequestId(request));
  }

  @Get('membership/me')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIP_READ_OWN)
  getMyMembership(@CurrentUserContext() actor: CurrentUser) {
    return this.membershipService.getMyMembership(actor);
  }

  @Patch('membership/me/consents')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIP_WRITE_OWN)
  updateMyConsents(
    @Body() dto: UpdateKisanClubConsentsDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.membershipService.updateMyConsents(dto, actor, getRequestId(request));
  }

  @Post('membership/me/close')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIP_WRITE_OWN)
  closeMyMembership(
    @Body() dto: CloseKisanClubMembershipDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.membershipService.closeMyMembership(dto, actor, getRequestId(request));
  }

  @Get('memberships')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIPS_READ_ANY)
  listMemberships(@Query() query: ListKisanClubMembershipsQueryDto) {
    return this.membershipService.listMemberships(query);
  }

  @Get('memberships/:membershipId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIPS_READ_ANY)
  getMembership(@Param('membershipId', ParseUUIDPipe) membershipId: string) {
    return this.membershipService.getMembership(membershipId);
  }

  @Post('memberships/:membershipId/suspend')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIPS_MANAGE)
  suspendMembership(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: SuspendKisanClubMembershipDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.membershipService.suspendMembership(
      membershipId,
      dto,
      actor,
      getRequestId(request),
    );
  }
}
