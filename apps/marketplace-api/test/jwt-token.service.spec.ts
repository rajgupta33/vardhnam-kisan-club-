import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from '../src/auth/jwt-token.service';

describe('JwtTokenService membership selection tokens', () => {
  const secret = 'test-selection-secret-at-least-32-characters';
  const jwtService = new JwtService();
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return secret;
      if (key === 'JWT_ACCESS_TTL') return '15m';
      throw new Error(`Unexpected configuration key ${key}`);
    }),
  };
  const service = new JwtTokenService(jwtService, configService as never);

  it('binds a selection token to the eligible membership IDs', () => {
    const token = service.signSelectionToken('user-1', ['membership-1', 'membership-2']);

    expect(service.verifySelectionToken(token)).toMatchObject({
      sub: 'user-1',
      purpose: 'membership-selection',
      membershipIds: ['membership-1', 'membership-2'],
    });
  });

  it('rejects a selection token without a bounded membership list', () => {
    const unboundedToken = jwtService.sign(
      { sub: 'user-1', purpose: 'membership-selection' },
      { secret, expiresIn: '5m' },
    );

    expect(() => service.verifySelectionToken(unboundedToken)).toThrow(UnauthorizedException);
  });
});
