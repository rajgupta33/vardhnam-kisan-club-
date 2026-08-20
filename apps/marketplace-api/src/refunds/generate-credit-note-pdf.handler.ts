import { Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobHandler, JobResult } from '../jobs/job-handler';
import { DocumentJob, QueueName } from '../jobs/queue-names';
import { CreditNotesService } from './credit-notes.service';

interface Payload {
  creditNoteDocumentId: string;
}

@Injectable()
export class GenerateCreditNotePdfHandler implements JobHandler<Payload> {
  readonly queue = QueueName.DOCUMENTS;
  readonly jobName = DocumentJob.GENERATE_CREDIT_NOTE_PDF;

  constructor(private readonly creditNotes: CreditNotesService) {}

  async handle(envelope: JobEnvelope<Payload>): Promise<JobResult> {
    return this.creditNotes.generate(envelope.payload.creditNoteDocumentId);
  }
}
