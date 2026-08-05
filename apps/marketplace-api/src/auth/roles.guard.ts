import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import type { Request } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import type { CurrentUser } from './current-user.interface';
import { REQUIRED_ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'You do not have permission to perform this action',
        details: {
          requiredRoles,
          receivedRole: userRole ?? null,
        },
      });
    }

    return true;
  }
}
