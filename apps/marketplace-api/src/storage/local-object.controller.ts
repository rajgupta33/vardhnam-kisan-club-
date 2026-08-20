import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import {
  LocalDiskStorageProvider,
  type LocalStorageOperation,
} from './local-disk-storage.provider';
import { uploadPolicyFor } from './upload-policy';
import { StoredFilePurpose } from '@prisma/client';

/**
 * The data plane for `LocalDiskStorageProvider` -- the endpoint its signed URLs
 * point at. It exists so that development and CI exercise the same
 * request-URL → PUT bytes → confirm flow as a cloud bucket.
 *
 * Authorisation here is the signed token **only**, exactly like a cloud
 * presigned URL: no session, no permissions. The token proves the API already
 * authorised this specific object for this specific operation within a time
 * window. Hidden from the OpenAPI document because it is provider plumbing, not
 * a contract clients code against.
 *
 * Mounted under `storage/`, deliberately not under `files/`: the authenticated
 * `GET /files/:fileId` route would otherwise shadow this one and reject signed
 * URLs with 401, and which controller wins would depend on registration order.
 */
@ApiExcludeController()
@Controller('storage/local-object')
export class LocalObjectController {
  // The largest ceiling any purpose allows; the per-purpose limit is enforced
  // again on confirm against the observed object.
  private readonly maxAcceptedBytes = Math.max(
    ...Object.values(StoredFilePurpose).map((purpose) => uploadPolicyFor(purpose).maxSizeBytes),
  );

  constructor(private readonly provider: LocalDiskStorageProvider) {}

  @Put()
  async upload(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('token') token: string,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    this.assertToken(key, 'upload', expires, token);

    const contents = await this.readBody(request);
    const contentType = request.header('content-type') ?? 'application/octet-stream';
    await this.provider.write(key, contents, contentType);

    return { ok: true };
  }

  @Get()
  async download(
    @Query('key') key: string,
    @Query('expires') expires: string,
    @Query('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    this.assertToken(key, 'download', expires, token);

    const metadata = await this.provider.getMetadata(key);
    if (!metadata) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Stored object not found',
      });
    }

    const contents = await this.provider.read(key);
    response.setHeader('content-type', metadata.contentType);
    response.setHeader('content-length', String(metadata.sizeBytes));
    response.send(contents);
  }

  private assertToken(
    key: string,
    operation: LocalStorageOperation,
    expires: string,
    token: string,
  ): void {
    if (!key || !expires || !token) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'key, expires and token are required',
      });
    }

    if (!this.provider.verifyToken(key, operation, Number(expires), token)) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Storage URL is invalid or has expired',
      });
    }
  }

  private async readBody(request: Request): Promise<Buffer> {
    // Streamed and length-capped rather than buffered wholesale, so an
    // oversized upload is cut off instead of being read into memory first.
    return new Promise<Buffer>((resolvePromise, rejectPromise) => {
      const chunks: Buffer[] = [];
      let total = 0;

      request.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > this.maxAcceptedBytes) {
          request.destroy();
          rejectPromise(
            new BadRequestException({
              code: ApiErrorCode.VALIDATION_FAILED,
              message: 'Upload exceeds the maximum permitted size',
            }),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => resolvePromise(Buffer.concat(chunks)));
      request.on('error', rejectPromise);
    });
  }
}
