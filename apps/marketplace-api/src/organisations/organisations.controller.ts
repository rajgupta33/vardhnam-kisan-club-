import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessService } from '../access/access.service';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { ListOrganisationsQueryDto } from './dto/list-organisations-query.dto';
import {
  OrganisationDetailResponseEnvelopeDto,
  OrganisationPageResponseDto,
} from './dto/organisation-response.dto';
import { ReviewOrganisationDto } from './dto/review-organisation.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { OrganisationsService } from './organisations.service';

@ApiTags('organisations')
@Controller('organisations')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly accessService: AccessService,
  ) {}

  @Get()
  @ApiOkResponse({ type: OrganisationPageResponseDto })
  @RequirePermissions(PermissionCode.ORGANISATIONS_READ_ANY)
  list(@Query() query: ListOrganisationsQueryDto) {
    return this.organisationsService.list(query);
  }

  @Get(':organisationId')
  @ApiOkResponse({ type: OrganisationDetailResponseEnvelopeDto })
  async getById(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    await this.accessService.ensureCanReadOrganisation(actor, organisationId);
    return this.organisationsService.getById(organisationId);
  }

  @Post()
  @RequirePermissions(PermissionCode.ORGANISATIONS_CREATE)
  create(
    @Body() dto: CreateOrganisationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.organisationsService.create(dto, actor, getRequestId(request));
  }

  @Patch(':organisationId')
  @RequirePermissions(PermissionCode.ORGANISATIONS_UPDATE_ANY)
  update(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: UpdateOrganisationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.organisationsService.update(organisationId, dto, actor, getRequestId(request));
  }

  @Post(':organisationId/review')
  @RequirePermissions(PermissionCode.ORGANISATIONS_APPROVE)
  review(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: ReviewOrganisationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.organisationsService.review(organisationId, dto, actor, getRequestId(request));
  }

  @Get(':organisationId/memberships')
  async listMemberships(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    await this.accessService.ensureCanReadMemberships(actor, organisationId);
    return this.organisationsService.listMemberships(organisationId);
  }

  @Post(':organisationId/memberships')
  @RequirePermissions(PermissionCode.MEMBERSHIPS_CREATE)
  createMembership(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Body() dto: CreateMembershipDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.organisationsService.createMembership(
      organisationId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Patch(':organisationId/memberships/:membershipId')
  @RequirePermissions(PermissionCode.MEMBERSHIPS_UPDATE_ANY)
  updateMembership(
    @Param('organisationId', ParseUUIDPipe) organisationId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.organisationsService.updateMembership(
      organisationId,
      membershipId,
      dto,
      actor,
      getRequestId(request),
    );
  }
}
