import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from './current-user.interface';

type AuthenticatedRequest = Request & {
  user?: CurrentUser;
};

export const CurrentUserContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error('Current user is unavailable');
    }

    return request.user;
  },
);
