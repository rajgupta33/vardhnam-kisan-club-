import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorCode } from '../errors/api-error-codes';
import { getRequestId } from '../middleware/correlation-id.middleware';

interface ErrorResponseBody {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = getRequestId(request);

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : (this.clientErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const errorBody = this.normaliseErrorBody(rawResponse, statusCode);

    response.status(statusCode).json({
      error: {
        code: errorBody.code,
        message: errorBody.message,
        statusCode,
        requestId,
        timestamp: new Date().toISOString(),
        details: errorBody.details,
      },
    });
  }

  /**
   * The status carried by Express-ecosystem errors that are not `HttpException`.
   *
   * `body-parser` rejects an oversized body and malformed JSON by throwing a
   * plain `Error` with `status`/`statusCode` set (413 and 400 respectively).
   * Without this, both fell through to 500 -- so a client mistake was reported
   * as a server fault, told the caller nothing about what to fix, and counted
   * against server error rates in monitoring.
   *
   * Deliberately limited to 4xx: a 5xx from an unrecognised source is a genuine
   * server fault and must keep its generic message rather than leak internals.
   */
  private clientErrorStatus(exception: unknown): number | undefined {
    if (typeof exception !== 'object' || exception === null) return undefined;
    const candidate = exception as { status?: unknown; statusCode?: unknown };
    const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
    if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
    return status >= 400 && status <= 499 ? status : undefined;
  }

  private normaliseErrorBody(
    rawResponse: unknown,
    statusCode: number,
  ): Required<ErrorResponseBody> {
    if (typeof rawResponse === 'object' && rawResponse !== null) {
      const body = rawResponse as ErrorResponseBody;
      const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
      return {
        code: body.code ?? this.defaultCodeForStatus(statusCode),
        message: message ?? 'Request failed',
        details: body.details ?? (Array.isArray(body.message) ? body.message : []),
      };
    }

    if (typeof rawResponse === 'string') {
      return {
        code: this.defaultCodeForStatus(statusCode),
        message: rawResponse,
        details: [],
      };
    }

    return {
      code: this.defaultCodeForStatus(statusCode),
      message:
        statusCode === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Request failed',
      details: [],
    };
  }

  private defaultCodeForStatus(statusCode: number): ApiErrorCode {
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return ApiErrorCode.VALIDATION_FAILED;
    }
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return ApiErrorCode.UNAUTHENTICATED;
    }
    if (statusCode === HttpStatus.FORBIDDEN) {
      return ApiErrorCode.FORBIDDEN;
    }
    if (statusCode === HttpStatus.NOT_FOUND) {
      return ApiErrorCode.NOT_FOUND;
    }
    if (statusCode === HttpStatus.CONFLICT) {
      return ApiErrorCode.CONFLICT;
    }
    if (statusCode === HttpStatus.PAYLOAD_TOO_LARGE) {
      return ApiErrorCode.PAYLOAD_TOO_LARGE;
    }
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return ApiErrorCode.RATE_LIMITED;
    }
    return ApiErrorCode.INTERNAL_ERROR;
  }
}
