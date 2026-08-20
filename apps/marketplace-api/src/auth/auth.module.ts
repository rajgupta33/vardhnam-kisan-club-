import { forwardRef, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { AuditModule } from '../audit/audit.module';
import { NotificationTransportModule } from '../notifications/notification-transport.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtTokenService } from './jwt-token.service';
import { MockAuthGuard } from './mock-auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [
    forwardRef(() => AuditModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('JWT_ACCESS_TTL') as NonNullable<SignOptions['expiresIn']>,
        },
      }),
    }),
    NotificationTransportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtTokenService, MockAuthGuard, RefreshTokenGuard, RolesGuard],
  exports: [AuthService, JwtTokenService, MockAuthGuard, RefreshTokenGuard, RolesGuard],
})
export class AuthModule {}
