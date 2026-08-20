import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { KisanClubModule } from '../kisan-club/kisan-club.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { PromoterSurveysController } from './promoter-surveys.controller';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, AuthModule, KisanClubModule],
  controllers: [FarmsController, PromoterSurveysController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
