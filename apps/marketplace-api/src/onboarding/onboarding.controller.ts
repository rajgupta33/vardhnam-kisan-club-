import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { ApprovalQueueQueryDto } from './dto/approval-queue-query.dto';
import { CreateKycDocumentDto } from './dto/create-kyc-document.dto';
import { UpdateKycDocumentDto } from './dto/update-kyc-document.dto';
import { UpsertCompanyProfileDto } from './dto/upsert-company-profile.dto';
import { UpsertDistributorProfileDto } from './dto/upsert-distributor-profile.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@Controller('onboarding')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('approval-queue')
  @RequirePermissions(PermissionCode.ONBOARDING_QUEUE_READ)
  approvalQueue(@Query() query: ApprovalQueueQueryDto) {
    return this.onboardingService.approvalQueue(query);
  }

  @Get('organisations/:organisationId')
  summary(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.onboardingService.summary(organisationId, actor);
  }

  @Put('organisations/:organisationId/company-profile')
  upsertCompanyProfile(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: UpsertCompanyProfileDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.onboardingService.upsertCompanyProfile(
      organisationId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Put('organisations/:organisationId/distributor-profile')
  upsertDistributorProfile(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: UpsertDistributorProfileDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.onboardingService.upsertDistributorProfile(
      organisationId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post('organisations/:organisationId/kyc-documents')
  createKycDocument(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: CreateKycDocumentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.onboardingService.createKycDocument(
      organisationId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Patch('organisations/:organisationId/kyc-documents/:documentId')
  updateKycDocument(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateKycDocumentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.onboardingService.updateKycDocument(
      organisationId,
      documentId,
      dto,
      actor,
      getRequestId(request),
    );
  }
}
