import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus, OrganisationStatus, UserStatus, type RefreshToken } from '@prisma/client';
import type { Request } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { hashRefreshToken } from './crypto.util';

export interface RefreshTokenContext {
  refreshToken: RefreshToken;
  presentedToken: string;
  role: string;
}

type RefreshTokenRequest = Request & {
  refreshTokenContext?: RefreshTokenContext;
};

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RefreshTokenRequest>();
    const presentedToken = (request.body as { refreshToken?: string } | undefined)?.refreshToken;

    if (!presentedToken) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'A refreshToken is required',
      });
    }

    const tokenHash = hashRefreshToken(presentedToken);
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
      },
    });

    if (
      !refreshToken ||
      refreshToken.revokedAt ||
      refreshToken.expiresAt.getTime() < Date.now() ||
      refreshToken.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Refresh token is invalid, expired or revoked',
      });
    }

    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        id: refreshToken.membershipId,
        userId: refreshToken.userId,
        status: MembershipStatus.ACTIVE,
        organisation: {
          status: OrganisationStatus.ACTIVE,
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Refresh token no longer matches an active user membership',
      });
    }

    request.refreshTokenContext = {
      refreshToken,
      presentedToken,
      role: membership.role,
    };

    return true;
  }
}
