import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { withAuditActor } from '../common/audit-actor';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import type { ListDeadLetterQueryDto } from './dto/list-dead-letter-query.dto';
import type { RetryDeadLetterDto } from './dto/retry-dead-letter.dto';
import { QueueService } from './queue.service';
import { SchedulerService } from './scheduler.service';

@Injectable()
export class AdminJobsService {
  constructor(
    private readonly queueService: QueueService,
    private readonly auditService: AuditService,
  ) {}

  async getQueues() {
    return {
      queues: await this.queueService.getQueueDepths(),
      scheduledJobs: SchedulerService.definitions(),
    };
  }

  async listDeadLetterJobs(query: ListDeadLetterQueryDto) {
    const { page, limit } = paginationOffset(query);
    const { items, total } = await this.queueService.listDeadLetterJobs(query.queue, page, limit);

    return { items, page, limit, total };
  }

  /**
   * Replays a dead-lettered job onto its original queue. Audited because it
   * re-runs a side effect that already failed -- an operator needs to be
   * accountable for that decision.
   */
  async retryDeadLetterJob(
    jobId: string,
    dto: RetryDeadLetterDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const replayJobId = await this.queueService.retryDeadLetterJob(dto.queue, jobId);

    if (!replayJobId) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Dead-letter job not found',
      });
    }

    await this.auditService.record(
      withAuditActor(actor, {
        action: 'JOB_DEAD_LETTER_RETRIED',
        resourceType: 'Job',
        resourceId: jobId,
        newValue: { queue: dto.queue, replayJobId },
        ...(requestId ? { requestId } : {}),
        ...(dto.reason ? { reason: dto.reason } : {}),
      }),
    );

    return { queue: dto.queue, deadLetterJobId: jobId, replayJobId };
  }
}
