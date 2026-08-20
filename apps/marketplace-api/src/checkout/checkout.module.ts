import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { KisanClubModule } from '../kisan-club/kisan-club.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationTransportModule } from '../notifications/notification-transport.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { FulfilmentOrdersController } from './fulfilment-orders.controller';
import { GenerateInvoicePdfHandler } from './generate-invoice-pdf.handler';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { RecoverInvoicePdfJobsHandler } from './recover-invoice-pdf-jobs.handler';
import { OrdersController } from './orders.controller';
import { KisanClubAssistedCheckoutController } from './kisan-club-assisted-checkout.controller';

@Injectable()
class CheckoutJobHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly generateInvoicePdf: GenerateInvoicePdfHandler,
    private readonly recoverInvoicePdfJobs: RecoverInvoicePdfJobsHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.generateInvoicePdf, this.recoverInvoicePdfJobs);
  }
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AccessModule,
    FinanceModule,
    NotificationsModule,
    // `OtpSenderService` lives in the leaf transport module rather than in
    // `NotificationsModule`, which does not re-export it.
    NotificationTransportModule,
    KisanClubModule,
    JobsModule,
    StorageModule,
  ],
  controllers: [
    CheckoutController,
    OrdersController,
    FulfilmentOrdersController,
    KisanClubAssistedCheckoutController,
  ],
  providers: [
    CheckoutService,
    InvoiceDocumentsService,
    GenerateInvoicePdfHandler,
    RecoverInvoicePdfJobsHandler,
    CheckoutJobHandlerRegistrar,
  ],
})
export class CheckoutModule {}
