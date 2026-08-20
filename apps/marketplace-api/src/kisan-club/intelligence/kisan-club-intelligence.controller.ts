import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionCode } from '../../access/permission-codes';
import { PermissionsGuard } from '../../access/permissions.guard';
import { RequirePermissions } from '../../access/require-permissions.decorator';
import { MockAuthGuard } from '../../auth/mock-auth.guard';
import { KisanClubCropIntelligenceQueryDto } from '../dto/kisan-club-crop-intelligence-query.dto';
import { KisanClubPromoterPerformanceQueryDto } from '../dto/kisan-club-promoter-performance-query.dto';
import { KisanClubEnabledGuard } from '../kisan-club-enabled.guard';
import { KisanClubIntelligenceService } from './kisan-club-intelligence.service';

@ApiTags('kisan-club')
@Controller('kisan-club/intelligence')
@UseGuards(KisanClubEnabledGuard, MockAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.KISAN_CLUB_INTELLIGENCE_READ)
export class KisanClubIntelligenceController {
  constructor(private readonly intelligenceService: KisanClubIntelligenceService) {}

  @Get('crop-summary')
  cropSummary(@Query() query: KisanClubCropIntelligenceQueryDto) {
    return this.intelligenceService.cropSummary(query);
  }

  @Get('promoter-performance')
  promoterPerformance(@Query() query: KisanClubPromoterPerformanceQueryDto) {
    return this.intelligenceService.promoterPerformance(query);
  }
}
