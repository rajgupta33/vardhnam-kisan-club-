import { PlatformRole } from '@prisma/client';
import { AuthController } from '../src/auth/auth.controller';
import type { AuthService } from '../src/auth/auth.service';
import type { CurrentUser } from '../src/auth/current-user.interface';

describe('AuthController', () => {
  it('returns the guard-validated current session context', () => {
    const controller = new AuthController({} as AuthService);
    const actor: CurrentUser = {
      userId: '00000000-0000-4000-8000-000000000001',
      membershipId: '00000000-0000-4000-8000-000000000002',
      organisationId: '00000000-0000-4000-8000-000000000003',
      role: PlatformRole.FINANCE_MANAGER,
      permissions: ['finance-ledger:read'],
    };

    expect(controller.session(actor)).toEqual(actor);
  });
});
