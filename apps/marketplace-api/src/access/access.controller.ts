import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { RequirePermissions } from './require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { PermissionCode } from './permission-codes';
import { AccessService } from './access.service';

@ApiTags('access')
@Controller('access')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('roles')
  @RequirePermissions(PermissionCode.ROLES_READ)
  roles() {
    return this.accessService.listRoles();
  }

  @Get('permissions')
  @RequirePermissions(PermissionCode.ROLES_READ)
  permissions() {
    return this.accessService.listPermissions();
  }
}
