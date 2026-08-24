import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { DashboardsService } from './dashboards.service';
import { DashboardSummaryResponseDto } from './dto/dashboard-response.dto';

@ApiTags('dashboards')
@Controller('dashboards')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('summary')
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  @RequirePermissions(PermissionCode.DASHBOARDS_READ)
  getSummary(@CurrentUserContext() actor: CurrentUser) {
    return this.dashboardsService.getSummary(actor);
  }

  @Get('summary/export')
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  @RequirePermissions(PermissionCode.DASHBOARDS_EXPORT)
  exportSummary(@CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.dashboardsService.exportSummary(actor, getRequestId(request));
  }
}
