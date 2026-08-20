import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { JobHandlerRegistry } from './job-handler-registry.service';
import type { JobEnvelope } from './job-envelope';
import type { JobHandler } from './job-handler';
import { QueueService } from './queue.service';
import type { QueueName } from './queue-names';

/**
 * Starts a BullMQ `Worker` per queue that has at least one registered handler,
 * but only when this process is running in worker mode.
 *
 * An API process enqueues and never consumes. That keeps request latency
 * independent of job load and lets the two scale separately, as
 * `PRODUCT_REQUIREMENTS.md` §24 requires. With no worker running, jobs simply
 * accumulate in Redis until one starts.
 */
@Injectable()
export class JobRunnerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private readonly workers: Worker[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly queueService: QueueService,
    private readonly registry: JobHandlerRegistry,
  ) {}

  // Runs after every module's onModuleInit, so the registry is complete.
  onApplicationBootstrap(): void {
    if (!this.configService.get<boolean>('WORKER_MODE')) {
      return;
    }

    const handlers = this.registry.all();
    const byQueue = new Map<QueueName, Map<string, JobHandler>>();
    for (const handler of handlers) {
      const queueHandlers = byQueue.get(handler.queue) ?? new Map<string, JobHandler>();
      if (queueHandlers.has(handler.jobName)) {
        throw new Error(`Duplicate job handler registered for ${handler.queue}/${handler.jobName}`);
      }
      queueHandlers.set(handler.jobName, handler);
      byQueue.set(handler.queue, queueHandlers);
    }

    for (const [queue, queueHandlers] of byQueue) {
      this.workers.push(this.startWorker(queue, queueHandlers));
    }

    this.logger.log(
      JSON.stringify({
        message: 'Job workers started',
        queues: [...byQueue.keys()],
        handlers: handlers.length,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers.length = 0;
  }

  private startWorker(queue: QueueName, handlers: Map<string, JobHandler>): Worker {
    const concurrency = this.configService.get<number>('WORKER_CONCURRENCY') ?? 5;

    const worker = new Worker(
      queue,
      async (job: Job) => {
        const handler = handlers.get(job.name);
        if (!handler) {
          // Fail loudly rather than silently dropping work: an unroutable job
          // means a producer and this deployment disagree about job names.
          throw new Error(`No handler registered for ${queue}/${job.name}`);
        }

        const envelope = job.data as JobEnvelope;
        const context = {
          jobId: job.id ?? 'unknown',
          jobName: job.name,
          queue,
          attempt: job.attemptsMade + 1,
          ...(envelope.requestId ? { requestId: envelope.requestId } : {}),
        };

        this.logger.log(JSON.stringify({ message: 'Job started', ...context }));
        const startedAt = Date.now();
        const result = await handler.handle(envelope, context);
        this.logger.log(
          JSON.stringify({
            message: 'Job completed',
            ...context,
            durationMs: Date.now() - startedAt,
            result,
          }),
        );
        return result;
      },
      {
        connection: this.queueService.getConnection(),
        prefix: this.queueService.getQueuePrefix(),
        concurrency,
      },
    );

    worker.on('failed', (job, error) => {
      if (!job) {
        this.logger.error(JSON.stringify({ message: 'Job failed without context', queue }));
        return;
      }

      const attempts = job.opts.attempts ?? 1;
      const exhausted = job.attemptsMade >= attempts;
      this.logger.error(
        JSON.stringify({
          message: exhausted ? 'Job failed permanently' : 'Job failed, will retry',
          queue,
          jobName: job.name,
          jobId: job.id,
          attempt: job.attemptsMade,
          attempts,
          requestId: (job.data as JobEnvelope | undefined)?.requestId,
          error: error.message,
        }),
      );

      if (!exhausted) {
        return;
      }

      void this.queueService
        .deadLetter({
          originalQueue: queue,
          originalJobName: job.name,
          envelope: job.data as JobEnvelope,
          failedReason: error.message,
          ...(error.stack ? { stack: error.stack } : {}),
          attemptsMade: job.attemptsMade,
          failedAt: new Date().toISOString(),
        })
        .catch((deadLetterError: unknown) => {
          this.logger.error(
            JSON.stringify({
              message: 'Failed to dead-letter job',
              queue,
              jobId: job.id,
              error:
                deadLetterError instanceof Error
                  ? deadLetterError.message
                  : 'Unknown dead-letter error',
            }),
          );
        });
    });

    return worker;
  }
}
