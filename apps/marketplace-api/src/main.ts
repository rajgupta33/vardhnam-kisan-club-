import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { installShutdownHandlers } from './common/shutdown';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { validateEnv } from './config/env.schema';
import { createOpenApiDocument } from './openapi';

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);
  const logger = new JsonLoggerService(env.LOG_LEVEL);
  // `rawBody` keeps the verbatim request bytes on `request.rawBody`. Payment
  // webhook signatures are computed over those exact bytes, and a re-serialised
  // body reorders keys and changes whitespace, so a signature checked against
  // the parsed object would never match.
  const app = await NestFactory.create(AppModule, { logger, rawBody: true });

  configureApp(app, env);

  if (env.NODE_ENV !== 'production') {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Stops accepting connections, waits for in-flight work and runs every
  // shutdown hook, so a rolling deploy neither drops requests nor leaves Prisma
  // and Redis connections behind. Deliberately *instead of*
  // `app.enableShutdownHooks()` -- see `installShutdownHandlers`.
  installShutdownHandlers(app, logger, 'Bootstrap');

  // Railway and other container platforms route traffic to the container's
  // network interface. Binding explicitly avoids an accidental localhost-only
  // listener while still honouring the platform-provided PORT.
  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`Marketplace API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
