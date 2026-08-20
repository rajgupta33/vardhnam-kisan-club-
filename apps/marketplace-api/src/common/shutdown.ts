import type { INestApplicationContext, LoggerService } from '@nestjs/common';

/**
 * Closes the application once, on the first termination signal.
 *
 * Do **not** pair this with `app.enableShutdownHooks()`. That method installs
 * Nest's own signal listeners, which also call `app.close()` -- so with both in
 * place a single SIGTERM starts two concurrent closes. The second one operates
 * on an already-closing application, rejects, and surfaces as an unhandled
 * rejection: the process exits 1 instead of 0 and an orchestrator records a
 * failed shutdown on every ordinary rolling deploy. It is intermittent, which is
 * what makes it worth a comment -- it reproduces perhaps one stop in two.
 *
 * `app.close()` runs `onModuleDestroy`, `beforeApplicationShutdown` and
 * `onApplicationShutdown` on its own; `enableShutdownHooks` only decides who
 * listens for the signal. Owning the listener here means one close, one exit
 * code, and a log line saying which signal caused it.
 */
export function installShutdownHandlers(
  app: INestApplicationContext,
  logger: LoggerService,
  context: string,
): void {
  let closing = false;

  const shutdown = async (signal: string): Promise<void> => {
    // A second SIGTERM (or an impatient orchestrator sending SIGINT after
    // SIGTERM) must not start a second close.
    if (closing) return;
    closing = true;

    logger.log?.(`Received ${signal}, shutting down`, context);
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      // Report the real failure rather than a bare non-zero exit, so a genuinely
      // stuck shutdown is distinguishable from the double-close bug above.
      logger.error?.(
        `Shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
        context,
      );
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
