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
import { ConfirmMockPaymentIntentDto } from './dto/confirm-mock-payment-intent.dto';
import { CreateMockPaymentIntentDto } from './dto/create-mock-payment-intent.dto';
import { ListPaymentIntentsQueryDto } from './dto/list-payment-intents-query.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments/mock-intents')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequirePermissions(PermissionCode.PAYMENTS_CREATE_OWN)
  createMockPaymentIntent(
    @Body() dto: CreateMockPaymentIntentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.paymentsService.createMockPaymentIntent(
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }

  @Get()
  @RequirePermissions(PermissionCode.PAYMENTS_READ_OWN)
  listMyPaymentIntents(
    @Query() query: ListPaymentIntentsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.paymentsService.listMyPaymentIntents(query, actor);
  }

  @Get(':paymentIntentId')
  @RequirePermissions(PermissionCode.PAYMENTS_READ_OWN)
  getMyPaymentIntent(
    @Param('paymentIntentId', ParseUUIDPipe) paymentIntentId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.paymentsService.getMyPaymentIntent(paymentIntentId, actor);
  }

  @Post(':paymentIntentId/confirm')
  @RequirePermissions(PermissionCode.PAYMENTS_CONFIRM_OWN)
  confirmMockPaymentIntent(
    @Param('paymentIntentId', ParseUUIDPipe) paymentIntentId: string,
    @Body() dto: ConfirmMockPaymentIntentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.paymentsService.confirmMockPaymentIntent(
      paymentIntentId,
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }
}
