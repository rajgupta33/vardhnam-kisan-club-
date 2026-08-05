import { z } from 'zod';

export const indianPincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid Indian pincode');

export const uuidSchema = z.string().uuid();

export const moneyInPaiseSchema = z.number().int().min(0);

export const localeSchema = z.enum(['en-IN', 'hi-IN']);

export const displayNameSchema = z.string().trim().min(2).max(120);
