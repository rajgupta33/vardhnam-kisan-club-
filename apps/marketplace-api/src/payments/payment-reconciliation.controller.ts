import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { ListReconciliationQueryDto } from './dto/list-reconciliation-query.dto';
import { PaymentReconciliationService } from './payment-reconciliation.service';

/** Finance's view of payments the platform and the gateway disagree about. */
@ApiTags('payments')
@Controller('payments/reconciliation')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PaymentReconciliationController {
  constructor(private readonly reconciliationService: PaymentReconciliationService) {}

  @Get()
  @RequirePermissions(PermissionCode.PAYMENTS_RECONCILIATION_READ)
  list(@Query() query: ListReconciliationQueryDto) {
    return this.reconciliationService.listDisagreements(query);
  }
}
