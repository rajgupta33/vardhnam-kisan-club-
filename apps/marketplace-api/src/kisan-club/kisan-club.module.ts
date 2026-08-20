import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromotersModule } from '../promoters/promoters.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { KisanClubAssignmentController } from './assignment/kisan-club-assignment.controller';
import { KisanClubAssignmentService } from './assignment/kisan-club-assignment.service';
import { KisanClubPromoterAdminService } from './assignment/kisan-club-promoter-admin.service';
import { PromoterMatchingService } from './assignment/promoter-matching.service';
import { KisanClubCatalogueController } from './catalogue/kisan-club-catalogue.controller';
import { KisanClubBenefitService } from './benefits/kisan-club-benefit.service';
import { KisanClubBenefitTokenController } from './benefits/kisan-club-benefit-token.controller';
import { KisanClubBenefitTokenService } from './benefits/kisan-club-benefit-token.service';
import { KisanClubCatalogueService } from './catalogue/kisan-club-catalogue.service';
import { KisanClubProgrammeService } from './catalogue/kisan-club-programme.service';
import { KisanClubEnabledGuard } from './kisan-club-enabled.guard';
import { KisanClubMembershipController } from './membership/kisan-club-membership.controller';
import { KisanClubMembershipService } from './membership/kisan-club-membership.service';
import { KisanClubFulfilmentController } from './fulfilment/kisan-club-fulfilment.controller';
import { KisanClubFulfilmentService } from './fulfilment/kisan-club-fulfilment.service';
import { KisanClubIntelligenceController } from './intelligence/kisan-club-intelligence.controller';
import { KisanClubIntelligenceService } from './intelligence/kisan-club-intelligence.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AccessModule,
    AuthModule,
    PromotersModule,
    MarketplaceModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 5 }]),
  ],
  controllers: [
    KisanClubMembershipController,
    KisanClubAssignmentController,
    KisanClubCatalogueController,
    KisanClubFulfilmentController,
    KisanClubBenefitTokenController,
    KisanClubIntelligenceController,
  ],
  providers: [
    KisanClubMembershipService,
    KisanClubAssignmentService,
    KisanClubPromoterAdminService,
    PromoterMatchingService,
    KisanClubCatalogueService,
    KisanClubProgrammeService,
    KisanClubBenefitService,
    KisanClubEnabledGuard,
    KisanClubFulfilmentService,
    KisanClubBenefitTokenService,
    KisanClubIntelligenceService,
  ],
  exports: [
    KisanClubMembershipService,
    KisanClubAssignmentService,
    KisanClubBenefitService,
    KisanClubFulfilmentService,
    KisanClubEnabledGuard,
    KisanClubBenefitTokenService,
  ],
})
export class KisanClubModule {}
