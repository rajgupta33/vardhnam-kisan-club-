import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

@ApiTags('audit')
@Controller('audit-logs')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions(PermissionCode.AUDIT_READ)
  list(@Query() query: ListAuditQueryDto) {
    return this.auditService.list(query);
  }
}
