import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, NotificationsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
