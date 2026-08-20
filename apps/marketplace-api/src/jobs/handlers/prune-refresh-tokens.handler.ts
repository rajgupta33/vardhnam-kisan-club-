import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JobHandler, JobResult } from '../job-handler';
import { MaintenanceJob, QueueName } from '../queue-names';

/**
 * Removes refresh tokens that can no longer be exchanged.
 *
 * Rotation means a busy user accumulates a revoked row per refresh, so this
 * table grows faster than any other auth table. A revoked or expired row cannot
 * authenticate anything, and keeping it retains the user's device and IP
 * metadata for no operational benefit.
 *
 * A grace period is applied to revoked tokens so that recent rotation history
 * stays available for incident investigation before it is discarded.
 *
 * Idempotent: deleting an empty set is a no-op.
 */
const REVOKED_TOKEN_RETENTION_DAYS = 30;

@Injectable()
export class PruneRefreshTokensHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.PRUNE_REFRESH_TOKENS;

  constructor(private readonly prisma: PrismaService) {}

  // This job takes no payload, so the envelope parameter is simply not declared.
  async handle(): Promise<JobResult> {
    const now = new Date();
    const revokedBefore = new Date(
      now.getTime() - REVOKED_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    );

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedBefore } }],
      },
    });

    return { deletedCount: count, revokedRetentionDays: REVOKED_TOKEN_RETENTION_DAYS };
  }
}
