import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { AdminJobsController } from './admin-jobs.controller';
import { AdminJobsService } from './admin-jobs.service';
import { ExpireBatchesHandler } from './handlers/expire-batches.handler';
import { ExpireOtpChallengesHandler } from './handlers/expire-otp-challenges.handler';
import { FinalizeCommissionsHandler } from './handlers/finalize-commissions.handler';
import { PruneRefreshTokensHandler } from './handlers/prune-refresh-tokens.handler';
import { JobHandlerRegistry } from './job-handler-registry.service';
import { JobRunnerService } from './job-runner.service';
import { QueueService } from './queue.service';
import { SchedulerService } from './scheduler.service';

/** Contributes this module's own handlers, the same way feature modules do. */
@Injectable()
class MaintenanceHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly finalizeCommissions: FinalizeCommissionsHandler,
    private readonly expireBatches: ExpireBatchesHandler,
    private readonly expireOtpChallenges: ExpireOtpChallengesHandler,
    private readonly pruneRefreshTokens: PruneRefreshTokensHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      this.finalizeCommissions,
      this.expireBatches,
      this.expireOtpChallenges,
      this.pruneRefreshTokens,
    );
  }
}

@Module({
  imports: [AuditModule, FinanceModule],
  controllers: [AdminJobsController],
  providers: [
    QueueService,
    JobHandlerRegistry,
    JobRunnerService,
    SchedulerService,
    AdminJobsService,
    FinalizeCommissionsHandler,
    ExpireBatchesHandler,
    ExpireOtpChallengesHandler,
    PruneRefreshTokensHandler,
    MaintenanceHandlerRegistrar,
  ],
  exports: [QueueService, JobHandlerRegistry],
})
export class JobsModule {}
