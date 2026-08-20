import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AdvisoryModule } from './advisory/advisory.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { AccessModule } from './access/access.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CheckoutModule } from './checkout/checkout.module';
import { validateEnv } from './config/env.schema';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DeliveryPartnersModule } from './delivery-partners/delivery-partners.module';
import { DisputesModule } from './disputes/disputes.module';
import { FarmersModule } from './farmers/farmers.module';
import { FinanceModule } from './finance/finance.module';
import { FarmsModule } from './farms/farms.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InventoryModule } from './inventory/inventory.module';
import { JobsModule } from './jobs/jobs.module';
import { KisanClubModule } from './kisan-club/kisan-club.module';
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
import { RefundsModule } from './refunds/refunds.module';
import { ReturnsModule } from './returns/returns.module';
import { ReturnPickupsModule } from './return-pickups/return-pickups.module';
import { StorageModule } from './storage/storage.module';
import { SupportModule } from './support/support.module';
import { TallyModule } from './tally/tally.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    // One throttler definition for the whole application. It used to be
    // declared separately in `AuthModule` and `CheckoutModule`, which meant the
    // limit a route got depended on which module happened to register the
    // config -- and every route outside those two modules got none at all.
    //
    // The `default` bucket configured here is the permissive global ceiling.
    // Routes that need to be strict override it with `@Throttle({ default: … })`
    // at the handler, which is how the auth and OTP-bearing routes already
    // express their limits, so those keep working unchanged.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.getOrThrow<number>('RATE_LIMIT_TTL_SECONDS') * 1_000,
          limit: configService.getOrThrow<number>('RATE_LIMIT_LIMIT'),
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    JobsModule,
    StorageModule,
    ReturnsModule,
    DisputesModule,
    ReturnPickupsModule,
    RefundsModule,
    AuditModule,
    AuthModule,
    AccessModule,
    AdvisoryModule,
    HealthModule,
    IdentityModule,
    CatalogueModule,
    FarmersModule,
    InventoryModule,
    KisanClubModule,
    MarketplaceModule,
    OffersModule,
    CartModule,
    CheckoutModule,
    PaymentsModule,
    FinanceModule,
    FarmsModule,
    PromotersModule,
    PayoutsModule,
    SupportModule,
    TallyModule,
    NotificationsModule,
    DashboardsModule,
    DeliveryPartnersModule,
    OnboardingModule,
    OrganisationsModule,
  ],
  controllers: [AppController],
  providers: [
    // Applied to every route, so a new controller is rate limited by default
    // rather than by remembering to add a guard. Handler-level `@Throttle`
    // still narrows it where a route needs to be stricter.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
