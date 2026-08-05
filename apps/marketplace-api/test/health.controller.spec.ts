import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';
import type { HealthService } from '../src/health/health.service';

describe('HealthController', () => {
  it('returns liveness', () => {
    const service = {
      live: jest.fn().mockReturnValue({ status: 'ok' }),
      ready: jest.fn(),
    } as unknown as HealthService;
    const controller = new HealthController(service);

    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('throws if readiness fails', async () => {
    const service = {
      live: jest.fn(),
      ready: jest.fn().mockResolvedValue({
        status: 'error',
        checks: [{ name: 'postgres', status: 'error' }],
      }),
    } as unknown as HealthService;
    const controller = new HealthController(service);

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
