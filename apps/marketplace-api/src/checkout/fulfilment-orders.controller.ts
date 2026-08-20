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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { PermissionsGuard } from '../access/permissions.guard';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CheckoutService } from './checkout.service';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { AssignDeliveryDto } from './dto/assign-delivery.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { FulfilmentOrderDecisionDto } from './dto/fulfilment-order-decision.dto';
import { GenerateProductInvoiceDto } from './dto/generate-product-invoice.dto';
import { ListFulfilmentOrdersQueryDto } from './dto/list-fulfilment-orders-query.dto';
import { ReportDeliveryFailureDto } from './dto/report-delivery-failure.dto';
import { RetryDeliveryDto } from './dto/retry-delivery.dto';
import { VerifyPackagePickupDto } from './dto/verify-package-pickup.dto';

@ApiTags('fulfilment')
@Controller('fulfilment/orders')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class FulfilmentOrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly invoiceDocuments: InvoiceDocumentsService,
  ) {}

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
  async generateFulfilmentOrderInvoice(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: GenerateProductInvoiceDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    const order = await this.checkoutService.generateFulfilmentOrderInvoice(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
    await this.invoiceDocuments.request(orderId, actor, getRequestId(request));
    return order;
  }

  @Post(':orderId/invoice/pdf')
  requestFulfilmentOrderInvoicePdf(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.invoiceDocuments.request(orderId, actor, getRequestId(request));
  }

  @Get(':orderId/invoice/pdf')
  getFulfilmentOrderInvoicePdf(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.invoiceDocuments.get(orderId, actor);
  }

  @Get(':orderId/invoice/pdf/download')
  downloadFulfilmentOrderInvoicePdf(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.invoiceDocuments.getDownload(orderId, actor, getRequestId(request));
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

  @Post(':orderId/dispatch-label')
  issueDispatchPackageLabel(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.issueDispatchPackageLabel(
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

  @Post(':orderId/delivery-assignment/verify-pickup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyDeliveryPackagePickup(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: VerifyPackagePickupDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.verifyDeliveryPackagePickup(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/delivery-assignment/accept')
  acceptDeliveryAssignment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.acceptDeliveryAssignment(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/delivery-assignment/reject')
  rejectDeliveryAssignment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: FulfilmentOrderDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.rejectDeliveryAssignment(
      orderId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':orderId/delivery-assignment/reassign')
  reassignDeliveryAssignment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AssignDeliveryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.reassignDeliveryAssignment(
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

  @Post(':orderId/delivery-failure')
  reportDeliveryFailure(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ReportDeliveryFailureDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.reportDeliveryFailure(orderId, dto, actor, getRequestId(request));
  }

  @Post(':orderId/delivery-retry')
  retryDelivery(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RetryDeliveryDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.checkoutService.retryDelivery(orderId, dto, actor, getRequestId(request));
  }
}
