import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { KisanClubEnabledGuard } from '../src/kisan-club/kisan-club-enabled.guard';

describe('KisanClubEnabledGuard', () => {
  it('returns a not-found response while the programme kill switch is off', () => {
    const config = { get: jest.fn().mockReturnValue(false) } as unknown as ConfigService;
    const guard = new KisanClubEnabledGuard(config);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('allows Club routes while the programme is enabled', () => {
    const config = { get: jest.fn().mockReturnValue(true) } as unknown as ConfigService;
    const guard = new KisanClubEnabledGuard(config);

    expect(guard.canActivate()).toBe(true);
  });
});
