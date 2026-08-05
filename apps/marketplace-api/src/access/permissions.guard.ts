import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import type { CurrentUser } from '../auth/current-user.interface';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const grantedPermissions = new Set(user?.permissions ?? []);
    const missingPermissions = requiredPermissions.filter(
      (permission) => !grantedPermissions.has(permission),
    );

    if (!user || missingPermissions.length > 0) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'You do not have permission to perform this action',
        details: {
          requiredPermissions,
          missingPermissions,
          receivedRole: user?.role ?? null,
        },
      });
    }

    return true;
  }
}
