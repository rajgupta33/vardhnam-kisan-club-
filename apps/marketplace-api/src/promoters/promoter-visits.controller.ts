import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreatePromoterVisitDto } from './dto/create-promoter-visit.dto';
import { ListPromoterVisitsQueryDto } from './dto/list-promoter-visits-query.dto';
import { PromoterVisitsService } from './promoter-visits.service';

@ApiTags('promoter visits')
@Controller('promoters/visits')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PromoterVisitsController {
  constructor(private readonly visitsService: PromoterVisitsService) {}

  @Post()
  @RequirePermissions(PermissionCode.PROMOTER_VISITS_CREATE_OWN)
  create(
    @Body() dto: CreatePromoterVisitDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.visitsService.create(dto, actor, getRequestId(request));
  }

  @Get('me')
  @RequirePermissions(PermissionCode.PROMOTER_VISITS_READ_OWN)
  listMine(@Query() query: ListPromoterVisitsQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.visitsService.list(query, actor.userId, actor.organisationId);
  }

  @Get()
  @RequirePermissions(PermissionCode.PROMOTER_VISITS_READ_ANY)
  list(@Query() query: ListPromoterVisitsQueryDto) {
    return this.visitsService.list(query);
  }

  @Get(':visitId')
  @RequirePermissions(PermissionCode.PROMOTER_VISITS_READ_OWN)
  get(@Param('visitId', ParseUUIDPipe) visitId: string, @CurrentUserContext() actor: CurrentUser) {
    return this.visitsService.get(visitId, actor);
  }
}
