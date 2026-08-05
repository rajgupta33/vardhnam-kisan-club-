import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { PlatformRole } from '@prisma/client';
import type { SignOptions } from 'jsonwebtoken';
import { ApiErrorCode } from '../common/errors/api-error-codes';

export interface AccessTokenPayload {
  sub: string;
  membershipId: string;
  organisationId: string;
  role: PlatformRole;
  permissions: string[];
}

export interface SelectionTokenPayload {
  sub: string;
  purpose: 'membership-selection';
}

const SELECTION_TOKEN_TTL = '5m';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL') as NonNullable<SignOptions['expiresIn']>,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Access token is invalid or expired',
      });
    }
  }

  signSelectionToken(userId: string): string {
    const payload: SelectionTokenPayload = { sub: userId, purpose: 'membership-selection' };
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: SELECTION_TOKEN_TTL,
    });
  }

  verifySelectionToken(token: string): SelectionTokenPayload {
    try {
      const payload = this.jwtService.verify<SelectionTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.purpose !== 'membership-selection') {
        throw new Error('wrong token purpose');
      }
      return payload;
    } catch {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Selection token is invalid or expired',
      });
    }
  }
}
