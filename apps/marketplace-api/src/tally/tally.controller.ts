import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { ConfirmTallySyncAttemptDto } from './dto/confirm-tally-sync-attempt.dto';
import { CreateTallySyncRecordDto } from './dto/create-tally-sync-record.dto';
import { ListTallySyncRecordsQueryDto } from './dto/list-tally-sync-records-query.dto';
import { TallyService } from './tally.service';

@ApiTags('tally')
@Controller('tally')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class TallyController {
  constructor(private readonly tallyService: TallyService) {}

  @Post('sync-records')
  @RequirePermissions(PermissionCode.TALLY_SYNC_MANAGE)
  enqueueSyncRecord(
    @Body() dto: CreateTallySyncRecordDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tallyService.enqueueSyncRecord(dto, actor, getRequestId(request));
  }

  @Get('sync-records')
  @RequirePermissions(PermissionCode.TALLY_SYNC_READ)
  listSyncRecords(@Query() query: ListTallySyncRecordsQueryDto) {
    return this.tallyService.listSyncRecords(query);
  }

  @Get('sync-records/:id')
  @RequirePermissions(PermissionCode.TALLY_SYNC_READ)
  getSyncRecordById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tallyService.getSyncRecordById(id);
  }

  @Post('sync-records/:id/attempt')
  @RequirePermissions(PermissionCode.TALLY_SYNC_MANAGE)
  attemptSync(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTallySyncAttemptDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.tallyService.attemptSync(id, dto, actor, getRequestId(request));
  }

  @Get('reconciliation')
  @RequirePermissions(PermissionCode.TALLY_SYNC_READ)
  getReconciliationSummary() {
    return this.tallyService.getReconciliationSummary();
  }
}
