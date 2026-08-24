import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { GetPayoutStatementQueryDto } from './dto/get-payout-statement-query.dto';
import { ListPayoutAccountsQueryDto } from './dto/list-payout-accounts-query.dto';
import {
  PayoutAccountPageResponseDto,
  PayoutAccountResponseEnvelopeDto,
  PayoutStatementResponseDto,
} from './dto/payout-response.dto';
import { UpsertPayoutAccountDto } from './dto/upsert-payout-account.dto';
import { VerifyPayoutAccountDto } from './dto/verify-payout-account.dto';
import { PayoutsService } from './payouts.service';

@ApiTags('payouts')
@Controller('payouts')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Put('accounts/me')
  @ApiOkResponse({ type: PayoutAccountResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.PAYOUT_ACCOUNTS_WRITE_OWN)
  upsertMyAccount(
    @Body() dto: UpsertPayoutAccountDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.payoutsService.upsertMyAccount(dto, actor, getRequestId(request));
  }

  @Get('accounts/me')
  @ApiOkResponse({ type: PayoutAccountResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.PAYOUT_ACCOUNTS_READ_OWN)
  getMyAccount(@CurrentUserContext() actor: CurrentUser) {
    return this.payoutsService.getMyAccount(actor);
  }

  @Get('accounts')
  @ApiOkResponse({ type: PayoutAccountPageResponseDto })
  @RequirePermissions(PermissionCode.PAYOUT_ACCOUNTS_READ_ANY)
  listAccounts(@Query() query: ListPayoutAccountsQueryDto) {
    return this.payoutsService.listAccounts(query);
  }

  @Get('accounts/:userId')
  @ApiOkResponse({ type: PayoutAccountResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.PAYOUT_ACCOUNTS_READ_ANY)
  getAccountByUserId(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.payoutsService.getAccountByUserId(userId);
  }

  @Post('accounts/:accountId/verify')
  @ApiCreatedResponse({ type: PayoutAccountResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.PAYOUT_ACCOUNTS_VERIFY)
  verifyAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: VerifyPayoutAccountDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.payoutsService.verifyAccount(accountId, dto, actor, getRequestId(request));
  }

  @Get('statements/me')
  @ApiOkResponse({ type: PayoutStatementResponseDto })
  @RequirePermissions(PermissionCode.PAYOUT_STATEMENTS_READ_OWN)
  getMyStatement(
    @Query() query: GetPayoutStatementQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.payoutsService.getMyStatement(actor, query);
  }
}
