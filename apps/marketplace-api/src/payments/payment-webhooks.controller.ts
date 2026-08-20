import { Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { PaymentWebhooksService } from './payment-webhooks.service';

/**
 * The gateway's callback into the platform.
 *
 * Deliberately unauthenticated in the usual sense: a payment gateway has no
 * platform session and cannot carry a bearer token. The signature *is* the
 * authentication, and it is checked before the body is looked at. The
 * throttler is set generously -- it exists to blunt an unsigned flood, not to
 * limit the gateway, which legitimately bursts when it retries a backlog.
 */
@ApiTags('payments')
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly paymentWebhooksService: PaymentWebhooksService) {}

  @Post(':provider')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async receive(
    @Param('provider') provider: string,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const result = await this.paymentWebhooksService.ingest({
      providerName: provider,
      rawBody: request.rawBody,
      signature,
      requestId: getRequestId(request),
      sourceIp: request.ip,
    });

    // The gateway is told only that its delivery was accepted. Whether the
    // event applied is decided on the queue, and leaking that decision here
    // would invite a gateway to retry on a business outcome it cannot fix.
    return {
      received: true,
      webhookEventId: result.webhookEventId,
    };
  }
}
