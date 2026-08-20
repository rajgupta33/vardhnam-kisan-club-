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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreatePromoterAttributionDto } from './dto/create-promoter-attribution.dto';
import { AssignPromoterTerritoryDto } from './dto/assign-promoter-territory.dto';
import { CreateFarmerLeadDto } from './dto/create-farmer-lead.dto';
import { ListFarmerLeadsQueryDto } from './dto/list-farmer-leads-query.dto';
import { ListPromoterAttributionsQueryDto } from './dto/list-promoter-attributions-query.dto';
import { RevokePromoterAttributionDto } from './dto/revoke-promoter-attribution.dto';
import { UpdateFarmerLeadDto } from './dto/update-farmer-lead.dto';
import { VerifyAssistedFarmerOtpDto } from './dto/verify-assisted-farmer-otp.dto';
import { PromotersService } from './promoters.service';

@ApiTags('promoters')
@Controller('promoters')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PromotersController {
  constructor(private readonly promotersService: PromotersService) {}

  @Get('territories/me')
  @RequirePermissions(PermissionCode.PROMOTER_TERRITORIES_READ_OWN)
  getMyTerritory(@CurrentUserContext() actor: CurrentUser) {
    return this.promotersService.getMyTerritory(actor);
  }

  @Put('territory-assignments/:promoterUserId')
  @RequirePermissions(PermissionCode.PROMOTER_TERRITORIES_MANAGE_ANY)
  assignTerritory(
    @Param('promoterUserId', ParseUUIDPipe) promoterUserId: string,
    @Body() dto: AssignPromoterTerritoryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.assignTerritory(
      promoterUserId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post('leads')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_CREATE_OWN)
  createLead(
    @Body() dto: CreateFarmerLeadDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.createLead(dto, actor, getRequestId(request));
  }

  @Get('leads/me')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_READ_OWN)
  listMyLeads(@Query() query: ListFarmerLeadsQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.promotersService.listMyLeads(query, actor);
  }

  @Get('leads')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_READ_ANY)
  listLeads(@Query() query: ListFarmerLeadsQueryDto) {
    return this.promotersService.listLeads(query);
  }

  @Get('leads/:leadId')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_READ_OWN)
  getLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.promotersService.getLead(leadId, actor);
  }

  @Patch('leads/:leadId')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_MANAGE_OWN)
  updateLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: UpdateFarmerLeadDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.updateLead(leadId, dto, actor, getRequestId(request));
  }

  @Post('leads/:leadId/convert')
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_MANAGE_OWN)
  convertLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.convertLead(leadId, actor, getRequestId(request));
  }

  @Post('leads/:leadId/farmer-otp/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_MANAGE_OWN)
  requestAssistedFarmerOtp(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.requestAssistedFarmerOtp(
      leadId,
      actor,
      getRequestId(request),
      request.ip,
    );
  }

  @Post('leads/:leadId/farmer-otp/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions(PermissionCode.PROMOTER_LEADS_MANAGE_OWN)
  verifyAssistedFarmerOtp(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: VerifyAssistedFarmerOtpDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.promotersService.verifyAssistedFarmerOtp(
      leadId,
      dto,
      actor,
      getRequestId(request),
    );
  }

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
