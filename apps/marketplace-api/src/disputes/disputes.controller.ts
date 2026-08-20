import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { AssignDisputeDto } from './dto/assign-dispute.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeNoteDto } from './dto/dispute-note.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { RequestDisputeInfoDto } from './dto/request-dispute-info.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  createDispute(@Body() dto: CreateDisputeDto, @CurrentUserContext() actor: CurrentUser, @Headers('idempotency-key') idempotencyKey: string | undefined, @Req() request: Request) {
    return this.disputesService.createDispute(dto, actor, idempotencyKey, getRequestId(request));
  }

  @Get('me')
  @RequirePermissions(PermissionCode.DISPUTES_READ_OWN)
  listMyDisputes(@Query() query: ListDisputesQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.disputesService.listMyDisputes(query, actor);
  }

  @Get()
  listDisputes(@Query() query: ListDisputesQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.disputesService.listDisputes(query, actor);
  }

  @Get(':disputeId')
  getDispute(@Param('disputeId', ParseUUIDPipe) disputeId: string, @CurrentUserContext() actor: CurrentUser) {
    return this.disputesService.getDispute(disputeId, actor);
  }

  @Post(':disputeId/assign')
  @RequirePermissions(PermissionCode.DISPUTES_MANAGE)
  assignDispute(@Param('disputeId', ParseUUIDPipe) disputeId: string, @Body() dto: AssignDisputeDto, @CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.disputesService.assignDispute(disputeId, dto, actor, getRequestId(request));
  }

  @Post(':disputeId/notes')
  addNote(@Param('disputeId', ParseUUIDPipe) disputeId: string, @Body() dto: DisputeNoteDto, @CurrentUserContext() actor: CurrentUser, @Headers('idempotency-key') idempotencyKey: string | undefined, @Req() request: Request) {
    return this.disputesService.addNote(disputeId, dto, actor, idempotencyKey, getRequestId(request));
  }

  @Post(':disputeId/request-info')
  @RequirePermissions(PermissionCode.DISPUTES_MANAGE)
  requestInformation(@Param('disputeId', ParseUUIDPipe) disputeId: string, @Body() dto: RequestDisputeInfoDto, @CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.disputesService.requestInformation(disputeId, dto, actor, getRequestId(request));
  }

  @Post(':disputeId/resolve')
  @RequirePermissions(PermissionCode.DISPUTES_RESOLVE)
  resolveDispute(@Param('disputeId', ParseUUIDPipe) disputeId: string, @Body() dto: ResolveDisputeDto, @CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.disputesService.resolveDispute(disputeId, dto, actor, getRequestId(request));
  }

  @Post(':disputeId/close')
  @RequirePermissions(PermissionCode.DISPUTES_RESOLVE)
  closeDispute(@Param('disputeId', ParseUUIDPipe) disputeId: string, @Body() dto: DisputeNoteDto, @CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.disputesService.closeDispute(disputeId, dto, actor, getRequestId(request));
  }
}
