import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { validateEnv } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const env = validateEnv(process.env);
  const logger = new JsonLoggerService(env.LOG_LEVEL);
  const app = await NestFactory.create(AppModule, { logger });

  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

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

  await app.listen(env.PORT);
  logger.log(`Marketplace API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
