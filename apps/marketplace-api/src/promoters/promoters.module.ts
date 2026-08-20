import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromotersController } from './promoters.controller';
import { PromotersService } from './promoters.service';
import { PromoterVisitsController } from './promoter-visits.controller';
import { PromoterVisitsService } from './promoter-visits.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, AuthModule],
  controllers: [PromotersController, PromoterVisitsController],
  providers: [PromotersService, PromoterVisitsService],
  exports: [PromotersService],
})
export class PromotersModule {}
