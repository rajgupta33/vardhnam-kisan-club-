import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CreditNotesService } from './credit-notes.service';
import { GenerateCreditNotePdfHandler } from './generate-credit-note-pdf.handler';
import { RecoverCreditNotePdfJobsHandler } from './recover-credit-note-pdf-jobs.handler';
import { RefundsController } from './refunds.controller';
import { ExecuteRefundHandler } from './execute-refund.handler';
import { RecoverProcessingRefundsHandler } from './recover-processing-refunds.handler';
import { RefundsService } from './refunds.service';

@Injectable()
class RefundHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly executeRefund: ExecuteRefundHandler,
    private readonly recoverProcessingRefunds: RecoverProcessingRefundsHandler,
    private readonly generateCreditNotePdf: GenerateCreditNotePdfHandler,
    private readonly recoverCreditNotePdfJobs: RecoverCreditNotePdfJobsHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      this.executeRefund,
      this.recoverProcessingRefunds,
      this.generateCreditNotePdf,
      this.recoverCreditNotePdfJobs,
    );
  }
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AccessModule,
    FinanceModule,
    NotificationsModule,
    PaymentProviderModule,
    JobsModule,
    StorageModule,
  ],
  controllers: [RefundsController],
  providers: [
    RefundsService,
    CreditNotesService,
    ExecuteRefundHandler,
    RecoverProcessingRefundsHandler,
    GenerateCreditNotePdfHandler,
    RecoverCreditNotePdfJobsHandler,
    RefundHandlerRegistrar,
  ],
  exports: [RefundsService],
})
export class RefundsModule {}
