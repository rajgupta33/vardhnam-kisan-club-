import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JobHandlerRegistry } from '../src/jobs/job-handler-registry.service';
import { JobRunnerService } from '../src/jobs/job-runner.service';
import type { JobHandler } from '../src/jobs/job-handler';
import { QueueName } from '../src/jobs/queue-names';

function buildRunner(workerMode: boolean, handlers: JobHandler[]) {
  const configService = {
    get: jest.fn((key: string) => (key === 'WORKER_MODE' ? workerMode : undefined)),
  };
  const queueService = {
    getConnection: jest.fn(() => ({}) as never),
    getQueuePrefix: jest.fn(() => 'test'),
  };
  const registry = new JobHandlerRegistry();
  registry.register(...handlers);
  const runner = new JobRunnerService(configService as never, queueService as never, registry);
  return { runner, queueService, registry };
}

const handler = (jobName: string): JobHandler => ({
  queue: QueueName.SCHEDULED_MAINTENANCE,
  jobName,
  handle: jest.fn().mockResolvedValue({}),
});

describe('JobRunnerService', () => {
  it('starts no workers when WORKER_MODE is off', () => {
    const { runner, queueService } = buildRunner(false, [handler('a')]);

    runner.onApplicationBootstrap();

    // An API process must enqueue without consuming; touching the connection at
    // all would mean a worker was created.
    expect(queueService.getConnection).not.toHaveBeenCalled();
  });

  it('rejects two handlers claiming the same queue and job name', () => {
    const { runner } = buildRunner(true, [handler('duplicate'), handler('duplicate')]);

    expect(() => runner.onApplicationBootstrap()).toThrow(/Duplicate job handler/);
  });
});

describe('worker entrypoint ordering', () => {
  // Regression guard. `ConfigModule.forRoot()` executes when `app.module.ts` is
  // evaluated, so a *static* import of AppModule is hoisted above the
  // `WORKER_MODE` assignment and the flag is validated as false. The worker then
  // boots, logs normally and silently consumes nothing -- which is exactly what
  // happened before this was caught. The import must stay dynamic and must come
  // after the assignment.
  const source = readFileSync(join(__dirname, '..', 'src', 'worker.ts'), 'utf8');

  it('does not statically import AppModule', () => {
    expect(source).not.toMatch(/^import .*from '\.\/app\.module';/m);
  });

  it('sets WORKER_MODE before dynamically importing AppModule', () => {
    const assignmentIndex = source.indexOf("process.env.WORKER_MODE = 'true'");
    const importIndex = source.indexOf("await import('./app.module')");

    expect(assignmentIndex).toBeGreaterThan(-1);
    expect(importIndex).toBeGreaterThan(-1);
    expect(assignmentIndex).toBeLessThan(importIndex);
  });

  it('validates the environment only after AppModule has loaded the .env file', () => {
    const importIndex = source.indexOf("await import('./app.module')");
    const validateIndex = source.indexOf('validateEnv(process.env)');

    expect(validateIndex).toBeGreaterThan(importIndex);
  });
});
