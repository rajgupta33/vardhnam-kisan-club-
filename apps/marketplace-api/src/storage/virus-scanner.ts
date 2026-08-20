import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ScanVerdict = 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';

export interface VirusScanner {
  readonly name: string;
  scan(contents: Buffer): Promise<ScanVerdict>;
}

export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

/**
 * Development and CI scanner. **This is not virus scanning** -- it recognises
 * the EICAR test string and calls everything else clean.
 *
 * It exists so the quarantine path is genuinely exercised end to end without a
 * ClamAV daemon in CI: a spec can upload the EICAR string and assert the file
 * becomes INFECTED and undownloadable. `VIRUS_SCANNER=clamav` must be set for
 * any environment holding real uploads, and the go-live checklist covers it.
 */
@Injectable()
export class MockVirusScanner implements VirusScanner {
  readonly name = 'mock';

  private static readonly EICAR_SIGNATURE =
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

  async scan(contents: Buffer): Promise<ScanVerdict> {
    return contents.includes(MockVirusScanner.EICAR_SIGNATURE) ? 'INFECTED' : 'CLEAN';
  }
}

export function createVirusScanner(configService: ConfigService): VirusScanner {
  const configured = configService.get<string>('VIRUS_SCANNER') ?? 'mock';

  if (configured === 'mock') {
    return new MockVirusScanner();
  }

  // Deliberately fails loudly rather than silently falling back to the mock:
  // a misconfigured scanner in production would mark malware clean.
  throw new Error(
    `VIRUS_SCANNER=${configured} is not implemented. Implement a real scanner before enabling it.`,
  );
}
