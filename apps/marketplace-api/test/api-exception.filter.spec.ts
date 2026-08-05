import { BadRequestException } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('formats validation errors consistently', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const filter = new ApiExceptionFilter();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          header: (name: string) => (name === 'x-request-id' ? 'req-1' : undefined),
        }),
      }),
    };

    filter.catch(
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: ['displayName must be longer than or equal to 2 characters'],
      }),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_FAILED',
          requestId: 'req-1',
          statusCode: 400,
        }),
      }),
    );
  });
});
