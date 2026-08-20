import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateAttributedFarmSurveyDto } from './dto/create-attributed-farm-survey.dto';
import { FarmsService } from './farms.service';

@ApiTags('promoters')
@Controller('promoters/surveys')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PromoterSurveysController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get('reference/crops')
  @RequirePermissions(PermissionCode.FARM_SURVEYS_CREATE)
  listReferenceCrops() {
    return this.farmsService.listReferenceCrops();
  }

  @Post()
  @RequirePermissions(PermissionCode.FARM_SURVEYS_CREATE)
  createSurvey(
    @Body() dto: CreateAttributedFarmSurveyDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.farmsService.createAttributedFarmSurvey(
      dto,
      actor,
      getRequestId(request),
    );
  }
}
