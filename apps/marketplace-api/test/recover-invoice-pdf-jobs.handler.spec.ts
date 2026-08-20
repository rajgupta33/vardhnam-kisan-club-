import { ProductInvoiceDocumentStatus } from '@prisma/client';
import { createJobEnvelope } from '../src/jobs/job-envelope';
import { DocumentJob, QueueName } from '../src/jobs/queue-names';
import { RecoverInvoicePdfJobsHandler } from '../src/checkout/recover-invoice-pdf-jobs.handler';

describe('RecoverInvoicePdfJobsHandler', () => {
  it('re-enqueues durable queued documents with stable job ids', async () => {
    const prisma = {
      productInvoiceDocument: {
        findMany: jest.fn().mockResolvedValue([
          { id: '11111111-1111-4111-8111-111111111111', requestId: 'request-1' },
        ]),
      },
    };
    const queueService = { enqueue: jest.fn().mockResolvedValue('job-1') };
    const handler = new RecoverInvoicePdfJobsHandler(prisma as never, queueService as never);

    await expect(
      handler.handle(createJobEnvelope({}), {
        queue: QueueName.SCHEDULED_MAINTENANCE,
        jobName: handler.jobName,
        jobId: 'sweep-1',
        attempt: 1,
      }),
    ).resolves.toEqual({ scanned: 1, enqueued: 1 });

    expect(prisma.productInvoiceDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { status: ProductInvoiceDocumentStatus.QUEUED },
            expect.objectContaining({ status: ProductInvoiceDocumentStatus.PROCESSING }),
          ],
        },
      }),
    );
    expect(queueService.enqueue).toHaveBeenCalledWith(
      QueueName.DOCUMENTS,
      DocumentJob.GENERATE_INVOICE_PDF,
      { invoiceDocumentId: '11111111-1111-4111-8111-111111111111' },
      { requestId: 'request-1', jobId: 'invoice-pdf-11111111-1111-4111-8111-111111111111' },
    );
  });
});
