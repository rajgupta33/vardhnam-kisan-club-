import { Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobHandler, JobResult } from '../jobs/job-handler';
import { DocumentJob, QueueName } from '../jobs/queue-names';
import { InvoiceDocumentsService } from './invoice-documents.service';

interface GenerateInvoicePdfPayload {
  invoiceDocumentId: string;
}

@Injectable()
export class GenerateInvoicePdfHandler implements JobHandler<GenerateInvoicePdfPayload> {
  readonly queue = QueueName.DOCUMENTS;
  readonly jobName = DocumentJob.GENERATE_INVOICE_PDF;

  constructor(private readonly invoiceDocuments: InvoiceDocumentsService) {}

  async handle(envelope: JobEnvelope<GenerateInvoicePdfPayload>): Promise<JobResult> {
    return this.invoiceDocuments.generate(envelope.payload.invoiceDocumentId);
  }
}
