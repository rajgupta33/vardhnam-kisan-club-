import {
  generateOtp,
  generateRefreshToken,
  hashOtp,
  hashRefreshToken,
  hashPassword,
  verifyPassword,
} from './crypto.util';

describe('crypto.util', () => {
  describe('password hashing', () => {
    it('round-trips a correct password', async () => {
      const hash = await hashPassword('Demo@12345');
      await expect(verifyPassword('Demo@12345', hash)).resolves.toBe(true);
    });

    it('rejects an incorrect password', async () => {
      const hash = await hashPassword('Demo@12345');
      await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    });

    it('uses a distinct random salt per call', async () => {
      const first = await hashPassword('Demo@12345');
      const second = await hashPassword('Demo@12345');
      expect(first).not.toBe(second);
    });

    it('rejects a malformed stored hash', async () => {
      await expect(verifyPassword('Demo@12345', 'not-a-valid-hash')).resolves.toBe(false);
    });
  });

  describe('OTP hashing', () => {
    it('generates a 6-digit code and a matching hash', () => {
      const { code, salt, hash } = generateOtp();
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(hashOtp(code, salt)).toBe(hash);
    });

    it('is deterministic for the same code and salt', () => {
      expect(hashOtp('123456', 'fixed-salt')).toBe(hashOtp('123456', 'fixed-salt'));
    });

    it('produces a different hash for a different code', () => {
      expect(hashOtp('123456', 'fixed-salt')).not.toBe(hashOtp('654321', 'fixed-salt'));
    });
  });

  describe('refresh token hashing', () => {
    it('generates a token whose hash matches hashRefreshToken', () => {
      const { token, hash } = generateRefreshToken();
      expect(hashRefreshToken(token)).toBe(hash);
    });

    it('generates distinct tokens per call', () => {
      const first = generateRefreshToken();
      const second = generateRefreshToken();
      expect(first.token).not.toBe(second.token);
    });
  });
});
