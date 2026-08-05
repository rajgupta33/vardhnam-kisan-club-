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
import { ConfirmNotificationAttemptDto } from './dto/confirm-notification-attempt.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListMyNotificationsQueryDto } from './dto/list-my-notifications-query.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @RequirePermissions(PermissionCode.NOTIFICATIONS_MANAGE)
  enqueueNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.notificationsService.enqueueNotification(dto, actor, getRequestId(request));
  }

  @Get()
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_ANY)
  listNotifications(@Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listNotifications(query);
  }

  @Get('me')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  listMyNotifications(
    @Query() query: ListMyNotificationsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.notificationsService.listMyNotifications(actor, query);
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  getNotificationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.notificationsService.getNotificationById(id, actor);
  }

  @Post(':id/attempt')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_MANAGE)
  attemptDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmNotificationAttemptDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.notificationsService.attemptDelivery(id, dto, actor, getRequestId(request));
  }

  @Post(':id/read')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.notificationsService.markRead(id, actor, getRequestId(request));
  }
}
