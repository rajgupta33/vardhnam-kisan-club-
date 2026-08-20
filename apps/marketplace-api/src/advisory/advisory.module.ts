import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { KisanClubModule } from '../kisan-club/kisan-club.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdvisoryController } from './advisory.controller';
import { AdvisoryService } from './advisory.service';
import { GenerateAdvisoriesHandler } from './generate-advisories.handler';

/** Contributes the daily advisory generation job to the shared job registry. */
@Injectable()
class AdvisoryHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly generateAdvisories: GenerateAdvisoriesHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.generateAdvisories);
  }
}

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, AuthModule, KisanClubModule, JobsModule],
  controllers: [AdvisoryController],
  providers: [AdvisoryService, GenerateAdvisoriesHandler, AdvisoryHandlerRegistrar],
  exports: [AdvisoryService],
})
export class AdvisoryModule {}
