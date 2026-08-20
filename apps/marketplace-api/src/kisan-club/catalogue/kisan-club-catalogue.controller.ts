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
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../../access/permission-codes';
import { PermissionsGuard } from '../../access/permissions.guard';
import { RequirePermissions } from '../../access/require-permissions.decorator';
import { CurrentUserContext } from '../../auth/current-user.decorator';
import type { CurrentUser } from '../../auth/current-user.interface';
import { MockAuthGuard } from '../../auth/mock-auth.guard';
import { getRequestId } from '../../common/middleware/correlation-id.middleware';
import { ListMarketplaceProductsQueryDto } from '../../marketplace/dto/list-marketplace-products-query.dto';
import { MarketplaceProductDetailQueryDto } from '../../marketplace/dto/marketplace-product-detail-query.dto';
import { CreateKisanClubProgrammeDto } from '../dto/create-kisan-club-programme.dto';
import { CreateKisanClubBenefitRuleDto } from '../dto/create-kisan-club-benefit-rule.dto';
import { ListKisanClubBenefitRulesQueryDto } from '../dto/list-kisan-club-benefit-rules-query.dto';
import { ListKisanClubProgrammesQueryDto } from '../dto/list-kisan-club-programmes-query.dto';
import { UpdateKisanClubProgrammeDto } from '../dto/update-kisan-club-programme.dto';
import { UpdateKisanClubBenefitRuleDto } from '../dto/update-kisan-club-benefit-rule.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubBenefitService } from '../benefits/kisan-club-benefit.service';
import { KisanClubCatalogueService } from './kisan-club-catalogue.service';
import { KisanClubProgrammeService } from './kisan-club-programme.service';

@ApiTags('kisan-club')
@Controller('kisan-club')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
export class KisanClubCatalogueController {
  constructor(
    private readonly catalogueService: KisanClubCatalogueService,
    private readonly programmeService: KisanClubProgrammeService,
    private readonly benefitService: KisanClubBenefitService,
  ) {}

  @Get('products')
  @RequirePermissions(PermissionCode.KISAN_CLUB_CATALOGUE_READ_OWN)
  listProducts(
    @Query() query: ListMarketplaceProductsQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.catalogueService.listProducts(query, actor);
  }

  @Get('products/:productId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_CATALOGUE_READ_OWN)
  getProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: MarketplaceProductDetailQueryDto,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.catalogueService.getProduct(productId, query, actor);
  }

  @Get('programmes')
  @RequirePermissions(PermissionCode.KISAN_CLUB_PROGRAMMES_MANAGE)
  listProgrammes(@Query() query: ListKisanClubProgrammesQueryDto) {
    return this.programmeService.listProgrammes(query);
  }

  @Post('programmes')
  @RequirePermissions(PermissionCode.KISAN_CLUB_PROGRAMMES_MANAGE)
  createProgramme(
    @Body() dto: CreateKisanClubProgrammeDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.programmeService.createProgramme(dto, actor, getRequestId(request));
  }

  @Patch('programmes/:programmeId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_PROGRAMMES_MANAGE)
  updateProgramme(
    @Param('programmeId', ParseUUIDPipe) programmeId: string,
    @Body() dto: UpdateKisanClubProgrammeDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.programmeService.updateProgramme(programmeId, dto, actor, getRequestId(request));
  }

  @Get('benefit-rules')
  @RequirePermissions(PermissionCode.KISAN_CLUB_BENEFITS_MANAGE)
  listBenefitRules(@Query() query: ListKisanClubBenefitRulesQueryDto) {
    return this.benefitService.listRules(query);
  }

  @Post('benefit-rules')
  @RequirePermissions(PermissionCode.KISAN_CLUB_BENEFITS_MANAGE)
  createBenefitRule(
    @Body() dto: CreateKisanClubBenefitRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.benefitService.createRule(dto, actor, getRequestId(request));
  }

  @Patch('benefit-rules/:ruleId')
  @RequirePermissions(PermissionCode.KISAN_CLUB_BENEFITS_MANAGE)
  updateBenefitRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateKisanClubBenefitRuleDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.benefitService.updateRule(ruleId, dto, actor, getRequestId(request));
  }
}
