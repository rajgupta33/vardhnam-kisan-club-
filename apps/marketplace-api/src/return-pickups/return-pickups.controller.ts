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
import { AssignReturnPickupDto } from './dto/assign-return-pickup.dto';
import { ListReturnPickupsQueryDto } from './dto/list-return-pickups-query.dto';
import { ReturnPickupDecisionDto } from './dto/return-pickup-decision.dto';
import { ReturnPickupsService } from './return-pickups.service';

@ApiTags('return-pickups')
@Controller('return-pickups')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class ReturnPickupsController {
  constructor(private readonly service: ReturnPickupsService) {}

  @Get()
  list(@Query() query: ListReturnPickupsQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.service.list(query, actor);
  }

  @Get(':assignmentId')
  get(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.service.get(assignmentId, actor);
  }

  @Post('returns/:returnRequestId/assignment')
  assign(
    @Param('returnRequestId', ParseUUIDPipe) returnRequestId: string,
    @Body() dto: AssignReturnPickupDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.assign(returnRequestId, dto, actor, getRequestId(request));
  }

  @Post(':assignmentId/accept')
  accept(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: ReturnPickupDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.respond(assignmentId, true, dto, actor, getRequestId(request));
  }

  @Post(':assignmentId/reject')
  reject(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: ReturnPickupDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.respond(assignmentId, false, dto, actor, getRequestId(request));
  }

  @Post(':assignmentId/collect')
  collect(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: ReturnPickupDecisionDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.service.collect(assignmentId, dto, actor, getRequestId(request));
  }
}
