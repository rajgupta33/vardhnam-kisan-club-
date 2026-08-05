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
import { CheckoutService } from './checkout.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ListMyOrdersQueryDto } from './dto/list-my-orders-query.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get()
  @RequirePermissions(PermissionCode.ORDERS_READ_OWN)
  listMyOrders(@Query() query: ListMyOrdersQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.checkoutService.listMyOrders(query, actor);
  }

  @Post(':orderId/cancel')
  @RequirePermissions(PermissionCode.ORDERS_CANCEL_OWN)
  cancelMyOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.checkoutService.cancelMyOrder(
      orderId,
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }

  @Get(':orderId')
  @RequirePermissions(PermissionCode.ORDERS_READ_OWN)
  getMyOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.checkoutService.getMyOrder(orderId, actor);
  }
}
