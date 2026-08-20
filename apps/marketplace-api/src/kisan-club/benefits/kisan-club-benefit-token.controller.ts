import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { PermissionCode } from '../../access/permission-codes';
import { PermissionsGuard } from '../../access/permissions.guard';
import { RequirePermissions } from '../../access/require-permissions.decorator';
import { CurrentUserContext } from '../../auth/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.interface';
import { MockAuthGuard } from '../../auth/mock-auth.guard';
import { getRequestId } from '../../common/middleware/correlation-id.middleware';
import { CreateKisanClubBenefitTokenDto } from '../dto/create-kisan-club-benefit-token.dto';
import { ListKisanClubBenefitTokensQueryDto } from '../dto/list-kisan-club-benefit-tokens-query.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubBenefitTokenService } from './kisan-club-benefit-token.service';

@ApiTags('kisan-club')
@Controller('kisan-club/benefit-tokens')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubBenefitTokenController {
  constructor(private readonly tokenService: KisanClubBenefitTokenService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions(PermissionCode.KISAN_CLUB_BENEFIT_TOKENS_CREATE_OWN)
  issue(
    @Body() dto: CreateKisanClubBenefitTokenDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tokenService.issue(dto, actor, getRequestId(request));
  }

  @Get('me')
  @RequirePermissions(PermissionCode.KISAN_CLUB_BENEFIT_TOKENS_READ_OWN)
  listMine(
    @Query() query: ListKisanClubBenefitTokensQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.tokenService.listMine(query, actor);
  }
}
