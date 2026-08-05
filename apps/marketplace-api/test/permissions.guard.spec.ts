import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import { PermissionsGuard } from '../src/access/permissions.guard';

describe('PermissionsGuard', () => {
  it('rejects users missing required permissions', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PermissionCode.USERS_CREATE]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: 'user-1',
            role: PlatformRole.SUPPORT_AGENT,
            membershipId: 'membership-1',
            organisationId: 'org-1',
            permissions: [PermissionCode.USERS_READ_ANY],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows users with all required permissions', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PermissionCode.USERS_CREATE, PermissionCode.AUDIT_READ]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: 'user-1',
            role: PlatformRole.ADMIN,
            membershipId: 'membership-1',
            organisationId: 'org-1',
            permissions: [PermissionCode.USERS_CREATE, PermissionCode.AUDIT_READ],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
