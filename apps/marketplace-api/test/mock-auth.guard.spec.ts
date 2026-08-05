import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PlatformRole } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import { MockAuthGuard } from '../src/auth/mock-auth.guard';

function contextWithHeaders(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => headers[name],
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('MockAuthGuard', () => {
  it('requires active database membership matching mock headers', async () => {
    const config = {
      get: jest.fn().mockReturnValue('mock'),
    } as unknown as ConfigService;
    const prisma = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      rolePermission: {
        findMany: jest.fn(),
      },
    };
    const guard = new MockAuthGuard(config, prisma as never, {} as never);

    await expect(
      guard.canActivate(
        contextWithHeaders({
          'x-user-id': 'user-1',
          'x-user-role': PlatformRole.ADMIN,
          'x-organisation-id': 'org-1',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches current user permissions from the role mapping', async () => {
    const config = {
      get: jest.fn().mockReturnValue('mock'),
    } as unknown as ConfigService;
    const request = {
      header: (name: string) =>
        ({
          'x-user-id': 'user-1',
          'x-user-role': PlatformRole.ADMIN,
          'x-organisation-id': 'org-1',
        })[name],
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    const prisma = {
      organisationMembership: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([
          {
            permission: {
              code: PermissionCode.USERS_CREATE,
            },
          },
        ]),
      },
    };
    const guard = new MockAuthGuard(config, prisma as never, {} as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toEqual({
      userId: 'user-1',
      role: PlatformRole.ADMIN,
      membershipId: 'membership-1',
      organisationId: 'org-1',
      permissions: [PermissionCode.USERS_CREATE],
    });
  });
});
