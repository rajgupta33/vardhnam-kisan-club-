import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { JsonLoggerService } from './common/logger/json-logger.service';
import { installShutdownHandlers } from './common/shutdown';
import { validateEnv } from './config/env.schema';

/**
 * Worker entrypoint: the same Nest application, with queues consumed and no HTTP
 * server listening.
 *
 * `WORKER_MODE` is forced on here rather than left to the environment, so that
 * starting the worker can never silently produce a process that consumes
 * nothing.
 *
 * Two ordering constraints make this bootstrap look fussier than `main.ts`, and
 * both are load-bearing:
 *
 * 1. `AppModule` is imported **dynamically, after** `WORKER_MODE` is set. A
 *    static import would be hoisted above the assignment, and
 *    `ConfigModule.forRoot()` runs when `app.module.ts` is evaluated -- so the
 *    environment would be validated and cached with `WORKER_MODE` still false.
 *    The worker would boot, log happily, and consume nothing.
 * 2. `validateEnv` runs **after** that import, because evaluating `AppModule` is
 *    what loads the `.env` file into `process.env`. Validating first sees no
 *    `DATABASE_URL`, `REDIS_URL` or `JWT_ACCESS_SECRET` and throws. (`main.ts`
 *    has the same dependency, hidden by its static import.)
 *
 * Do not reorder these three statements.
 */
async function bootstrapWorker(): Promise<void> {
  process.env.WORKER_MODE = 'true';
  const { AppModule } = await import('./app.module');
  const env = validateEnv(process.env);

  const logger = new JsonLoggerService(env.LOG_LEVEL);
  const app = await NestFactory.createApplicationContext(AppModule, { logger });

  // Drains in-flight jobs and runs every shutdown hook. Deliberately *instead
  // of* `app.enableShutdownHooks()`, which would install a second signal
  // listener racing this one on the same `app.close()` -- see
  // `installShutdownHandlers`.
  installShutdownHandlers(app, logger, 'WorkerBootstrap');

  logger.log(
    `Marketplace worker started (concurrency ${env.WORKER_CONCURRENCY}, prefix ${env.QUEUE_PREFIX})`,
    'WorkerBootstrap',
  );
}

void bootstrapWorker();
