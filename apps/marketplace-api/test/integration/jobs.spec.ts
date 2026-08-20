import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ResponseEnvelopeInterceptor } from '../../src/common/interceptors/response-envelope.interceptor';
import { correlationIdMiddleware } from '../../src/common/middleware/correlation-id.middleware';
import type { JobEnvelope } from '../../src/jobs/job-envelope';
import { QueueService } from '../../src/jobs/queue.service';
import { QueueName, deadLetterQueueName } from '../../src/jobs/queue-names';
import { seedPermissions } from './helpers/seed-permissions';

const prisma = new PrismaClient();

// The DLQ endpoints validate against declared queue names, so this spec has to
// borrow a real one. It uses `tally-sync` because nothing produces to it yet,
// drains it before each run, and its worker only fails jobs it created --
// otherwise a producer added later (WP-06, WP-07) silently breaks this spec, as
// WP-08's scan jobs did when it previously borrowed `documents`.
const testQueue = QueueName.TALLY_SYNC;
const testJobName = 'integration-test-job';

describe('Background jobs', () => {
  let app: INestApplication;
  let queueService: QueueService;
  let adminHeaders: Record<string, string>;
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

    queueService = app.get(QueueService);

    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.VARDHNAM,
        slug: `jobs-${randomUUID()}`,
        legalName: 'Jobs Test Context',
        displayName: 'Jobs Test Context',
        status: OrganisationStatus.ACTIVE,
      },
    });

    const [admin, operations] = await Promise.all([
      createMember(organisation.id, PlatformRole.ADMIN, '+9190'),
      createMember(organisation.id, PlatformRole.OPERATIONS_MANAGER, '+9191'),
    ]);
    adminHeaders = authHeaders(admin, PlatformRole.ADMIN, organisation.id);
    operationsHeaders = authHeaders(operations, PlatformRole.OPERATIONS_MANAGER, organisation.id);
  });

  async function createMember(
    organisationId: string,
    role: PlatformRole,
    prefix: string,
  ): Promise<string> {
    const user = await prisma.user.create({ data: { phone: `${prefix}${randomDigits()}` } });
    await prisma.organisationMembership.create({
      data: { userId: user.id, organisationId, role, status: MembershipStatus.ACTIVE },
    });
    return user.id;
  }

  beforeEach(async () => {
    // Redis outlives the database reset, so anything a previous run or spec left
    // on this queue would otherwise leak into these assertions.
    await drainQueue();
  });

  afterAll(async () => {
    await drainQueue();
    await app?.close();
    await prisma.$disconnect();
  });

  it('reports queue depths and the registered maintenance schedule', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/jobs/queues')
      .set(adminHeaders)
      .expect(200);

    const queues = response.body.data.queues as Array<{ queue: string }>;
    expect(queues.map((entry) => entry.queue)).toEqual(
      expect.arrayContaining([QueueName.SCHEDULED_MAINTENANCE, QueueName.NOTIFICATIONS]),
    );

    const scheduled = response.body.data.scheduledJobs as Array<{ jobName: string }>;
    expect(scheduled.map((job) => job.jobName)).toContain('finalize-eligible-commissions');
  });

  it('denies queue visibility to roles without the jobs permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/jobs/queues')
      .set(operationsHeaders)
      .expect(403);
  });

  it('carries the enqueueing request id through the job envelope', async () => {
    const requestId = randomUUID();
    const jobId = await queueService.enqueue(
      testQueue,
      testJobName,
      { hello: 'world' },
      {
        requestId,
      },
    );

    const job = await queueService.getQueue(testQueue).getJob(jobId as string);
    const envelope = job?.data as JobEnvelope<{ hello: string }>;

    expect(envelope.payload).toEqual({ hello: 'world' });
    expect(envelope.requestId).toBe(requestId);
    expect(Date.parse(envelope.enqueuedAt)).not.toBeNaN();

    await job?.remove();
  });

  it('retries a failing job then dead-letters it, and replays it on admin retry', async () => {
    const attempts: number[] = [];
    // Two attempts keeps the test fast while still proving retry happens before
    // the dead-letter path is taken.
    const maxAttempts = 2;

    const worker = new Worker(
      testQueue,
      async (job: Job) => {
        // Only fail this spec's own job. Anything else on the queue is left
        // alone so a stray production job cannot pollute the attempt trace.
        if (job.name !== testJobName) {
          return { ignoredByIntegrationTest: true };
        }
        attempts.push(job.attemptsMade + 1);
        throw new Error('deliberate integration failure');
      },
      {
        connection: queueService.getConnection(),
        prefix: queueService.getQueuePrefix(),
        concurrency: 1,
      },
    );

    const deadLettered = new Promise<void>((resolve) => {
      worker.on('failed', (job, error) => {
        if (job?.name !== testJobName) {
          return;
        }
        if (!job || job.attemptsMade < maxAttempts) {
          return;
        }
        void queueService
          .deadLetter({
            originalQueue: testQueue,
            originalJobName: job.name,
            envelope: job.data as JobEnvelope,
            failedReason: error.message,
            attemptsMade: job.attemptsMade,
            failedAt: new Date().toISOString(),
          })
          .then(() => resolve());
      });
    });

    await queueService
      .getQueue(testQueue)
      .add(
        testJobName,
        { payload: { attempt: 'fails' }, enqueuedAt: new Date().toISOString() },
        { attempts: maxAttempts, backoff: { type: 'fixed', delay: 10 } },
      );

    await deadLettered;
    await worker.close();

    expect(attempts).toEqual([1, 2]);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/admin/jobs/dead-letter')
      .query({ queue: testQueue })
      .set(adminHeaders)
      .expect(200);

    expect(listed.body.data.total).toBeGreaterThanOrEqual(1);
    const entry = listed.body.data.items[0];
    expect(entry).toMatchObject({
      originalQueue: testQueue,
      originalJobName: testJobName,
      failedReason: 'deliberate integration failure',
    });

    const retried = await request(app.getHttpServer())
      .post(`/api/v1/admin/jobs/dead-letter/${entry.id}/retry`)
      .set(adminHeaders)
      .send({ queue: testQueue, reason: 'Integration test replay' })
      .expect(201);

    expect(retried.body.data.replayJobId).toBeDefined();

    // The replay must be audited: it re-runs a side effect that already failed.
    const auditRecord = await prisma.auditLog.findFirst({
      where: { action: 'JOB_DEAD_LETTER_RETRIED', resourceId: entry.id },
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.reason).toBe('Integration test replay');

    // The dead-letter entry is consumed by the replay rather than duplicated.
    const afterRetry = await queueService.listDeadLetterJobs(testQueue, 1, 25);
    expect(afterRetry.items.some((item) => item.id === entry.id)).toBe(false);
  });

  it('returns 404 when replaying a dead-letter entry that no longer exists', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/jobs/dead-letter/999999/retry')
      .set(adminHeaders)
      .send({ queue: testQueue })
      .expect(404);
  });

  async function drainQueue(): Promise<void> {
    await queueService.getQueue(testQueue).obliterate({ force: true });
    await queueService.getQueue(deadLetterQueueName(testQueue)).obliterate({ force: true });
  }

  function randomDigits(): string {
    return String(Math.floor(10000000 + Math.random() * 89999999));
  }

  function authHeaders(
    userId: string,
    role: PlatformRole,
    organisationId: string,
  ): Record<string, string> {
    return {
      'x-user-id': userId,
      'x-user-role': role,
      'x-organisation-id': organisationId,
    };
  }
});
