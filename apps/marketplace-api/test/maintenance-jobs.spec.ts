import { InventoryBatchStatus } from '@prisma/client';
import { ExpireBatchesHandler } from '../src/jobs/handlers/expire-batches.handler';
import { ExpireOtpChallengesHandler } from '../src/jobs/handlers/expire-otp-challenges.handler';
import { FinalizeCommissionsHandler } from '../src/jobs/handlers/finalize-commissions.handler';
import { PruneRefreshTokensHandler } from '../src/jobs/handlers/prune-refresh-tokens.handler';
import { createJobEnvelope } from '../src/jobs/job-envelope';
import { MaintenanceJob, QueueName } from '../src/jobs/queue-names';
import type { JobContext } from '../src/jobs/job-handler';
import { RecoverProcessingRefundsHandler } from '../src/refunds/recover-processing-refunds.handler';

const context: JobContext = {
  jobId: '1',
  jobName: 'test',
  queue: QueueName.SCHEDULED_MAINTENANCE,
  attempt: 1,
  requestId: 'req-1',
};

describe('maintenance job handlers', () => {
  describe('FinalizeCommissionsHandler', () => {
    it('delegates to finance with a system actor and propagates the request id', async () => {
      const financeService = {
        finalizeEligibleCommissionEntries: jest.fn().mockResolvedValue({ finalizedCount: 3 }),
      };
      const handler = new FinalizeCommissionsHandler(financeService as never);

      const result = await handler.handle(createJobEnvelope({}), context);

      expect(result).toEqual({ finalizedCount: 3 });
      expect(financeService.finalizeEligibleCommissionEntries).toHaveBeenCalledWith(
        { kind: 'system', source: `job:${MaintenanceJob.FINALIZE_ELIGIBLE_COMMISSIONS}` },
        'req-1',
      );
    });
  });

  describe('ExpireOtpChallengesHandler', () => {
    it('deletes expired or already consumed challenges', async () => {
      const prisma = { otpChallenge: { deleteMany: jest.fn().mockResolvedValue({ count: 7 }) } };
      const handler = new ExpireOtpChallengesHandler(prisma as never);

      const result = await handler.handle();

      expect(result).toEqual({ deletedCount: 7 });
      const where = prisma.otpChallenge.deleteMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
      expect(where.OR[1]).toEqual({ consumedAt: { not: null } });
    });
  });

  describe('PruneRefreshTokensHandler', () => {
    it('keeps recently revoked tokens for incident investigation', async () => {
      const prisma = { refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } };
      const handler = new PruneRefreshTokensHandler(prisma as never);

      const result = await handler.handle();

      expect(result).toMatchObject({ deletedCount: 2, revokedRetentionDays: 30 });
      const where = prisma.refreshToken.deleteMany.mock.calls[0][0].where;
      const revokedClause = where.OR[1].revokedAt.lt as Date;
      const daysAgo = (Date.now() - revokedClause.getTime()) / (24 * 60 * 60 * 1_000);
      expect(Math.round(daysAgo)).toBe(30);
    });
  });

  describe('ExpireBatchesHandler', () => {
    function buildHandler(batches: Array<{ id: string }>) {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = {
        inventoryBatch: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce(
              batches.map((batch) => ({
                ...batch,
                batchNumber: `B-${batch.id}`,
                expiryDate: new Date('2026-01-01T00:00:00.000Z'),
                distributorOrganisationId: 'org-1',
              })),
            )
            .mockResolvedValue([]),
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) =>
          fn({ inventoryBatch: { updateMany } }),
        ),
      };
      const auditService = { record: jest.fn().mockResolvedValue(undefined) };
      return {
        handler: new ExpireBatchesHandler(prisma as never, auditService as never),
        prisma,
        auditService,
        updateMany,
      };
    }

    it('expires active batches past expiry and audits each transition', async () => {
      const { handler, auditService, updateMany, prisma } = buildHandler([{ id: 'batch-1' }]);

      const result = await handler.handle(createJobEnvelope({}), context);

      expect(result).toEqual({ expiredCount: 1 });
      // Only ACTIVE batches are selected, which is what makes a repeat run a no-op.
      expect(prisma.inventoryBatch.findMany.mock.calls[0][0].where.status).toBe(
        InventoryBatchStatus.ACTIVE,
      );
      // The status guard is repeated inside the transaction so a batch blocked
      // between the read and the write is not silently overwritten.
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'batch-1', status: InventoryBatchStatus.ACTIVE },
        data: { status: InventoryBatchStatus.EXPIRED },
      });
      expect(auditService.record).toHaveBeenCalledTimes(1);
      const [record] = auditService.record.mock.calls[0];
      expect(record).toMatchObject({
        action: 'INVENTORY_BATCH_EXPIRED',
        resourceType: 'InventoryBatch',
        resourceId: 'batch-1',
        organisationId: 'org-1',
      });
      expect(record.actorUserId).toBeUndefined();
    });

    it('does not audit when the batch was blocked before the transaction ran', async () => {
      const { handler, auditService, updateMany } = buildHandler([{ id: 'batch-1' }]);
      updateMany.mockResolvedValue({ count: 0 });

      const result = await handler.handle(createJobEnvelope({}), context);

      expect(result).toEqual({ expiredCount: 0 });
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe('RecoverProcessingRefundsHandler', () => {
    it('re-enqueues the latest durable processing event with a stable job id', async () => {
      const prisma = {
        refund: {
          findMany: jest.fn().mockResolvedValue([
            { events: [{ id: 'refund-event-1', requestId: 'refund-request-1' }] },
          ]),
        },
      };
      const queue = { enqueue: jest.fn().mockResolvedValue('refund-job-1') };
      const handler = new RecoverProcessingRefundsHandler(prisma as never, queue as never);

      const result = await handler.handle(createJobEnvelope({}), context);

      expect(result).toEqual({ scanned: 1, enqueued: 1 });
      expect(queue.enqueue).toHaveBeenCalledWith(
        QueueName.PAYMENT_WEBHOOKS,
        'execute-refund',
        { refundEventId: 'refund-event-1' },
        {
          requestId: 'refund-request-1',
          jobId: 'execute-refund-refund-event-1',
        },
      );
    });
  });
});
