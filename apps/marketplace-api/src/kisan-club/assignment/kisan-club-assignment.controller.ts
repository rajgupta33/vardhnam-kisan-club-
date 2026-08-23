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
import { CreatePromoterTerritoryDto } from '../dto/create-promoter-territory.dto';
import { ListKisanClubPromoterProfilesQueryDto } from '../dto/list-kisan-club-promoter-profiles-query.dto';
import { ListPromoterTerritoriesQueryDto } from '../dto/list-promoter-territories-query.dto';
import { ReassignKisanClubPromoterDto } from '../dto/reassign-kisan-club-promoter.dto';
import { UpdatePromoterTerritoryDto } from '../dto/update-promoter-territory.dto';
import { UpsertKisanClubPromoterProfileDto } from '../dto/upsert-kisan-club-promoter-profile.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubAssignmentService } from './kisan-club-assignment.service';
import { KisanClubPromoterAdminService } from './kisan-club-promoter-admin.service';

@ApiTags('kisan-club')
@Controller('kisan-club')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubAssignmentController {
  constructor(
    private readonly assignmentService: KisanClubAssignmentService,
    private readonly promoterAdminService: KisanClubPromoterAdminService,
  ) {}

  // Declared before the parameterised territory routes so `options` is never
  // parsed as a territory id. Permissions are checked in the service: either
  // territory or promoter-profile management may read this, and
  // @RequirePermissions can only express AND.
  @Get('territories/options')
  listTerritoryOptions(@CurrentUserContext() actor: CurrentUser) {
    return this.promoterAdminService.listTerritoryOptions(actor);
  }

  @Get('territories')
  @RequirePermissions(PermissionCode.KISAN_CLUB_TERRITORIES_MANAGE)
  listTerritories(@Query() query: ListPromoterTerritoriesQueryDto) {
    return this.promoterAdminService.listTerritories(query);
  }

  @Post('territories')
  @RequirePermissions(PermissionCode.KISAN_CLUB_TERRITORIES_MANAGE)
  createTerritory(
    @Body() dto: CreatePromoterTerritoryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promoterAdminService.createTerritory(dto, actor, getRequestId(request));
  }

  @Patch('territories/:territoryId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_TERRITORIES_MANAGE)
  updateTerritory(
    @Param('territoryId', ParseUUIDPipe) territoryId: string,
    @Body() dto: UpdatePromoterTerritoryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promoterAdminService.updateTerritory(
      territoryId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('promoter-profiles')
  @RequirePermissions(PermissionCode.KISAN_CLUB_PROMOTER_PROFILES_MANAGE)
  listPromoterProfiles(@Query() query: ListKisanClubPromoterProfilesQueryDto) {
    return this.promoterAdminService.listPromoterProfiles(query);
  }

  @Post('promoter-profiles')
  @RequirePermissions(PermissionCode.KISAN_CLUB_PROMOTER_PROFILES_MANAGE)
  upsertPromoterProfile(
    @Body() dto: UpsertKisanClubPromoterProfileDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promoterAdminService.upsertPromoterProfile(dto, actor, getRequestId(request));
  }

  @Post('memberships/:membershipId/reassign-promoter')
  @RequirePermissions(PermissionCode.KISAN_CLUB_ASSIGNMENTS_MANAGE)
  reassignPromoter(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: ReassignKisanClubPromoterDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.assignmentService.reassignPromoter(
      membershipId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('promoter/me')
  @RequirePermissions(PermissionCode.KISAN_CLUB_MEMBERSHIP_READ_OWN)
  getMyPromoter(@CurrentUserContext() actor: CurrentUser) {
    return this.assignmentService.getMyPromoter(actor);
  }

  @Get('promoter/farmers')
  @RequirePermissions(PermissionCode.KISAN_CLUB_FARMERS_READ_OWN)
  listMyAssignedFarmers(@CurrentUserContext() actor: CurrentUser) {
    return this.assignmentService.listMyAssignedFarmers(actor);
  }

  @Get('promoter/farmers/:membershipId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_FARMERS_READ_OWN)
  getMyAssignedFarmer(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.assignmentService.getMyAssignedFarmer(membershipId, actor);
  }
}
