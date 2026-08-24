import type { OpenAPIObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OPENAPI_DESCRIPTION,
  OPENAPI_TITLE,
  OPENAPI_VERSION,
  serializeOpenApiDocument,
} from '../src/openapi';

describe('OpenAPI document configuration', () => {
  it('uses current marketplace metadata rather than a stale implementation phase', () => {
    expect(OPENAPI_TITLE).toBe('Vardhnam Agrotech Marketplace API');
    expect(OPENAPI_VERSION).toBe('0.1.0');
    expect(OPENAPI_DESCRIPTION).toContain('returns and disputes');
    expect(OPENAPI_DESCRIPTION).toContain('External providers remain mock');
    expect(OPENAPI_DESCRIPTION).not.toContain('Phase 4E');
  });

  it('serializes with stable indentation and a final newline', () => {
    const document = {
      openapi: '3.0.0',
      paths: {},
      info: { title: OPENAPI_TITLE, version: OPENAPI_VERSION },
    } as OpenAPIObject;

    const serialized = serializeOpenApiDocument(document);
    expect(serialized).toBe(`${JSON.stringify(document, null, 2)}\n`);
  });

  it('documents every generated-client Admin Jobs response envelope', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;
    expect(document.paths['/api/v1/admin/jobs/queues']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AdminQueuesResponseDto' },
        },
      },
    });
    expect(document.paths['/api/v1/admin/jobs/dead-letter']?.get?.responses?.['200']).toMatchObject(
      {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DeadLetterPageResponseDto' },
          },
        },
      },
    );
    expect(
      document.paths['/api/v1/admin/jobs/dead-letter/{jobId}/retry']?.post?.responses?.['201'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/RetryDeadLetterResponseDto' },
        },
      },
    });
  });

  it('documents the generated-client Notifications response envelopes', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    expect(document.paths['/api/v1/notifications']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/NotificationPageResponseDto' },
        },
      },
    });
    expect(
      document.paths['/api/v1/notifications/{id}/dispatch']?.post?.responses?.['201'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/NotificationDispatchResponseDto' },
        },
      },
    });
  });

  it('documents the generated-client Tally response envelopes', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    const expectedResponses = [
      ['/api/v1/tally/sync-records', 'get', '200', 'TallySyncRecordPageResponseDto'],
      ['/api/v1/tally/sync-records/{id}', 'get', '200', 'TallySyncRecordDetailResponseEnvelopeDto'],
      [
        '/api/v1/tally/sync-records/{id}/attempt',
        'post',
        '201',
        'TallySyncRecordResponseEnvelopeDto',
      ],
      ['/api/v1/tally/reconciliation', 'get', '200', 'TallyReconciliationResponseDto'],
    ] as const;

    for (const [path, method, status, schema] of expectedResponses) {
      expect(document.paths[path]?.[method]?.responses?.[status]).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schema}` },
          },
        },
      });
    }
  });

  it('documents both generated-client Dashboard response envelopes', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    for (const path of ['/api/v1/dashboards/summary', '/api/v1/dashboards/summary/export']) {
      expect(document.paths[path]?.get?.responses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DashboardSummaryResponseDto' },
          },
        },
      });
    }
  });

  it('documents the generated-client Support read response envelopes', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    expect(document.paths['/api/v1/support/tickets']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SupportTicketPageResponseDto' },
        },
      },
    });
    expect(
      document.paths['/api/v1/support/tickets/{ticketId}']?.get?.responses?.['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/SupportTicketResponseEnvelopeDto' },
        },
      },
    });
  });

  it('documents every portal-exposed generated-client Support mutation response', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;
    const actionPaths = [
      'assign',
      'mark-waiting',
      'resume',
      'escalate',
      'resolve',
      'close',
      'reopen',
    ];

    for (const action of actionPaths) {
      expect(
        document.paths[`/api/v1/support/tickets/{ticketId}/${action}`]?.post?.responses?.['201'],
      ).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SupportTicketResponseEnvelopeDto' },
          },
        },
      });
    }
  });

  it('documents every generated-client Payout read response envelope', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;
    const expectedResponses = [
      ['/api/v1/payouts/accounts', 'PayoutAccountPageResponseDto'],
      ['/api/v1/payouts/accounts/me', 'PayoutAccountResponseEnvelopeDto'],
      ['/api/v1/payouts/accounts/{userId}', 'PayoutAccountResponseEnvelopeDto'],
      ['/api/v1/payouts/statements/me', 'PayoutStatementResponseDto'],
    ] as const;

    for (const [path, schema] of expectedResponses) {
      expect(document.paths[path]?.get?.responses?.['200']).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schema}` },
          },
        },
      });
    }
  });

  it('documents both generated-client Payout mutation responses', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    expect(document.paths['/api/v1/payouts/accounts/me']?.put?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/PayoutAccountResponseEnvelopeDto' },
        },
      },
    });
    expect(
      document.paths['/api/v1/payouts/accounts/{accountId}/verify']?.post?.responses?.['201'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/PayoutAccountResponseEnvelopeDto' },
        },
      },
    });
  });

  it('documents safe generated-client Organisation read responses', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;

    expect(document.paths['/api/v1/organisations']?.get?.responses?.['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/OrganisationPageResponseDto' },
        },
      },
    });
    expect(
      document.paths['/api/v1/organisations/{organisationId}']?.get?.responses?.['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/OrganisationDetailResponseEnvelopeDto' },
        },
      },
    });
    expect(
      JSON.stringify(document.components?.schemas?.OrganisationUserIdentityResponseDto),
    ).not.toContain('passwordHash');
  });

  it('documents safe generated-client User responses for every operation', () => {
    const document = JSON.parse(
      readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'),
    ) as OpenAPIObject;
    const expectedResponses = [
      ['/api/v1/users', 'get', '200', 'UserPageResponseDto'],
      ['/api/v1/users', 'post', '201', 'UserResponseEnvelopeDto'],
      ['/api/v1/users/{userId}', 'get', '200', 'UserResponseEnvelopeDto'],
      ['/api/v1/users/{userId}', 'patch', '200', 'UserResponseEnvelopeDto'],
    ] as const;

    for (const [path, method, status, schema] of expectedResponses) {
      expect(document.paths[path]?.[method]?.responses?.[status]).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schema}` },
          },
        },
      });
    }
    expect(JSON.stringify(document.components?.schemas?.UserResponseDto)).not.toContain(
      'passwordHash',
    );
  });
});
