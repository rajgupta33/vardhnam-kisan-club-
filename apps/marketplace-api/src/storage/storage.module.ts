import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { JobHandlerRegistry } from '../jobs/job-handler-registry.service';
import { JobsModule } from '../jobs/jobs.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { LocalObjectController } from './local-object.controller';
import { ScanStoredFileHandler } from './scan-stored-file.handler';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider.interface';
import { createVirusScanner, VIRUS_SCANNER } from './virus-scanner';

/**
 * `STORAGE_PROVIDER` selects the implementation. Only `local` exists today.
 *
 * A cloud provider is a single file implementing `StorageProvider` plus a case
 * in the factory below -- deliberately not written yet, because which cloud is
 * an open business decision (see `docs/REMAINING_IMPLEMENTATION_PLAN.md` §9,
 * decision 3) and an SDK for the wrong provider is dead weight. Everything else
 * in this module is provider-agnostic.
 */
function createStorageProvider(
  configService: ConfigService,
  local: LocalDiskStorageProvider,
): StorageProvider {
  const configured = configService.get<string>('STORAGE_PROVIDER') ?? 'local';

  if (configured === 'local') {
    return local;
  }

  // Fails loudly rather than falling back to local disk: silently writing
  // production uploads to a container filesystem would lose them on restart.
  throw new Error(
    `STORAGE_PROVIDER=${configured} is not implemented. Add a StorageProvider implementation before enabling it.`,
  );
}

/** Contributes the virus-scan handler to the shared job registry. */
@Injectable()
class StorageHandlerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: JobHandlerRegistry,
    private readonly scanStoredFile: ScanStoredFileHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.scanStoredFile);
  }
}

@Module({
  imports: [AuditModule, AccessModule, JobsModule],
  controllers: [FilesController, LocalObjectController],
  providers: [
    FilesService,
    LocalDiskStorageProvider,
    ScanStoredFileHandler,
    StorageHandlerRegistrar,
    {
      provide: STORAGE_PROVIDER,
      useFactory: createStorageProvider,
      inject: [ConfigService, LocalDiskStorageProvider],
    },
    {
      provide: VIRUS_SCANNER,
      useFactory: createVirusScanner,
      inject: [ConfigService],
    },
  ],
  exports: [FilesService, STORAGE_PROVIDER],
})
export class StorageModule {}
