import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReturnPickupsController } from './return-pickups.controller';
import { ReturnPickupsService } from './return-pickups.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, NotificationsModule],
  controllers: [ReturnPickupsController],
  providers: [ReturnPickupsService],
})
export class ReturnPickupsModule {}
