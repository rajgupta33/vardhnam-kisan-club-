import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KisanClubModule } from '../kisan-club/kisan-club.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PrismaModule, AuditModule, AccessModule, KisanClubModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
