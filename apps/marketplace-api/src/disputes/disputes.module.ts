import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [PrismaModule, AccessModule, AuditModule, NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
