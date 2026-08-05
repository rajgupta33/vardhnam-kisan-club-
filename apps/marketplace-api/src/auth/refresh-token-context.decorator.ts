import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RefreshTokenContext } from './refresh-token.guard';

type RefreshTokenRequest = Request & {
  refreshTokenContext?: RefreshTokenContext;
};

export const RefreshTokenContextParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RefreshTokenContext => {
    const request = context.switchToHttp().getRequest<RefreshTokenRequest>();

    if (!request.refreshTokenContext) {
      throw new Error('Refresh token context is unavailable');
    }

    return request.refreshTokenContext;
  },
);
