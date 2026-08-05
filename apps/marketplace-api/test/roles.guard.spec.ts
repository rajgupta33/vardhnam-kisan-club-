import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { RolesGuard } from '../src/auth/roles.guard';

describe('RolesGuard', () => {
  it('rejects users without a required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PlatformRole.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1', role: PlatformRole.FARMER },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(/permission/);
  });

  it('allows users with a required role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PlatformRole.SUPER_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'user-1', role: PlatformRole.SUPER_ADMIN },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
