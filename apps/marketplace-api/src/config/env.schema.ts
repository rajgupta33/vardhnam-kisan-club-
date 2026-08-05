import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().min(1).default('api/v1'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'log', 'warn', 'error']).default('log'),
  AUTH_MODE: z.enum(['mock', 'production']).default('mock'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // Placeholder business values pending real approval, same treatment as
  // ProductInvoice.taxPaise = 0 "until approved GST breakup rules exist".
  RETURN_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
  DEFAULT_MARKETPLACE_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  // No approved promoter commission rate exists yet, so this defaults to 0 --
  // entries are still calculated and provisional, just zero until approved.
  DEFAULT_PROMOTER_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  // Base SLA duration; priority multipliers (urgent/4, high/2, medium x1,
  // low x2) are fixed in code rather than four separate env vars.
  SUPPORT_TICKET_DEFAULT_SLA_HOURS: z.coerce.number().int().positive().default(48),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SMS_PROVIDER: z.literal('mock').default('mock'),
  WHATSAPP_PROVIDER: z.literal('mock').default('mock'),
  EMAIL_PROVIDER: z.literal('mock').default('mock'),
  PAYMENT_PROVIDER: z.literal('mock').default('mock'),
  TALLY_PROVIDER: z.literal('mock').default('mock'),
});

export type AppEnvironment = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnvironment {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return parsed.data;
}
