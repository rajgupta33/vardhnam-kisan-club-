import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TallyController } from './tally.controller';
import { TallyService } from './tally.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TallyController],
  providers: [TallyService],
  exports: [TallyService],
})
export class TallyModule {}
