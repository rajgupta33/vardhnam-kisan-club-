import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromotersController } from './promoters.controller';
import { PromotersService } from './promoters.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule],
  controllers: [PromotersController],
  providers: [PromotersService],
  exports: [PromotersService],
})
export class PromotersModule {}
