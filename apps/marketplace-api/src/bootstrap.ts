import { ValidationPipe, type INestApplication } from '@nestjs/common';
import express from 'express';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import type { AppEnvironment } from './config/env.schema';

/**
 * Everything applied to the Nest application between construction and listening.
 *
 * This lived inline in `main.ts`, which meant none of it could be tested and
 * none of it existed in the integration suite -- specs assembled their own
 * pipeline by hand, so security headers, body limits and parser behaviour were
 * production-only and unverified. Pulling it into one function makes the
 * hardening assertable (`test/integration/api-hardening.spec.ts`) and gives
 * specs a way to run against the same pipeline the real process uses.
 *
 * Order matters here and is not cosmetic -- see the comments inline.
 */
export function configureApp(app: INestApplication, env: AppEnvironment): void {
  // Security headers first, so they are present on every response including
  // those short-circuited by a guard, the exception filter or the body parser.
  //
  // `contentSecurityPolicy` is disabled only outside production, where Swagger
  // UI is mounted and its inline bootstrap script would otherwise be blocked.
  // In production Swagger is not served at all, so the default CSP applies and
  // nothing needs an exception.
  app.use(
    helmet({
      ...(env.NODE_ENV === 'production' ? {} : { contentSecurityPolicy: false as const }),
      // The API is consumed by mobile apps and a separate web origin; it serves
      // no cross-origin documents of its own, and COEP breaks Swagger UI.
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });

  // An explicit ceiling on request bodies. Uploads never come through the API --
  // clients PUT bytes straight to object storage with a presigned URL -- so no
  // legitimate request is anywhere near this size.
  //
  // `verify` re-attaches the untouched bytes that `rawBody: true` relies on:
  // registering our own parsers replaces Nest's, which is where that hook
  // normally lives, and payment webhook signatures are computed over the exact
  // bytes received. Losing it would make every webhook fail signature checks.
  const limit = env.REQUEST_BODY_LIMIT_BYTES;
  const keepRawBody = (
    request: express.Request & { rawBody?: Buffer },
    _response: express.Response,
    buffer: Buffer,
  ): void => {
    if (buffer?.length) request.rawBody = Buffer.from(buffer);
  };
  app.use(express.json({ limit, verify: keepRawBody }));
  app.use(express.urlencoded({ extended: true, limit, verify: keepRawBody }));

  app.use(correlationIdMiddleware);
  app.setGlobalPrefix(env.API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
}
