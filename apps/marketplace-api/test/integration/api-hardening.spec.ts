import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * WP-16 API hardening: security headers, a global rate limit, an explicit
 * request body ceiling.
 *
 * These are configured in `configureApp` rather than inline in `main.ts` so
 * that this spec can exercise the same pipeline the real process runs. Asserting
 * them here matters more than usual, because every one of them is invisible in
 * normal use -- a missing header or an absent rate limit breaks nothing that any
 * other test would notice, right up until it is exploited.
 *
 * The rate limit is deliberately tiny here. `AppModule` reads it through
 * `ConfigService` at module construction, and `ConfigModule.forRoot()` runs when
 * `app.module.ts` is first evaluated -- so the value has to be in `process.env`
 * before that import happens. A static import would be hoisted above the
 * assignment, which is why both the module and the bootstrap helper are pulled
 * in dynamically inside `beforeAll`.
 */
describe('API hardening', () => {
  let app: INestApplication;
  const rateLimit = 5;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_MODE = 'mock';
    process.env.API_PREFIX = process.env.API_PREFIX ?? 'api/v1';
    process.env.RATE_LIMIT_LIMIT = String(rateLimit);
    process.env.RATE_LIMIT_TTL_SECONDS = '60';
    process.env.REQUEST_BODY_LIMIT_BYTES = String(2 * 1024);

    const [{ AppModule }, { configureApp }, { validateEnv }] = await Promise.all([
      import('../../src/app.module'),
      import('../../src/bootstrap'),
      import('../../src/config/env.schema'),
    ]);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app, validateEnv(process.env));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.RATE_LIMIT_LIMIT;
    delete process.env.RATE_LIMIT_TTL_SECONDS;
    delete process.env.REQUEST_BODY_LIMIT_BYTES;
  });

  it('sets security headers and withholds the framework fingerprint', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['x-frame-options']?.toUpperCase()).toBe('SAMEORIGIN');
    expect(response.headers['referrer-policy']).toBeDefined();
    // helmet removes this; leaving it advertises the stack to a scanner.
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('refuses a request body over the configured ceiling', async () => {
    // Comfortably past the 2KB limit set for this spec.
    const oversized = { note: 'x'.repeat(8 * 1024) };

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send(oversized);

    // 413 from the body parser, before any handler, DTO validation or auth runs.
    // It has to be a client error: body-parser throws a plain Error rather than
    // an HttpException, so without explicit handling this surfaced as a 500 and
    // reported a caller mistake as a server fault.
    expect(response.status).toBe(413);
    expect(response.body?.error).toMatchObject({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('reports malformed JSON as a client error rather than a server fault', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .set('Content-Type', 'application/json')
      .send('{"phone": ');

    expect(response.status).toBe(400);
    expect(response.body?.error).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
  });

  it('rate limits every route, not only the ones that opt in', async () => {
    // `/health` declares no `@Throttle` of its own. Before the global guard it
    // was completely unlimited, which is the gap this covers.
    //
    // The bucket is keyed by client IP and shared with every other test in this
    // file, so the budget is already partly spent. Drive it until it trips
    // rather than assuming a full allowance, with a bound so a guard that never
    // engages fails the test instead of looping forever.
    const server = app.getHttpServer();
    let limited: request.Response | undefined;
    for (let attempt = 0; attempt < rateLimit + 2 && !limited; attempt += 1) {
      const response = await request(server).get('/api/v1/health');
      if (response.status === 429) limited = response;
      else expect(response.status).toBe(200);
    }

    expect(limited).toBeDefined();
    // Throttled requests still come back in the API's error envelope rather
    // than as the framework's bare default.
    expect(limited?.body?.error).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
