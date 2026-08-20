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
import { AdvisoryEventStatus } from '@prisma/client';
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
import { AdvisoryService } from './advisory.service';
import { CreateAdvisoryRuleDto } from './dto/create-advisory-rule.dto';
import { ListAdvisoryRulesQueryDto, ListMyAdvisoriesQueryDto } from './dto/list-advisory-query.dto';
import { AdvisoryActionDto, ReviewAdvisoryRuleDto } from './dto/review-advisory-rule.dto';
import { UpdateAdvisoryRuleDto } from './dto/update-advisory-rule.dto';

@ApiTags('advisory')
@Controller('advisory')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class AdvisoryController {
  constructor(private readonly service: AdvisoryService) {}

  @Get('rules')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  listRules(@Query() query: ListAdvisoryRulesQueryDto) {
    return this.service.listRules(query);
  }

  @Get('rules/:id')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  getRule(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRule(id);
  }

  @Post('rules')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  createRule(
    @Body() dto: CreateAdvisoryRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.createRule(dto, actor, getRequestId(request));
  }

  @Patch('rules/:id')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdvisoryRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.updateRule(id, dto, actor, getRequestId(request));
  }

  @Post('rules/:id/submit')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  submitRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvisoryActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.submitRule(id, dto.reason, actor, getRequestId(request));
  }

  @Post('rules/:id/review')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_REVIEW)
  reviewRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAdvisoryRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.reviewRule(id, dto, actor, getRequestId(request));
  }

  @Post('rules/:id/archive')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  archiveRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvisoryActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.archiveRule(id, dto.reason, actor, getRequestId(request));
  }

  @Post('generate')
  @RequirePermissions(PermissionCode.ADVISORY_RULES_MANAGE)
  generate(@CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.service.generate(actor, getRequestId(request));
  }

  @Get('me')
  @RequirePermissions(PermissionCode.ADVISORY_READ_OWN)
  listMine(@Query() query: ListMyAdvisoriesQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.service.listMine(query, actor);
  }

  @Get('me/:id')
  @RequirePermissions(PermissionCode.ADVISORY_READ_OWN)
  getMine(@Param('id', ParseUUIDPipe) id: string, @CurrentUserContext() actor: CurrentUser) {
    return this.service.getMine(id, actor);
  }

  @Post('me/:id/read')
  @RequirePermissions(PermissionCode.ADVISORY_READ_OWN)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.markMine(id, AdvisoryEventStatus.READ, actor, getRequestId(request));
  }

  @Post('me/:id/dismiss')
  @RequirePermissions(PermissionCode.ADVISORY_READ_OWN)
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.markMine(id, AdvisoryEventStatus.DISMISSED, actor, getRequestId(request));
  }
}
