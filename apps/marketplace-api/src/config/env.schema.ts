import { z } from 'zod';

const booleanFromEnvironment = z.preprocess((value) => {
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return value;
}, z.boolean());

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
  KISAN_CLUB_ENABLED: booleanFromEnvironment.default(false),
  KISAN_CLUB_BENEFIT_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(72),
  KISAN_CLUB_MAX_ACTIVE_FARMERS_PER_PROMOTER: z.coerce.number().int().positive().default(150),
  DEFAULT_KISAN_CLUB_PROMOTER_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  KISAN_CLUB_ADVISORY_CROP_PROTECTION_ENABLED: booleanFromEnvironment.default(false),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // Background jobs. An API process enqueues but never consumes: WORKER_MODE is
  // set only by the dedicated worker entrypoint (`npm run start:worker`), so
  // request latency stays independent of job load and the two scale separately.
  WORKER_MODE: booleanFromEnvironment.default(false),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(100).default(5),
  JOB_MAX_ATTEMPTS: z.coerce.number().int().positive().max(20).default(5),
  // Namespaces queue keys so environments sharing a Redis instance cannot
  // consume each other's jobs.
  QUEUE_PREFIX: z.string().min(1).default('vardhnam'),
  SCHEDULER_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  // File and document storage (WP-08). Only `local` is implemented; a cloud
  // provider is pending the hosting decision. The module throws on any other
  // value rather than silently writing uploads to a container filesystem.
  STORAGE_PROVIDER: z.literal('local').default('local'),
  STORAGE_LOCAL_ROOT: z.string().min(1).default('.storage'),
  // Base URL clients use to reach this API. The local storage provider builds
  // its signed upload/download URLs from it.
  PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3001'),
  STORAGE_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3_600).default(900),
  STORAGE_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3_600).default(300),
  // `mock` recognises the EICAR test string and passes everything else. It is
  // not virus scanning; a real scanner is required before real uploads.
  VIRUS_SCANNER: z.literal('mock').default('mock'),
  // Notification transports (WP-06). Only `mock` is implemented; the provider
  // registry throws on any other value rather than silently failing to deliver,
  // because a swallowed OTP leaves a user unable to log in with nothing in the
  // logs to explain why.
  SMS_PROVIDER: z.literal('mock').default('mock'),
  WHATSAPP_PROVIDER: z.literal('mock').default('mock'),
  EMAIL_PROVIDER: z.literal('mock').default('mock'),
  PUSH_PROVIDER: z.literal('mock').default('mock'),
  // Payment gateway (WP-07). Only `mock` is implemented; the registry throws on
  // any other value rather than falling back, because a silent fallback would
  // mean the platform believes it took a farmer's money when nothing was
  // charged. The mock signs and verifies webhooks with the same HMAC-SHA256
  // scheme as the real gateways, so the security path is exercised in CI.
  PAYMENT_PROVIDER: z.literal('mock').default('mock'),
  // Shared secret the gateway signs webhook bodies with. The default exists so
  // development and CI work out of the box against the mock; WP-16 must supply
  // a real one from secret management before any environment takes real money.
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('vardhnam-mock-webhook-secret-dev'),
  // How long an intent may sit in PROCESSING before reconciliation asks the
  // gateway directly. Short enough that a stuck payment is caught the same day,
  // long enough that a farmer still on the gateway's page is not chased.
  PAYMENT_RECONCILIATION_STALE_MINUTES: z.coerce.number().int().positive().max(1_440).default(30),
  TALLY_PROVIDER: z.literal('mock').default('mock'),
  // API hardening (WP-16).
  //
  // The default rate limit applies to every route through a global guard. It is
  // deliberately generous: it exists to blunt scripted abuse and runaway
  // clients, not to shape normal traffic. Routes that genuinely need to be
  // strict -- OTP request, payment confirmation, OTP-bearing delivery actions --
  // declare their own much smaller `@Throttle` and are unaffected by this value.
  //
  // Counting is per API instance, because the throttler's in-memory store is
  // per process. Behind N replicas the effective ceiling is N x this number.
  // That is acceptable for the pilot and wrong for scale-out; a shared store is
  // the fix, and it is listed in the go-live work rather than hidden here.
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().max(3_600).default(60),
  RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(300),
  // Express defaults to a 100kb body. That is enough for every request this API
  // accepts -- file bytes go straight to object storage over a presigned URL and
  // never through here -- but the limit is set explicitly so it is a decision
  // rather than a framework default nobody chose.
  REQUEST_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024)
    .default(512 * 1024),
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
