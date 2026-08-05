import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller()
export class AppController {
  @Get()
  info() {
    return {
      service: 'marketplace-api',
      phase: 'phase-0-foundation',
      integrations: {
        sms: 'mock',
        whatsapp: 'mock',
        email: 'mock',
        payment: 'mock',
        tally: 'mock',
      },
    };
  }
}
