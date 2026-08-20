import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { installShutdownHandlers } from './common/shutdown';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { validateEnv } from './config/env.schema';

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
    const openApiConfig = new DocumentBuilder()
      .setTitle('Vardhnam Agrotech Marketplace API')
      .setDescription(
        'Phase 4E onboarding, audit, catalogue, inventory, distributor offer, farmer-safe discovery, operational reporting, farmer profile, cart, checkout, product order, mock payment and distributor fulfilment (accept/pack/invoice/dispatch/delivery) foundation API. Mock-only integrations.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Stops accepting connections, waits for in-flight work and runs every
  // shutdown hook, so a rolling deploy neither drops requests nor leaves Prisma
  // and Redis connections behind. Deliberately *instead of*
  // `app.enableShutdownHooks()` -- see `installShutdownHandlers`.
  installShutdownHandlers(app, logger, 'Bootstrap');

  await app.listen(env.PORT);
  logger.log(`Marketplace API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
