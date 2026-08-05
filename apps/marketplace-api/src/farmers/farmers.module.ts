import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FarmersController } from './farmers.controller';
import { FarmersService } from './farmers.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule],
  controllers: [FarmersController],
  providers: [FarmersService],
  exports: [FarmersService],
})
export class FarmersModule {}
