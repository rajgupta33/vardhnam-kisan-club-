import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AccessController],
  providers: [AccessService, PermissionsGuard],
  exports: [AccessService, PermissionsGuard],
})
export class AccessModule {}
