import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import {
  NotificationDispatchResponseDto,
  NotificationPageResponseDto,
} from './dto/notification-response.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

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
  @ApiOkResponse({ type: NotificationPageResponseDto })
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

  @Get('preferences/me')
  @ApiOperation({
    summary: 'Read the caller notification preferences and which categories are adjustable',
  })
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  getMyPreferences(@CurrentUserContext() actor: CurrentUser) {
    return this.notificationsService.getMyPreferences(actor);
  }

  @Put('preferences/me')
  @ApiOperation({
    summary: 'Update the caller notification preferences',
    description:
      'Transactional categories cannot be disabled; attempting to do so returns 400 with the rejected categories.',
  })
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  updateMyPreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.notificationsService.updateMyPreferences(dto, actor, getRequestId(request));
  }

  @Get(':id')
  @RequirePermissions(PermissionCode.NOTIFICATIONS_READ_OWN)
  getNotificationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.notificationsService.getNotificationById(id, actor);
  }

  @Post(':id/dispatch')
  @ApiOperation({
    summary: 'Re-queue a notification for delivery through its channel provider',
    description:
      'Operational retry for a failed send. Delivery itself runs on the notifications queue, so this returns as soon as the job is queued.',
  })
  @ApiCreatedResponse({ type: NotificationDispatchResponseDto })
  @RequirePermissions(PermissionCode.NOTIFICATIONS_MANAGE)
  async dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    // Confirms the notification exists and the caller may see it before queueing.
    await this.notificationsService.getNotificationById(id, actor);
    await this.deliveryService.enqueueDelivery(id, getRequestId(request));
    return { notificationId: id, queued: true };
  }

  @Post(':id/attempt')
  @ApiOperation({
    summary: 'Manually record a delivery outcome',
    description:
      'Retained for operational correction. The normal path is the notifications queue; prefer /dispatch.',
  })
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
