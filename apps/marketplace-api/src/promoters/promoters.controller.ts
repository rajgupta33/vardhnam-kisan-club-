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
import { CreatePromoterAttributionDto } from './dto/create-promoter-attribution.dto';
import { ListPromoterAttributionsQueryDto } from './dto/list-promoter-attributions-query.dto';
import { RevokePromoterAttributionDto } from './dto/revoke-promoter-attribution.dto';
import { PromotersService } from './promoters.service';

@ApiTags('promoters')
@Controller('promoters')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PromotersController {
  constructor(private readonly promotersService: PromotersService) {}

  @Post('attributions')
  @RequirePermissions(PermissionCode.PROMOTER_ATTRIBUTIONS_CREATE)
  createAttribution(
    @Body() dto: CreatePromoterAttributionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.createAttribution(dto, actor, getRequestId(request));
  }

  @Post('attributions/:attributionId/revoke')
  @RequirePermissions(PermissionCode.PROMOTER_ATTRIBUTIONS_REVOKE)
  revokeAttribution(
    @Param('attributionId', ParseUUIDPipe) attributionId: string,
    @Body() dto: RevokePromoterAttributionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.revokeAttribution(
      attributionId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('attributions')
  @RequirePermissions(PermissionCode.PROMOTER_ATTRIBUTIONS_READ_ANY)
  listAttributions(@Query() query: ListPromoterAttributionsQueryDto) {
    return this.promotersService.listAttributions(query);
  }

  @Get('attributions/me')
  @RequirePermissions(PermissionCode.PROMOTER_ATTRIBUTIONS_READ_OWN)
  listMyAttributions(
    @Query() query: ListPromoterAttributionsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.promotersService.listMyAttributions(actor, query);
  }
}
