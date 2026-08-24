import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { AdminJobsService } from './admin-jobs.service';
import {
  DeadLetterPageResponseDto,
  RetryDeadLetterResponseDto,
} from './dto/admin-dead-letter-response.dto';
import { AdminQueuesResponseDto } from './dto/admin-queues-response.dto';
import { ListDeadLetterQueryDto } from './dto/list-dead-letter-query.dto';
import { RetryDeadLetterDto } from './dto/retry-dead-letter.dto';

@ApiTags('admin-jobs')
@Controller('admin/jobs')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class AdminJobsController {
  constructor(private readonly adminJobsService: AdminJobsService) {}

  @Get('queues')
  @ApiOperation({ summary: 'Queue depths and the registered maintenance schedule' })
  @ApiOkResponse({ type: AdminQueuesResponseDto })
  @RequirePermissions(PermissionCode.JOBS_READ)
  getQueues() {
    return this.adminJobsService.getQueues();
  }

  @Get('dead-letter')
  @ApiOperation({ summary: 'Paginated dead-letter entries for a queue' })
  @ApiOkResponse({ type: DeadLetterPageResponseDto })
  @RequirePermissions(PermissionCode.JOBS_READ)
  listDeadLetterJobs(@Query() query: ListDeadLetterQueryDto) {
    return this.adminJobsService.listDeadLetterJobs(query);
  }

  @Post('dead-letter/:jobId/retry')
  @ApiOperation({ summary: 'Replay a dead-lettered job onto its original queue' })
  @ApiCreatedResponse({ type: RetryDeadLetterResponseDto })
  @RequirePermissions(PermissionCode.JOBS_MANAGE)
  retryDeadLetterJob(
    // BullMQ job ids are not UUIDs, so this stays a plain string param.
    @Param('jobId') jobId: string,
    @Body() dto: RetryDeadLetterDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.adminJobsService.retryDeadLetterJob(jobId, dto, actor, getRequestId(request));
  }
}
