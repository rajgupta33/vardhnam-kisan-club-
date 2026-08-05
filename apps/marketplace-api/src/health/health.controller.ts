import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  async ready() {
    const readiness = await this.healthService.ready();

    if (readiness.status !== 'ok') {
      throw new ServiceUnavailableException({
        code: ApiErrorCode.READINESS_CHECK_FAILED,
        message: 'One or more readiness checks failed',
        details: readiness.checks,
      });
    }

    return readiness;
  }
}
