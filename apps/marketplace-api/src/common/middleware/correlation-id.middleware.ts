import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & {
  requestId?: string;
};

export function correlationIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  const existing = request.header('x-request-id');
  const requestId = existing && existing.trim().length > 0 ? existing : randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}

export function getRequestId(request: Request): string {
  const requestWithId = request as RequestWithId;
  return requestWithId.requestId ?? request.header('x-request-id') ?? randomUUID();
}
