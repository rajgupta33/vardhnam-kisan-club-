import { Inject, Injectable } from '@nestjs/common';
import type { JobEnvelope } from '../jobs/job-envelope';
import type { JobContext, JobHandler, JobResult } from '../jobs/job-handler';
import { DocumentJob, QueueName } from '../jobs/queue-names';
import { FilesService } from './files.service';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider.interface';
import { VIRUS_SCANNER, type VirusScanner } from './virus-scanner';

interface ScanStoredFilePayload {
  storedFileId: string;
}

/**
 * Scans an uploaded object and releases it for download only if it is clean.
 *
 * A file sits in `PENDING_SCAN` and is undownloadable until this runs, so a
 * backed-up queue delays access rather than leaking unscanned bytes.
 *
 * Idempotent: `applyScanResult` ignores files that have left `PENDING_SCAN`, so
 * a replayed job cannot resurrect a rejected file.
 */
@Injectable()
export class ScanStoredFileHandler implements JobHandler<ScanStoredFilePayload> {
  readonly queue = QueueName.DOCUMENTS;
  readonly jobName = DocumentJob.SCAN_STORED_FILE;

  constructor(
    private readonly filesService: FilesService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
  ) {}

  async handle(
    envelope: JobEnvelope<ScanStoredFilePayload>,
    context: JobContext,
  ): Promise<JobResult> {
    const { storedFileId } = envelope.payload;
    const file = await this.filesService.getFileForScan(storedFileId);

    if (!file) {
      // Nothing to do, and nothing to retry: the file no longer needs scanning.
      return { storedFileId, skipped: true };
    }

    const contents = await this.storage.read(file.objectKey);
    const verdict = await this.scanner.scan(contents);

    // A SCAN_FAILED verdict throws inside applyScanResult so BullMQ retries and,
    // if it keeps failing, dead-letters it for an operator. The file stays
    // unscanned and undownloadable throughout.
    await this.filesService.applyScanResult(storedFileId, verdict, context.requestId);

    return { storedFileId, verdict, scanner: this.scanner.name };
  }
}
