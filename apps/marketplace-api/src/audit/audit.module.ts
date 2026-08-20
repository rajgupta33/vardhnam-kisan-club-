import { forwardRef, Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [forwardRef(() => AccessModule), forwardRef(() => AuthModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
