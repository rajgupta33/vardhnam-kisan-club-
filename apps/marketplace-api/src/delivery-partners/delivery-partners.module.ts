import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryPartnersController } from './delivery-partners.controller';
import { DeliveryPartnersService } from './delivery-partners.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule],
  controllers: [DeliveryPartnersController],
  providers: [DeliveryPartnersService],
  exports: [DeliveryPartnersService],
})
export class DeliveryPartnersModule {}
