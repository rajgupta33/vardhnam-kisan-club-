import { Injectable } from '@nestjs/common';
import type { JobHandler } from './job-handler';

/**
 * Where feature modules contribute their job handlers.
 *
 * Handlers live with the domain they serve -- the virus scanner belongs to
 * `StorageModule`, not to `JobsModule` -- but workers are started centrally. A
 * registry inverts that dependency: feature modules import `JobsModule` and
 * register during `onModuleInit`, and `JobRunnerService` reads the complete set
 * during `onApplicationBootstrap`, which Nest runs after every `onModuleInit`.
 */
@Injectable()
export class JobHandlerRegistry {
  private readonly handlers: JobHandler[] = [];

  register(...handlers: JobHandler[]): void {
    this.handlers.push(...handlers);
  }

  all(): ReadonlyArray<JobHandler> {
    return this.handlers;
  }
}
