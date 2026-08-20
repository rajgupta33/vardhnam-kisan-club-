import { Injectable } from '@nestjs/common';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type CheckStatus = 'ok' | 'error';

export interface ReadinessCheck {
  name: string;
  status: CheckStatus;
  message?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queueService: QueueService,
  ) {}

  live() {
    return {
      status: 'ok',
      service: 'marketplace-api',
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<{ status: CheckStatus; checks: ReadinessCheck[] }> {
    const checks = await Promise.all([this.checkDatabase(), this.checkRedis(), this.checkQueues()]);
    const status = checks.every((check) => check.status === 'ok') ? 'ok' : 'error';

    return {
      status,
      checks,
    };
  }

  private async checkDatabase(): Promise<ReadinessCheck> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { name: 'postgres', status: 'ok' };
    } catch (error) {
      return {
        name: 'postgres',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  // The queue connection is separate from the health-ping client (BullMQ needs
  // its own retry settings), so it can fail independently and is checked apart
  // from `redis`.
  private async checkQueues(): Promise<ReadinessCheck> {
    try {
      const reachable = await this.queueService.isReachable();
      return reachable
        ? { name: 'queues', status: 'ok' }
        : { name: 'queues', status: 'error', message: 'Queue connection is not reachable' };
    } catch (error) {
      return {
        name: 'queues',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown queue error',
      };
    }
  }

  private async checkRedis(): Promise<ReadinessCheck> {
    try {
      await this.redis.ping();
      return { name: 'redis', status: 'ok' };
    } catch (error) {
      return {
        name: 'redis',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown redis error',
      };
    }
  }
}
