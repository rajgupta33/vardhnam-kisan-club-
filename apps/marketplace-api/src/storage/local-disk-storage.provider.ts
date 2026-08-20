import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DownloadTarget,
  StorageProvider,
  StoredObjectMetadata,
  UploadTarget,
} from './storage.provider.interface';

export type LocalStorageOperation = 'upload' | 'download';

/**
 * Filesystem-backed storage for development and CI.
 *
 * It deliberately mimics presigned-URL semantics rather than taking a shortcut:
 * the returned URL points at this API's own local-storage endpoint and carries
 * an HMAC-signed, time-limited token. That way the client flow -- request URL,
 * PUT bytes, confirm -- is identical whether the provider is local disk or a
 * cloud bucket, so switching providers cannot change client behaviour.
 *
 * Not for production: there is no replication, no lifecycle policy and no
 * server-side encryption. `STORAGE_PROVIDER` selects a cloud provider instead.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly configService: ConfigService) {}

  async getUploadUrl(
    objectKey: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<UploadTarget> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000);
    return {
      url: this.signedUrl(objectKey, 'upload', expiresAt),
      expiresAt,
      requiredHeaders: { 'content-type': contentType },
    };
  }

  async getDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<DownloadTarget> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000);
    return { url: this.signedUrl(objectKey, 'download', expiresAt), expiresAt };
  }

  async getMetadata(objectKey: string): Promise<StoredObjectMetadata | undefined> {
    const path = this.resolveObjectPath(objectKey);
    try {
      const stats = await stat(path);
      const contents = await readFile(path);
      return {
        sizeBytes: stats.size,
        contentType: await this.readContentType(objectKey),
        checksumSha256: createHash('sha256').update(contents).digest('hex'),
      };
    } catch {
      return undefined;
    }
  }

  async read(objectKey: string): Promise<Buffer> {
    return readFile(this.resolveObjectPath(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.resolveObjectPath(objectKey), { force: true });
    await rm(`${this.resolveObjectPath(objectKey)}.meta`, { force: true });
  }

  /** Used by the local upload endpoint once its token has been verified. */
  async write(objectKey: string, contents: Buffer, contentType: string): Promise<void> {
    const path = this.resolveObjectPath(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
    await writeFile(`${path}.meta`, contentType, 'utf8');
  }

  verifyToken(
    objectKey: string,
    operation: LocalStorageOperation,
    expiresAtMs: number,
    token: string,
  ): boolean {
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      return false;
    }

    const expected = Buffer.from(this.sign(objectKey, operation, expiresAtMs), 'hex');
    let provided: Buffer;
    try {
      provided = Buffer.from(token, 'hex');
    } catch {
      return false;
    }

    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  /**
   * Object keys are generated server-side, but this is the boundary where a
   * hostile key would become a filesystem path, so traversal is rejected here
   * rather than trusted upstream.
   */
  private resolveObjectPath(objectKey: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(objectKey) || objectKey.includes('..')) {
      throw new Error('Invalid object key');
    }

    const root = this.storageRoot();
    const path = resolve(join(root, objectKey));
    if (path !== root && !path.startsWith(root + sep)) {
      throw new Error('Invalid object key');
    }
    return path;
  }

  private async readContentType(objectKey: string): Promise<string> {
    try {
      return (await readFile(`${this.resolveObjectPath(objectKey)}.meta`, 'utf8')).trim();
    } catch {
      return 'application/octet-stream';
    }
  }

  private storageRoot(): string {
    return resolve(this.configService.get<string>('STORAGE_LOCAL_ROOT') ?? '.storage');
  }

  private signedUrl(objectKey: string, operation: LocalStorageOperation, expiresAt: Date): string {
    const baseUrl = (this.configService.get<string>('PUBLIC_API_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    const prefix = this.configService.get<string>('API_PREFIX') ?? 'api/v1';
    const expiresAtMs = expiresAt.getTime();
    const token = this.sign(objectKey, operation, expiresAtMs);
    const params = new URLSearchParams({
      key: objectKey,
      expires: String(expiresAtMs),
      token,
    });

    return `${baseUrl}/${prefix}/storage/local-object?${params.toString()}`;
  }

  private sign(objectKey: string, operation: LocalStorageOperation, expiresAtMs: number): string {
    // Reuses the API signing secret: this provider only ever runs in
    // development and CI, so it does not warrant its own key to rotate.
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', secret)
      .update(`${objectKey}|${operation}|${expiresAtMs}`)
      .digest('hex');
  }
}
