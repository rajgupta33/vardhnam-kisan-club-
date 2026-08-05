import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CheckoutService } from './checkout.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CheckoutFromCartDto } from './dto/checkout-from-cart.dto';

@ApiTags('checkout')
@Controller('checkout')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('from-cart')
  @RequirePermissions(PermissionCode.CHECKOUT_CREATE_OWN)
  checkoutFromCart(
    @Body() dto: CheckoutFromCartDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.checkoutService.checkoutFromCart(dto, actor, idempotencyKey, getRequestId(request));
  }

  @Post(':checkoutId/cancel')
  @RequirePermissions(PermissionCode.CHECKOUT_CANCEL_OWN)
  cancelMyCheckout(
    @Param('checkoutId', ParseUUIDPipe) checkoutId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.checkoutService.cancelMyCheckout(
      checkoutId,
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }

  @Get(':checkoutId')
  @RequirePermissions(PermissionCode.CHECKOUT_READ_OWN)
  getMyCheckout(
    @Param('checkoutId', ParseUUIDPipe) checkoutId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.checkoutService.getMyCheckout(checkoutId, actor);
  }
}
