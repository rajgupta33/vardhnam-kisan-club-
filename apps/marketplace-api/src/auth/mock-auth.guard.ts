import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipStatus, OrganisationStatus, PlatformRole, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './current-user.interface';
import { JwtTokenService } from './jwt-token.service';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authMode = this.configService.get<string>('AUTH_MODE');
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (authMode === 'production') {
      return this.canActivateProduction(request);
    }

    if (authMode !== 'mock') {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Unsupported AUTH_MODE configuration',
      });
    }

    const userId = request.header('x-user-id');
    const roleHeader = request.header('x-user-role');
    const organisationId = request.header('x-organisation-id');

    if (!userId || !roleHeader || !organisationId || !this.isPlatformRole(roleHeader)) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Mock auth requires x-user-id, x-user-role and x-organisation-id headers',
      });
    }

    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        userId,
        organisationId,
        role: roleHeader,
        status: MembershipStatus.ACTIVE,
        user: {
          status: UserStatus.ACTIVE,
        },
        organisation: {
          status: OrganisationStatus.ACTIVE,
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Mock auth headers must match an active user membership',
      });
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: roleHeader,
      },
      include: {
        permission: true,
      },
    });

    request.user = {
      userId,
      role: roleHeader,
      membershipId: membership.id,
      organisationId,
      permissions: rolePermissions.map((rolePermission) => rolePermission.permission.code),
    };

    return true;
  }

  private async canActivateProduction(request: AuthenticatedRequest): Promise<boolean> {
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'A Bearer access token is required',
      });
    }

    const payload = this.jwtTokenService.verifyAccessToken(token);

    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        id: payload.membershipId,
        userId: payload.sub,
        organisationId: payload.organisationId,
        role: payload.role,
        status: MembershipStatus.ACTIVE,
        user: {
          status: UserStatus.ACTIVE,
        },
        organisation: {
          status: OrganisationStatus.ACTIVE,
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHENTICATED,
        message: 'Access token no longer matches an active user membership',
      });
    }

    request.user = {
      userId: payload.sub,
      role: payload.role,
      membershipId: membership.id,
      organisationId: payload.organisationId,
      permissions: payload.permissions,
    };

    return true;
  }

  private isPlatformRole(value: string): value is PlatformRole {
    return Object.values(PlatformRole).includes(value as PlatformRole);
  }
}
