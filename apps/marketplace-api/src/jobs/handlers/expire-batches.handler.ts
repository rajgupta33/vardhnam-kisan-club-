import { Injectable } from '@nestjs/common';
import { InventoryBatchStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { systemActor, withAuditActor } from '../../common/audit-actor';
import { PrismaService } from '../../prisma/prisma.service';
import type { JobEnvelope } from '../job-envelope';
import type { JobContext, JobHandler, JobResult } from '../job-handler';
import { MaintenanceJob, QueueName } from '../queue-names';

/**
 * Moves batches past their expiry date from `ACTIVE` to `EXPIRED` so they drop
 * out of derived availability.
 *
 * Before this job, an expired batch stayed `ACTIVE` and remained sellable until
 * someone noticed -- a real risk for agricultural inputs, where expiry is a
 * safety and legal matter rather than a merchandising one.
 *
 * `BLOCKED` batches are deliberately left alone: a block is an explicit human
 * decision with a recorded reason, and overwriting it would erase why the batch
 * was blocked. A blocked batch is already unsellable.
 *
 * Each transition writes an `AuditLog` row in the same transaction as the state
 * change, per the Definition of Done. Batches are processed in pages so one run
 * cannot open an unbounded transaction.
 *
 * Idempotent: only `ACTIVE` batches are selected, so a second run finds nothing.
 */
const PAGE_SIZE = 200;

@Injectable()
export class ExpireBatchesHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.EXPIRE_BATCHES;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async handle(
    _envelope: JobEnvelope<Record<string, never>>,
    context: JobContext,
  ): Promise<JobResult> {
    const today = new Date();
    let expiredCount = 0;

    for (;;) {
      const batches = await this.prisma.inventoryBatch.findMany({
        where: {
          status: InventoryBatchStatus.ACTIVE,
          expiryDate: { not: null, lt: today },
        },
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
          distributorOrganisationId: true,
        },
        orderBy: { createdAt: 'asc' },
        take: PAGE_SIZE,
      });

      if (batches.length === 0) {
        break;
      }

      for (const batch of batches) {
        await this.prisma.$transaction(async (tx) => {
          // Re-check the status inside the transaction: an operator may have
          // blocked this batch between the page read and here.
          const updated = await tx.inventoryBatch.updateMany({
            where: { id: batch.id, status: InventoryBatchStatus.ACTIVE },
            data: { status: InventoryBatchStatus.EXPIRED },
          });

          if (updated.count === 0) {
            return;
          }

          await this.auditService.record(
            withAuditActor(systemActor(`job:${this.jobName}`), {
              action: 'INVENTORY_BATCH_EXPIRED',
              resourceType: 'InventoryBatch',
              resourceId: batch.id,
              organisationId: batch.distributorOrganisationId,
              previousValue: { status: InventoryBatchStatus.ACTIVE },
              newValue: {
                status: InventoryBatchStatus.EXPIRED,
                batchNumber: batch.batchNumber,
                expiryDate: batch.expiryDate?.toISOString() ?? null,
              },
              ...(context.requestId ? { requestId: context.requestId } : {}),
              reason: 'Batch expiry date elapsed',
            }),
            tx,
          );

          expiredCount += 1;
        });
      }

      if (batches.length < PAGE_SIZE) {
        break;
      }
    }

    return { expiredCount };
  }
}
