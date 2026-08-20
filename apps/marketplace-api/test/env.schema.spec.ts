import { validateEnv } from '../src/config/env.schema';

describe('environment validation', () => {
  it('accepts valid Phase 0 environment variables', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/vardhnam',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
    });

    expect(env.PORT).toBe(3001);
    expect(env.AUTH_MODE).toBe('mock');
    expect(env.PAYMENT_PROVIDER).toBe('mock');
    expect(env.KISAN_CLUB_ENABLED).toBe(false);
  });

  it('parses Kisan Club boolean environment strings without truthy string coercion', () => {
    const common = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/vardhnam',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
    };

    expect(validateEnv({ ...common, KISAN_CLUB_ENABLED: 'false' }).KISAN_CLUB_ENABLED).toBe(false);
    expect(validateEnv({ ...common, KISAN_CLUB_ENABLED: 'true' }).KISAN_CLUB_ENABLED).toBe(true);
  });

  it('rejects non-mock production provider values', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/vardhnam',
        REDIS_URL: 'redis://localhost:6379',
        PAYMENT_PROVIDER: 'real',
      }),
    ).toThrow(/PAYMENT_PROVIDER/);
  });
});
