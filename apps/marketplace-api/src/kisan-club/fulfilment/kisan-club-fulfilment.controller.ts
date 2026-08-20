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
import { KisanClubFulfilmentStatus } from '@prisma/client';
import type { Request } from 'express';
import { PermissionsGuard } from '../../access/permissions.guard';
import { CurrentUserContext } from '../../auth/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.interface';
import { MockAuthGuard } from '../../auth/mock-auth.guard';
import { getRequestId } from '../../common/middleware/correlation-id.middleware';
import { KisanClubFulfilmentActionDto } from '../dto/kisan-club-fulfilment-action.dto';
import { ListKisanClubFulfilmentQueryDto } from '../dto/list-kisan-club-fulfilment-query.dto';
import { ReassignKisanClubFulfilmentDto } from '../dto/reassign-kisan-club-fulfilment.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubFulfilmentService } from './kisan-club-fulfilment.service';

@ApiTags('kisan-club')
@Controller('kisan-club/fulfilment/assignments')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubFulfilmentController {
  constructor(private readonly fulfilmentService: KisanClubFulfilmentService) {}

  @Get()
  list(@Query() query: ListKisanClubFulfilmentQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.fulfilmentService.listAssignments(query, actor);
  }

  @Get(':assignmentId')
  get(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.fulfilmentService.getAssignment(assignmentId, actor);
  }

  @Post(':assignmentId/accept')
  accept(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.PROMOTER_ACCEPTED,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/decline')
  decline(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.PROMOTER_DECLINED,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/product-ready')
  productReady(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.PRODUCT_READY,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/farmer-contacted')
  farmerContacted(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.FARMER_CONTACTED,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/ready-for-pickup')
  readyForPickup(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.READY_FOR_PICKUP,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/out-for-delivery')
  outForDelivery(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(
      assignmentId,
      KisanClubFulfilmentStatus.OUT_FOR_DELIVERY,
      dto,
      actor,
      request,
    );
  }

  @Post(':assignmentId/complete')
  complete(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(assignmentId, KisanClubFulfilmentStatus.COMPLETED, dto, actor, request);
  }

  @Post(':assignmentId/fail')
  fail(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(assignmentId, KisanClubFulfilmentStatus.FAILED, dto, actor, request);
  }

  @Post(':assignmentId/cancel')
  cancel(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: KisanClubFulfilmentActionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.transition(assignmentId, KisanClubFulfilmentStatus.CANCELLED, dto, actor, request);
  }

  @Post(':assignmentId/reassign')
  reassign(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: ReassignKisanClubFulfilmentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.fulfilmentService.reassign(assignmentId, dto, actor, getRequestId(request));
  }

  private transition(
    assignmentId: string,
    status: KisanClubFulfilmentStatus,
    dto: KisanClubFulfilmentActionDto,
    actor: CurrentUser,
    request: Request,
  ) {
    return this.fulfilmentService.transition(
      assignmentId,
      status,
      dto,
      actor,
      getRequestId(request),
    );
  }
}
