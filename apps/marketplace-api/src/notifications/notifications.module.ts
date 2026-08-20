import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DispatchPendingNotificationsHandler } from './dispatch-pending-notifications.handler';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationTransportModule } from './notification-transport.module';
import { NotificationsController } from './notifications.controller';
import { NotificationEventsService } from './notification-events.service';
import { NotificationsService } from './notifications.service';
import { SendNotificationHandler } from './send-notification.handler';

/** Contributes the outbound delivery handlers to the shared job registry. */
@Injectable()
class NotificationHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly sendNotification: SendNotificationHandler,
    private readonly dispatchPending: DispatchPendingNotificationsHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.sendNotification, this.dispatchPending);
  }
}

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, JobsModule, NotificationTransportModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationEventsService,
    NotificationDeliveryService,
    SendNotificationHandler,
    DispatchPendingNotificationsHandler,
    NotificationHandlerRegistrar,
  ],
  exports: [NotificationsService, NotificationEventsService, NotificationDeliveryService],
})
export class NotificationsModule {}
