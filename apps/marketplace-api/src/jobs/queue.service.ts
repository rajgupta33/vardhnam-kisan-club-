import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { createJobEnvelope, type DeadLetterRecord, type JobEnvelope } from './job-envelope';
import { allQueueNames, deadLetterQueueName, type QueueName } from './queue-names';

export interface QueueDepth {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  deadLetter: number;
}

/**
 * Owns every BullMQ `Queue` instance plus the shared Redis connection used to
 * produce jobs. Workers are deliberately not started here -- see
 * `JobRunnerService` -- so an API process can enqueue without also consuming.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private connection?: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    for (const name of allQueueNames) {
      this.getQueue(name);
      this.getQueue(deadLetterQueueName(name));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
    if (this.connection) {
      this.connection.disconnect();
    }
  }

  /**
   * BullMQ requires `maxRetriesPerRequest: null` on its connections; the shared
   * `RedisService` client is configured for fast health pings instead, so jobs
   * get their own connection rather than reusing it.
   */
  getConnection(): Redis {
    if (!this.connection) {
      const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
      this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    }
    return this.connection;
  }

  getQueuePrefix(): string {
    return this.configService.get<string>('QUEUE_PREFIX') ?? 'vardhnam';
  }

  getQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: this.getConnection(),
      prefix: this.getQueuePrefix(),
      defaultJobOptions: this.defaultJobOptions(),
    });
    this.queues.set(name, queue);
    return queue;
  }

  defaultJobOptions(): JobsOptions {
    const attempts = this.configService.get<number>('JOB_MAX_ATTEMPTS') ?? 5;
    return {
      attempts,
      backoff: { type: 'exponential', delay: 1_000 },
      // Keep a bounded window of terminal jobs so the admin view has recent
      // history without growing Redis without limit.
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
    };
  }

  async enqueue<TPayload>(
    queue: QueueName,
    jobName: string,
    payload: TPayload,
    options: { requestId?: string; jobId?: string } = {},
  ): Promise<string | undefined> {
    const envelope = createJobEnvelope(payload, options.requestId);
    const job = await this.getQueue(queue).add(
      jobName,
      envelope,
      options.jobId ? { jobId: options.jobId } : {},
    );
    this.logger.log(
      JSON.stringify({
        message: 'Job enqueued',
        queue,
        jobName,
        jobId: job.id,
        requestId: options.requestId,
      }),
    );
    return job.id;
  }

  /** Moves a permanently failed job onto its queue's dead-letter queue. */
  async deadLetter(record: DeadLetterRecord): Promise<void> {
    await this.getQueue(deadLetterQueueName(record.originalQueue as QueueName)).add(
      record.originalJobName,
      record,
      // A dead-lettered job must never retry on its own -- it is waiting for a
      // human decision through the admin endpoint.
      { attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
  }

  async getQueueDepths(): Promise<QueueDepth[]> {
    return Promise.all(
      allQueueNames.map(async (name) => {
        const counts = await this.getQueue(name).getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        const deadLetter = await this.getQueue(deadLetterQueueName(name)).getJobCounts('waiting');

        return {
          queue: name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          deadLetter: deadLetter.waiting ?? 0,
        };
      }),
    );
  }

  async listDeadLetterJobs(
    queue: QueueName,
    page: number,
    limit: number,
  ): Promise<{ items: Array<DeadLetterRecord & { id: string }>; total: number }> {
    const dlq = this.getQueue(deadLetterQueueName(queue));
    const start = (page - 1) * limit;
    const [jobs, counts] = await Promise.all([
      dlq.getJobs(['waiting'], start, start + limit - 1),
      dlq.getJobCounts('waiting'),
    ]);

    return {
      items: jobs
        .filter((job): job is NonNullable<typeof job> => Boolean(job?.id))
        .map((job) => ({ ...(job.data as DeadLetterRecord), id: job.id as string })),
      total: counts.waiting ?? 0,
    };
  }

  /**
   * Re-enqueues a dead-lettered job onto its original queue and removes the
   * dead-letter entry. Returns the new job id, or undefined when the
   * dead-letter entry no longer exists.
   */
  async retryDeadLetterJob(queue: QueueName, jobId: string): Promise<string | undefined> {
    const dlq = this.getQueue(deadLetterQueueName(queue));
    const job = await dlq.getJob(jobId);
    if (!job) {
      return undefined;
    }

    const record = job.data as DeadLetterRecord;
    const envelope = record.envelope as JobEnvelope;
    const replay = await this.getQueue(queue).add(record.originalJobName, envelope);
    await job.remove();

    return replay.id;
  }

  async isReachable(): Promise<boolean> {
    try {
      const connection = this.getConnection();
      await connection.ping();
      return true;
    } catch {
      return false;
    }
  }
}
