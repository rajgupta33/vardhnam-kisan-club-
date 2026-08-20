import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JobHandler, JobResult } from '../job-handler';
import { MaintenanceJob, QueueName } from '../queue-names';

/**
 * Removes OTP challenges that can no longer be used.
 *
 * These rows hold a hashed one-time code and the phone number that requested it.
 * Once expired or consumed they have no operational value and only widen the PII
 * surface, so they are deleted rather than archived. Deliberately not audited:
 * the security-relevant events (request, verify, failure) are already recorded
 * at the point they happen.
 *
 * Idempotent: deleting an empty set is a no-op.
 */
@Injectable()
export class ExpireOtpChallengesHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.EXPIRE_OTP_CHALLENGES;

  constructor(private readonly prisma: PrismaService) {}

  // This job takes no payload, so the envelope parameter is simply not declared.
  async handle(): Promise<JobResult> {
    const now = new Date();
    const { count } = await this.prisma.otpChallenge.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
      },
    });

    return { deletedCount: count };
  }
}
