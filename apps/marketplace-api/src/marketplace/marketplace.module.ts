import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
