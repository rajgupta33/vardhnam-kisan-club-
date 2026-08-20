import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller('files')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'Issue a short-lived direct-to-storage upload URL',
    description:
      'Bytes never pass through the API. The client PUTs to the returned URL with the required headers, then calls confirm.',
  })
  @RequirePermissions(PermissionCode.FILES_UPLOAD)
  requestUploadUrl(
    @Body() dto: RequestUploadUrlDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.filesService.requestUploadUrl(dto, actor, getRequestId(request));
  }

  @Post(':fileId/confirm')
  @ApiOperation({
    summary: 'Confirm an upload completed',
    description:
      'Re-validates the stored object size and content type, then queues a virus scan. The file is not downloadable until the scan clears it.',
  })
  @RequirePermissions(PermissionCode.FILES_UPLOAD)
  confirmUpload(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.filesService.confirmUpload(fileId, dto, actor, getRequestId(request));
  }

  @Get(':fileId')
  @ApiOperation({ summary: 'Read file metadata and scan status' })
  // The guard requires every listed permission, so the gate is the baseline
  // `files:read:own`; `files:read:any` widens scope inside the service.
  @RequirePermissions(PermissionCode.FILES_READ_OWN)
  getFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.filesService.getFile(fileId, actor);
  }

  @Get(':fileId/download-url')
  @ApiOperation({
    summary: 'Issue a short-lived download URL for a scanned, permitted file',
    description: 'PII-bearing purposes such as KYC_DOCUMENT write an audit record on every issue.',
  })
  // The guard requires every listed permission, so the gate is the baseline
  // `files:read:own`; `files:read:any` widens scope inside the service.
  @RequirePermissions(PermissionCode.FILES_READ_OWN)
  getDownloadUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.filesService.getDownloadUrl(fileId, actor, getRequestId(request));
  }
}
