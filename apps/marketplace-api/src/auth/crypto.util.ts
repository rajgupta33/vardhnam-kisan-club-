import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST_PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_COST_PARAMS);

  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hashHex] = parts as [string, string, string];
  const expected = Buffer.from(hashHex, 'hex');
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_COST_PARAMS);

  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export function generateOtp(): { code: string; salt: string; hash: string } {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const salt = randomUUID();

  return { code, salt, hash: hashOtp(code, salt) };
}

export function hashOtp(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
