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
import { AttachReturnEvidenceDto } from './dto/attach-return-evidence.dto';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { InspectReturnRequestDto } from './dto/inspect-return-request.dto';
import { ListMyReturnRequestsQueryDto } from './dto/list-my-return-requests-query.dto';
import { ListReturnRequestsQueryDto } from './dto/list-return-requests-query.dto';
import { ReturnTransitionDto } from './dto/return-transition.dto';
import { ReturnsService } from './returns.service';

@ApiTags('returns')
@Controller('returns')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @RequirePermissions(PermissionCode.RETURNS_CREATE_OWN)
  createMyReturnRequest(
    @Body() dto: CreateReturnRequestDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.returnsService.createMyReturnRequest(
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }

  @Get('me')
  @RequirePermissions(PermissionCode.RETURNS_READ_OWN)
  listMyReturnRequests(
    @Query() query: ListMyReturnRequestsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.returnsService.listMyReturnRequests(query, actor);
  }

  @Get('eligibility/:orderId')
  @RequirePermissions(PermissionCode.RETURNS_READ_OWN)
  getMyReturnEligibility(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.returnsService.getMyReturnEligibility(orderId, actor);
  }

  @Get()
  listReturnRequests(
    @Query() query: ListReturnRequestsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.returnsService.listReturnRequests(query, actor);
  }

  @Get(':returnRequestId')
  getReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.returnsService.getReturnRequest(returnRequestId, actor);
  }

  @Post(':returnRequestId/evidence')
  attachReturnEvidence(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: AttachReturnEvidenceDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.attachEvidence(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/approve')
  approveReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: ReturnTransitionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.approveReturnRequest(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/reject')
  rejectReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: ReturnTransitionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.rejectReturnRequest(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/pickup')
  markReturnInTransit(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: ReturnTransitionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.markReturnInTransit(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/receive')
  receiveReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: ReturnTransitionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.receiveReturnRequest(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/inspect')
  inspectReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: InspectReturnRequestDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.returnsService.inspectReturnRequest(
      returnRequestId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post(':returnRequestId/cancel')
  @RequirePermissions(PermissionCode.RETURNS_CANCEL_OWN)
  cancelMyReturnRequest(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: ReturnTransitionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.returnsService.cancelMyReturnRequest(
      returnRequestId,
      dto,
      actor,
      idempotencyKey,
      getRequestId(request),
    );
  }
}
