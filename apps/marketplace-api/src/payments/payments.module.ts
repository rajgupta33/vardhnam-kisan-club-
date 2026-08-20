import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KisanClubModule } from '../kisan-club/kisan-club.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentProviderModule } from './payment-provider.module';
import { PaymentReconciliationController } from './payment-reconciliation.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhooksService } from './payment-webhooks.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ProcessPaymentWebhookHandler } from './process-payment-webhook.handler';
import { ReconcilePaymentIntentsHandler } from './reconcile-payment-intents.handler';

/** Contributes the payment job handlers to the shared registry (see WP-04). */
@Injectable()
class PaymentHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly processWebhook: ProcessPaymentWebhookHandler,
    private readonly reconcile: ReconcilePaymentIntentsHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.processWebhook, this.reconcile);
  }
}

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AccessModule,
    FinanceModule,
    NotificationsModule,
    KisanClubModule,
    JobsModule,
    PaymentProviderModule,
    // The webhook route is public, so it carries its own limit. It is set well
    // above a gateway's normal rate: the throttler is there to blunt an
    // unsigned flood, not to reject a gateway working through a retry backlog.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  controllers: [PaymentsController, PaymentWebhooksController, PaymentReconciliationController],
  providers: [
    PaymentsService,
    PaymentSettlementService,
    PaymentWebhooksService,
    PaymentReconciliationService,
    ProcessPaymentWebhookHandler,
    ReconcilePaymentIntentsHandler,
    PaymentHandlerRegistrar,
  ],
  exports: [PaymentSettlementService],
})
export class PaymentsModule {}
