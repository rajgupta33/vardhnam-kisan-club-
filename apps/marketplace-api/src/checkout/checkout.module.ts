import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { FulfilmentOrdersController } from './fulfilment-orders.controller';
import { OrdersController } from './orders.controller';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, FinanceModule],
  controllers: [CheckoutController, OrdersController, FulfilmentOrdersController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
