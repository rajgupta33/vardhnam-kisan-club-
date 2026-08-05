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
import { PermissionsGuard } from '../access/permissions.guard';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CheckoutService } from './checkout.service';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { FulfilmentOrderDecisionDto } from './dto/fulfilment-order-decision.dto';
import { GenerateProductInvoiceDto } from './dto/generate-product-invoice.dto';
import { ListFulfilmentOrdersQueryDto } from './dto/list-fulfilment-orders-query.dto';

@ApiTags('fulfilment')
@Controller('fulfilment/orders')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class FulfilmentOrdersController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get()
  listFulfilmentOrders(
    @Query() query: ListFulfilmentOrdersQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.checkoutService.listFulfilmentOrders(query, actor);
  }

  @Get(':orderId')
  getFulfilmentOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.checkoutService.getFulfilmentOrder(orderId, actor);
  }

  @Post(':orderId/accept')
  acceptFulfilmentOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.acceptFulfilmentOrder(orderId, dto, actor, getRequestId(request));
  }

  @Post(':orderId/reject')
  rejectFulfilmentOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.rejectFulfilmentOrder(orderId, dto, actor, getRequestId(request));
  }

  @Post(':orderId/ready-to-pack')
  markFulfilmentOrderReadyToPack(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.markFulfilmentOrderReadyToPack(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/pack')
  packFulfilmentOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.packFulfilmentOrder(orderId, dto, actor, getRequestId(request));
  }

  @Post(':orderId/invoice')
  generateFulfilmentOrderInvoice(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: GenerateProductInvoiceDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.generateFulfilmentOrderInvoice(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/ready-for-pickup')
  markFulfilmentOrderReadyForPickup(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.markFulfilmentOrderReadyForPickup(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/delivery-assignment')
  assignFulfilmentOrderDelivery(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignDeliveryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.assignFulfilmentOrderDelivery(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/out-for-delivery')
  markFulfilmentOrderOutForDelivery(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.markFulfilmentOrderOutForDelivery(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/deliver')
  completeFulfilmentOrderDelivery(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CompleteDeliveryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.completeFulfilmentOrderDelivery(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }
}
