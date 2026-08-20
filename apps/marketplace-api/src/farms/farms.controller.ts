import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { KisanClubEnabledGuard } from '../kisan-club/kisan-club-enabled.guard';
import { CreateCropCycleDto } from './dto/create-crop-cycle.dto';
import { CreateFarmActivityDto } from './dto/create-farm-activity.dto';
import { CreateFarmDto } from './dto/create-farm.dto';
import { CreateFarmSurveyDto } from './dto/create-farm-survey.dto';
import { HarvestCropCycleDto } from './dto/harvest-crop-cycle.dto';
import { UpdateCropCycleDto } from './dto/update-crop-cycle.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmsService } from './farms.service';

@ApiTags('farms')
@Controller('farms')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get('reference/crops')
  listReferenceCrops() {
    return this.farmsService.listReferenceCrops();
  }

  @Get()
  @RequirePermissions(PermissionCode.FARMS_READ_OWN)
  listMyFarms(@CurrentUserContext() actor: CurrentUser) {
    return this.farmsService.listMyFarms(actor);
  }

  @Post()
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  createMyFarm(
    @Body() dto: CreateFarmDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.createMyFarm(dto, actor, getRequestId(request));
  }

  @Post('surveys')
  @RequirePermissions(PermissionCode.FARM_SURVEYS_CREATE)
  createAssignedFarmSurvey(
    @Body() dto: CreateFarmSurveyDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.createAssignedFarmSurvey(dto, actor, getRequestId(request));
  }

  @Patch(':farmId')
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  updateMyFarm(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Body() dto: UpdateFarmDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.updateMyFarm(farmId, dto, actor, getRequestId(request));
  }

  @Get(':farmId/crop-cycles')
  @RequirePermissions(PermissionCode.FARMS_READ_OWN)
  listMyCropCycles(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.farmsService.listMyCropCycles(farmId, actor);
  }

  @Post(':farmId/crop-cycles')
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  createMyCropCycle(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Body() dto: CreateCropCycleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.createMyCropCycle(farmId, dto, actor, getRequestId(request));
  }

  @Patch(':farmId/crop-cycles/:cycleId')
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  updateMyCropCycle(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: UpdateCropCycleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.updateMyCropCycle(
      farmId,
      cycleId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':farmId/crop-cycles/:cycleId/harvest')
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  harvestMyCropCycle(
    @Param('farmId', ParseUUIDPipe) farmId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: HarvestCropCycleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.harvestMyCropCycle(
      farmId,
      cycleId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('crop-cycles/:cycleId/activities')
  @RequirePermissions(PermissionCode.FARMS_READ_OWN)
  listMyActivities(
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.farmsService.listMyActivities(cycleId, actor);
  }

  @Post('crop-cycles/:cycleId/activities')
  @RequirePermissions(PermissionCode.FARMS_WRITE_OWN)
  createMyActivity(
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: CreateFarmActivityDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.createMyActivity(cycleId, dto, actor, getRequestId(request));
  }
}
