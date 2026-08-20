import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiErrorCode } from '../common/errors/api-error-codes';

@Injectable()
export class KisanClubEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (!this.configService.get<boolean>('KISAN_CLUB_ENABLED')) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Kisan Club is not available',
      });
    }

    return true;
  }
}
