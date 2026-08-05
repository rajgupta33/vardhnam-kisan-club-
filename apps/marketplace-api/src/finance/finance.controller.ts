import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListCommissionEntriesQueryDto } from './dto/list-commission-entries-query.dto';
import { ListCommissionRulesQueryDto } from './dto/list-commission-rules-query.dto';
import { ListLedgerQueryDto } from './dto/list-ledger-query.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { ReverseCommissionEntryDto } from './dto/reverse-commission-entry.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller('finance')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('commission-rules')
  @RequirePermissions(PermissionCode.FINANCE_COMMISSION_RULES_READ)
  listCommissionRules(@Query() query: ListCommissionRulesQueryDto) {
    return this.financeService.listCommissionRules(query);
  }

  @Post('commission-rules')
  @RequirePermissions(PermissionCode.FINANCE_COMMISSION_RULES_WRITE)
  createCommissionRule(
    @Body() dto: CreateCommissionRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.financeService.createCommissionRule(dto, actor, getRequestId(request));
  }

  @Get('commission-entries')
  @RequirePermissions(PermissionCode.FINANCE_COMMISSION_ENTRIES_READ)
  listCommissionEntries(@Query() query: ListCommissionEntriesQueryDto) {
    return this.financeService.listCommissionEntries(query);
  }

  @Post('commission-entries/finalize-eligible')
  @RequirePermissions(PermissionCode.FINANCE_COMMISSION_ENTRIES_MANAGE)
  finalizeEligibleCommissionEntries(
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.financeService.finalizeEligibleCommissionEntries(actor, getRequestId(request));
  }

  @Post('commission-entries/:entryId/reverse')
  @RequirePermissions(PermissionCode.FINANCE_COMMISSION_ENTRIES_MANAGE)
  reverseCommissionEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: ReverseCommissionEntryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.financeService.reverseCommissionEntry(
      entryId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Get('ledger')
  @RequirePermissions(PermissionCode.FINANCE_LEDGER_READ)
  listLedgerEntries(@Query() query: ListLedgerQueryDto) {
    return this.financeService.listLedgerEntries(query);
  }

  @Get('settlements')
  @RequirePermissions(PermissionCode.FINANCE_SETTLEMENTS_READ)
  listSettlements(@Query() query: ListSettlementsQueryDto) {
    return this.financeService.listSettlements(query);
  }

  @Get('settlements/:settlementId')
  @RequirePermissions(PermissionCode.FINANCE_SETTLEMENTS_READ)
  getSettlementById(@Param('settlementId', ParseUUIDPipe) settlementId: string) {
    return this.financeService.getSettlementById(settlementId);
  }

  @Post('settlements')
  @RequirePermissions(PermissionCode.FINANCE_SETTLEMENTS_MANAGE)
  createSettlement(
    @Body() dto: CreateSettlementDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.financeService.createSettlement(dto, actor, getRequestId(request));
  }
}
