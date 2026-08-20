import {
  Body,
  Controller,
  Get,
  Headers,
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
import { ConfirmMockRefundDto } from './dto/confirm-mock-refund.dto';
import { CreditNotesService } from './credit-notes.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { ListRefundsQueryDto } from './dto/list-refunds-query.dto';
import { RefundsService } from './refunds.service';

@ApiTags('refunds')
@Controller('refunds')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly creditNotesService: CreditNotesService,
  ) {}

  @Post()
  @RequirePermissions(PermissionCode.REFUNDS_CREATE_ANY)
  create(
    @Body() dto: CreateRefundDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.refundsService.create(dto, actor, idempotencyKey, getRequestId(request));
  }

  @Get()
  @RequirePermissions(PermissionCode.REFUNDS_READ_ANY)
  list(@Query() query: ListRefundsQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.refundsService.list(query, actor);
  }

  @Get('me')
  @RequirePermissions(PermissionCode.REFUNDS_READ_OWN)
  listMine(@Query() query: ListRefundsQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.refundsService.listMine(query, actor);
  }

  @Get(':refundId')
  get(
    @Param('refundId', ParseUUIDPipe) refundId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.refundsService.get(refundId, actor);
  }

  @Post(':refundId/confirm')
  @RequirePermissions(PermissionCode.REFUNDS_CONFIRM_MOCK)
  confirmMock(
    @Param('refundId', ParseUUIDPipe) refundId: string,
    @Body() dto: ConfirmMockRefundDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.refundsService.confirmMock(
      refundId,
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }

  @Get(':refundId/credit-note')
  getCreditNote(
    @Param('refundId', ParseUUIDPipe) refundId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.creditNotesService.get(refundId, actor);
  }

  @Get(':refundId/credit-note/download')
  downloadCreditNote(
    @Param('refundId', ParseUUIDPipe) refundId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.creditNotesService.getDownload(refundId, actor, getRequestId(request));
  }
}
