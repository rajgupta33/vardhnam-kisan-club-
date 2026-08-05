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
import { AddSupportTicketEvidenceDto } from './dto/add-support-ticket-evidence.dto';
import { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import { MarkSupportTicketWaitingDto } from './dto/mark-support-ticket-waiting.dto';
import { ResolveSupportTicketDto } from './dto/resolve-support-ticket.dto';
import { SupportTicketActionDto } from './dto/support-ticket-action.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('support')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_CREATE_OWN)
  createTicket(
    @Body() dto: CreateSupportTicketDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.createTicket(dto, actor, getRequestId(request));
  }

  @Get('tickets')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_READ_ANY)
  listTickets(@Query() query: ListSupportTicketsQueryDto) {
    return this.supportService.listTickets(query);
  }

  @Get('tickets/me')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_READ_OWN)
  listMyTickets(
    @Query() query: ListSupportTicketsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.supportService.listMyTickets(actor, query);
  }

  @Get('tickets/:ticketId')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_READ_OWN)
  getTicketById(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.supportService.getTicketById(ticketId, actor);
  }

  @Post('tickets/:ticketId/evidence')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_READ_OWN)
  addEvidence(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: AddSupportTicketEvidenceDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.addEvidence(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/assign')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  assignTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: AssignSupportTicketDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.assignTicket(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/mark-waiting')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  markWaiting(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: MarkSupportTicketWaitingDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.markWaiting(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/resume')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  resumeTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: SupportTicketActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.resumeTicket(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/escalate')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  escalateTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: SupportTicketActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.escalateTicket(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/resolve')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  resolveTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: ResolveSupportTicketDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.resolveTicket(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/close')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  closeTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: SupportTicketActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.closeTicket(ticketId, dto, actor, getRequestId(request));
  }

  @Post('tickets/:ticketId/reopen')
  @RequirePermissions(PermissionCode.SUPPORT_TICKETS_MANAGE)
  reopenTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: SupportTicketActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.supportService.reopenTicket(ticketId, dto, actor, getRequestId(request));
  }
}
