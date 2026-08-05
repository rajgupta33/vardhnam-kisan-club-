import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  async ping(): Promise<string> {
    const client = this.getClient();
    if (client.status === 'wait' || client.status === 'end') {
      await client.connect();
    }
    return client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  private getClient(): Redis {
    if (!this.client) {
      const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }

    return this.client;
  }
}
