import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { AccessModule } from './access/access.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CheckoutModule } from './checkout/checkout.module';
import { validateEnv } from './config/env.schema';
import { DashboardsModule } from './dashboards/dashboards.module';
import { FarmersModule } from './farmers/farmers.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InventoryModule } from './inventory/inventory.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { OffersModule } from './offers/offers.module';
import { PaymentsModule } from './payments/payments.module';
import { PayoutsModule } from './payouts/payouts.module';
import { PrismaModule } from './prisma/prisma.module';
import { PromotersModule } from './promoters/promoters.module';
import { RedisModule } from './redis/redis.module';
import { SupportModule } from './support/support.module';
import { TallyModule } from './tally/tally.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    AccessModule,
    HealthModule,
    IdentityModule,
    CatalogueModule,
    FarmersModule,
    InventoryModule,
    MarketplaceModule,
    OffersModule,
    CartModule,
    CheckoutModule,
    PaymentsModule,
    FinanceModule,
    PromotersModule,
    PayoutsModule,
    SupportModule,
    TallyModule,
    NotificationsModule,
    DashboardsModule,
    OnboardingModule,
    OrganisationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
