import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
  StoredFileStatus,
} from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import { ScanStoredFileHandler } from '../../src/storage/scan-stored-file.handler';
import { createJobEnvelope } from '../../src/jobs/job-envelope';
import { QueueName } from '../../src/jobs/queue-names';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

describe('File and document storage', () => {
  let app: INestApplication;
  let baseUrl: string;
  let scanHandler: ScanStoredFileHandler;
  let distributorHeaders: Record<string, string>;
  let otherDistributorHeaders: Record<string, string>;
  let operationsHeaders: Record<string, string>;

  beforeAll(async () => {
    await prisma.$connect();
    await seedPermissions(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(correlationIdMiddleware);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
    await app.listen(0);

    baseUrl = await app.getUrl();
    scanHandler = app.get(ScanStoredFileHandler);

    const [distributor, otherDistributor, vardhnam] = await Promise.all([
      createOrganisation(OrganisationType.DISTRIBUTOR, 'files-dist'),
      createOrganisation(OrganisationType.DISTRIBUTOR, 'files-other-dist'),
      createOrganisation(OrganisationType.VARDHNAM, 'files-ops'),
    ]);

    distributorHeaders = await createMember(distributor, PlatformRole.DISTRIBUTOR_OWNER, '+9192');
    otherDistributorHeaders = await createMember(
      otherDistributor,
      PlatformRole.DISTRIBUTOR_OWNER,
      '+9193',
    );
    operationsHeaders = await createMember(vardhnam, PlatformRole.OPERATIONS_MANAGER, '+9194');
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('runs the full upload, scan and download journey', async () => {
    const contents = Buffer.from('%PDF-1.4 a perfectly ordinary certificate');

    const issued = await request(app.getHttpServer())
      .post('/api/v1/files/upload-url')
      .set(distributorHeaders)
      .send({
        purpose: 'KYC_DOCUMENT',
        filename: 'gst-certificate.pdf',
        contentType: 'application/pdf',
        sizeBytes: contents.length,
      })
      .expect(201);

    const { fileId, uploadUrl } = issued.body.data;
    expect(uploadUrl).toContain('/storage/local-object');

    // The client writes bytes directly to storage; they never pass through the API.
    await putToStorage(uploadUrl, contents, 'application/pdf');

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/files/${fileId}/confirm`)
      .set(distributorHeaders)
      .send({})
      .expect(201);

    // Not downloadable yet: a scan has to clear it first.
    expect(confirmed.body.data.status).toBe(StoredFileStatus.PENDING_SCAN);
    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}/download-url`)
      .set(distributorHeaders)
      .expect(409);

    await runScan(fileId);

    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(stored.status).toBe(StoredFileStatus.AVAILABLE);
    expect(stored.sizeBytes).toBe(contents.length);
    expect(stored.checksumSha256).toHaveLength(64);

    const download = await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}/download-url`)
      .set(distributorHeaders)
      .expect(200);

    const fetched = await fetch(rewriteToTestServer(download.body.data.downloadUrl));
    expect(fetched.status).toBe(200);
    expect(Buffer.from(await fetched.arrayBuffer()).equals(contents)).toBe(true);

    // KYC is PII, so every download issue is audited.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'STORED_FILE_DOWNLOADED', resourceId: fileId },
    });
    expect(audit).not.toBeNull();
  });

  it('quarantines an infected upload and never makes it downloadable', async () => {
    const contents = Buffer.from(EICAR);
    const fileId = await uploadAndConfirm(contents, 'RETURN_EVIDENCE', 'proof.png', 'image/png');

    await runScan(fileId);

    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(stored.status).toBe(StoredFileStatus.INFECTED);
    expect(stored.scanResult).toBe('INFECTED');

    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}/download-url`)
      .set(distributorHeaders)
      .expect(409);
  });

  it('rejects an object whose real content type is not what was declared', async () => {
    // The presigned URL is a capability to write anything, so the declared type
    // at issue time proves nothing -- only the stored object is authoritative.
    const issued = await requestUploadUrl('PRODUCT_IMAGE', 'diagram.png', 'image/png', 64);
    await putToStorage(issued.uploadUrl, Buffer.from('<html>not an image</html>'), 'text/html');

    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/files/${issued.fileId}/confirm`)
      .set(distributorHeaders)
      .send({})
      .expect(400);

    expect(confirm.body.error.message).toMatch(/content type/i);

    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { id: issued.fileId } });
    expect(stored.status).toBe(StoredFileStatus.REJECTED);
  });

  it('rejects a confirm whose checksum does not match the stored bytes', async () => {
    const issued = await requestUploadUrl('PRODUCT_IMAGE', 'photo.png', 'image/png', 32);
    await putToStorage(issued.uploadUrl, Buffer.from('real bytes'), 'image/png');

    await request(app.getHttpServer())
      .post(`/api/v1/files/${issued.fileId}/confirm`)
      .set(distributorHeaders)
      .send({ checksumSha256: 'a'.repeat(64) })
      .expect(400);

    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { id: issued.fileId } });
    expect(stored.status).toBe(StoredFileStatus.REJECTED);
  });

  it('refuses a content type the purpose does not permit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/upload-url')
      .set(distributorHeaders)
      .send({
        purpose: 'PRODUCT_IMAGE',
        filename: 'evil.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
      })
      .expect(400);
  });

  it('refuses a declared size above the purpose limit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/upload-url')
      .set(distributorHeaders)
      .send({
        purpose: 'PRODUCT_IMAGE',
        filename: 'huge.png',
        contentType: 'image/png',
        sizeBytes: 9 * 1024 * 1024,
      })
      .expect(400);
  });

  it('refuses client uploads of platform-generated invoices', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/files/upload-url')
      .set(distributorHeaders)
      .send({
        purpose: 'INVOICE_PDF',
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
      })
      .expect(403);
  });

  it('denies a different organisation, while operations retains oversight', async () => {
    const fileId = await uploadAndConfirm(
      Buffer.from('%PDF-1.4 private'),
      'KYC_DOCUMENT',
      'pan.pdf',
      'application/pdf',
    );
    await runScan(fileId);

    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set(otherDistributorHeaders)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}/download-url`)
      .set(otherDistributorHeaders)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/files/${fileId}`)
      .set(operationsHeaders)
      .expect(200);
  });

  it('rejects a storage URL whose signature has been tampered with', async () => {
    const issued = await requestUploadUrl('PRODUCT_IMAGE', 'photo.png', 'image/png', 32);
    const tampered = issued.uploadUrl.replace(/token=[a-f0-9]+/, `token=${'0'.repeat(64)}`);

    const response = await fetch(rewriteToTestServer(tampered), {
      method: 'PUT',
      body: new Uint8Array(Buffer.from('bytes')),
      headers: { 'content-type': 'image/png' },
    });

    expect(response.status).toBe(403);
  });

  it('rejects an expired storage URL', async () => {
    const issued = await requestUploadUrl('PRODUCT_IMAGE', 'photo.png', 'image/png', 32);
    // Rewinding the expiry invalidates the signature too, which is the point:
    // the deadline is signed, not merely advertised.
    const expired = issued.uploadUrl.replace(/expires=\d+/, `expires=${Date.now() - 1_000}`);

    const response = await fetch(rewriteToTestServer(expired), {
      method: 'PUT',
      body: new Uint8Array(Buffer.from('bytes')),
      headers: { 'content-type': 'image/png' },
    });

    expect(response.status).toBe(403);
  });

  it('only lets the uploader confirm their own upload', async () => {
    const issued = await requestUploadUrl('PRODUCT_IMAGE', 'photo.png', 'image/png', 32);
    await putToStorage(issued.uploadUrl, Buffer.from('bytes'), 'image/png');

    await request(app.getHttpServer())
      .post(`/api/v1/files/${issued.fileId}/confirm`)
      .set(operationsHeaders)
      .send({})
      .expect(403);
  });

  it('treats a replayed scan as a no-op rather than re-clearing a rejected file', async () => {
    const fileId = await uploadAndConfirm(
      Buffer.from(EICAR),
      'RETURN_EVIDENCE',
      'proof.png',
      'image/png',
    );
    await runScan(fileId);
    await runScan(fileId);

    const stored = await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } });
    expect(stored.status).toBe(StoredFileStatus.INFECTED);
  });

  async function requestUploadUrl(
    purpose: string,
    filename: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<{ fileId: string; uploadUrl: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/files/upload-url')
      .set(distributorHeaders)
      .send({ purpose, filename, contentType, sizeBytes })
      .expect(201);
    return response.body.data;
  }

  async function uploadAndConfirm(
    contents: Buffer,
    purpose: string,
    filename: string,
    contentType: string,
  ): Promise<string> {
    const issued = await requestUploadUrl(purpose, filename, contentType, contents.length);
    await putToStorage(issued.uploadUrl, contents, contentType);
    await request(app.getHttpServer())
      .post(`/api/v1/files/${issued.fileId}/confirm`)
      .set(distributorHeaders)
      .send({})
      .expect(201);
    return issued.fileId;
  }

  async function putToStorage(url: string, body: Buffer, contentType: string): Promise<void> {
    const response = await fetch(rewriteToTestServer(url), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': contentType },
    });
    expect(response.status).toBe(200);
  }

  /**
   * Signed URLs are built from PUBLIC_API_BASE_URL, but this spec listens on an
   * ephemeral port. Only the origin is swapped; the signed query string, which
   * is what authorises the write, is left untouched.
   */
  function rewriteToTestServer(url: string): string {
    const parsed = new URL(url);
    const target = new URL(baseUrl);
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString();
  }

  async function runScan(storedFileId: string): Promise<void> {
    await scanHandler.handle(createJobEnvelope({ storedFileId }), {
      jobId: randomUUID(),
      jobName: 'scan-stored-file',
      queue: QueueName.DOCUMENTS,
      attempt: 1,
    });
  }

  async function createOrganisation(type: OrganisationType, slug: string): Promise<string> {
    const organisation = await prisma.organisation.create({
      data: {
        type,
        slug: `${slug}-${randomUUID()}`,
        legalName: `${slug} legal`,
        displayName: slug,
        status: OrganisationStatus.ACTIVE,
      },
    });
    return organisation.id;
  }

  async function createMember(
    organisationId: string,
    role: PlatformRole,
    prefix: string,
  ): Promise<Record<string, string>> {
    const user = await prisma.user.create({
      data: { phone: `${prefix}${Math.floor(10000000 + Math.random() * 89999999)}` },
    });
    await prisma.organisationMembership.create({
      data: { userId: user.id, organisationId, role, status: MembershipStatus.ACTIVE },
    });
    return {
      'x-user-id': user.id,
      'x-user-role': role,
      'x-organisation-id': organisationId,
    };
  }
});
