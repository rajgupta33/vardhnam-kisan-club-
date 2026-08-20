import { Injectable } from '@nestjs/common';
import { CreditNoteDocumentStatus } from '@prisma/client';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { DocumentJob, MaintenanceJob, QueueName } from '../jobs/queue-names';
import { QueueService } from '../jobs/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { creditNotePdfJobId } from './credit-notes.service';

@Injectable()
export class RecoverCreditNotePdfJobsHandler implements JobHandler<Record<string, never>> {
  readonly queue = QueueName.SCHEDULED_MAINTENANCE;
  readonly jobName = MaintenanceJob.RECOVER_CREDIT_NOTE_PDF_JOBS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async handle(
    _envelope: JobEnvelope<Record<string, never>>,
    context: JobContext,
  ): Promise<JobResult> {
    const staleBefore = new Date(Date.now() - 15 * 60_000);
    const documents = await this.prisma.creditNoteDocument.findMany({
      where: {
        OR: [
          { status: CreditNoteDocumentStatus.QUEUED },
          { status: CreditNoteDocumentStatus.PROCESSING, updatedAt: { lt: staleBefore } },
        ],
      },
      select: { id: true, requestId: true },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
    for (const document of documents) {
      await this.queueService.enqueue(
        QueueName.DOCUMENTS,
        DocumentJob.GENERATE_CREDIT_NOTE_PDF,
        { creditNoteDocumentId: document.id },
        {
          ...(document.requestId ?? context.requestId
            ? { requestId: document.requestId ?? context.requestId }
            : {}),
          jobId: creditNotePdfJobId(document.id),
        },
      );
    }
    return { scanned: documents.length, enqueued: documents.length };
  }
}
