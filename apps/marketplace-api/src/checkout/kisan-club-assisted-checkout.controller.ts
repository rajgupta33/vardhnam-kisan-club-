import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { RedeemKisanClubBenefitTokenDto } from '../kisan-club/dto/redeem-kisan-club-benefit-token.dto';
import { KisanClubEnabledGuard } from '../kisan-club/kisan-club-enabled.guard';
import { CheckoutService } from './checkout.service';

@ApiTags('kisan-club')
@Controller('kisan-club/benefit-tokens')
@UseGuards(KisanClubEnabledGuard, ThrottlerGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubAssistedCheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('redeem')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions(PermissionCode.KISAN_CLUB_ASSISTED_ORDERS_CREATE)
  redeem(
    @Body() dto: RedeemKisanClubBenefitTokenDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.checkoutService.checkoutAssistedToken(
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }
}
