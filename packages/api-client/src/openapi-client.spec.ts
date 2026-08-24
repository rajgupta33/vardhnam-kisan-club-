import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenApiClient } from './index.js';

test('generated client types the complete Admin Jobs workflow and attaches auth', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    if (capturedRequest.method === 'POST') {
      return Response.json(
        {
          data: { queue: 'notifications', deadLetterJobId: 'job-42', replayJobId: 'job-43' },
          requestId: 'request-3',
        },
        { status: 201 },
      );
    }
    if (new URL(capturedRequest.url).pathname.endsWith('/dead-letter')) {
      return Response.json({
        data: { items: [], page: 2, limit: 25, total: 0 },
        requestId: 'request-2',
      });
    }
    return Response.json({
      data: { queues: [], scheduledJobs: [] },
      requestId: 'request-1',
    });
  };

  try {
    const client = createOpenApiClient({
      baseUrl: 'http://127.0.0.1:3001/',
      getAccessToken: async () => 'test-access-token',
    });
    const queuesResult = await client.GET('/api/v1/admin/jobs/queues');
    const deadLetterResult = await client.GET('/api/v1/admin/jobs/dead-letter', {
      params: { query: { queue: 'notifications', page: 2, limit: 25 } },
    });
    const retryResult = await client.POST('/api/v1/admin/jobs/dead-letter/{jobId}/retry', {
      params: { path: { jobId: 'job-42' } },
      body: { queue: 'notifications', reason: 'Provider recovered' },
    });

    assert.deepEqual(queuesResult.data?.data, { queues: [], scheduledJobs: [] });
    assert.deepEqual(deadLetterResult.data?.data, { items: [], page: 2, limit: 25, total: 0 });
    assert.deepEqual(retryResult.data?.data, {
      queue: 'notifications',
      deadLetterJobId: 'job-42',
      replayJobId: 'job-43',
    });
    assert.equal(capturedRequests[0]?.url, 'http://127.0.0.1:3001/api/v1/admin/jobs/queues');
    const deadLetterUrl = new URL(capturedRequests[1]?.url ?? 'http://invalid');
    assert.equal(deadLetterUrl.pathname, '/api/v1/admin/jobs/dead-letter');
    assert.deepEqual(Object.fromEntries(deadLetterUrl.searchParams), {
      queue: 'notifications',
      page: '2',
      limit: '25',
    });
    assert.equal(
      capturedRequests[2]?.url,
      'http://127.0.0.1:3001/api/v1/admin/jobs/dead-letter/job-42/retry',
    );
    assert.equal(capturedRequests[2]?.method, 'POST');
    for (const capturedRequest of capturedRequests) {
      assert.equal(capturedRequest.headers.get('Authorization'), 'Bearer test-access-token');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types notification filters and dispatch acknowledgement', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    if (capturedRequest.method === 'POST') {
      return Response.json(
        {
          data: {
            notificationId: '00000000-0000-4000-8000-000000000042',
            queued: true,
          },
          requestId: 'request-5',
        },
        { status: 201 },
      );
    }
    return Response.json({
      data: { items: [], page: 3, limit: 25, total: 0 },
      requestId: 'request-4',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/notifications', {
      params: { query: { channel: 'SMS', status: 'FAILED', page: 3, limit: 25 } },
    });
    const dispatchResult = await client.POST('/api/v1/notifications/{id}/dispatch', {
      params: { path: { id: '00000000-0000-4000-8000-000000000042' } },
    });

    assert.deepEqual(listResult.data?.data, { items: [], page: 3, limit: 25, total: 0 });
    assert.deepEqual(dispatchResult.data?.data, {
      notificationId: '00000000-0000-4000-8000-000000000042',
      queued: true,
    });
    const listUrl = new URL(capturedRequests[0]?.url ?? 'http://invalid');
    assert.deepEqual(Object.fromEntries(listUrl.searchParams), {
      channel: 'SMS',
      status: 'FAILED',
      page: '3',
      limit: '25',
    });
    assert.equal(
      capturedRequests[1]?.url,
      'http://127.0.0.1:3001/api/v1/notifications/00000000-0000-4000-8000-000000000042/dispatch',
    );
    assert.equal(capturedRequests[1]?.method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types the Tally reconciliation and manual-attempt workflow', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  const recordId = '00000000-0000-4000-8000-000000000052';
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    const url = new URL(capturedRequest.url);
    if (capturedRequest.method === 'POST') {
      return Response.json(
        { data: { id: recordId, status: 'SYNCED' }, requestId: 'request-9' },
        { status: 201 },
      );
    }
    if (url.pathname.endsWith('/reconciliation')) {
      return Response.json({ data: [], requestId: 'request-8' });
    }
    if (url.pathname.endsWith(`/${recordId}`)) {
      return Response.json({ data: { id: recordId, attempts: [] }, requestId: 'request-7' });
    }
    return Response.json({
      data: { items: [], page: 2, limit: 25, total: 0 },
      requestId: 'request-6',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/tally/sync-records', {
      params: { query: { recordType: 'INVOICE', status: 'SYNCING', page: 2, limit: 25 } },
    });
    const detailResult = await client.GET('/api/v1/tally/sync-records/{id}', {
      params: { path: { id: recordId } },
    });
    const reconciliationResult = await client.GET('/api/v1/tally/reconciliation');
    const attemptResult = await client.POST('/api/v1/tally/sync-records/{id}/attempt', {
      params: { path: { id: recordId } },
      body: { outcome: 'SYNCED', tallyReferenceId: 'MOCK-TALLY-VCH-52' },
    });

    assert.deepEqual(listResult.data?.data, { items: [], page: 2, limit: 25, total: 0 });
    assert.deepEqual(detailResult.data?.data, { id: recordId, attempts: [] });
    assert.deepEqual(reconciliationResult.data?.data, []);
    assert.deepEqual(attemptResult.data?.data, { id: recordId, status: 'SYNCED' });
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[0]?.url ?? '').searchParams), {
      recordType: 'INVOICE',
      status: 'SYNCING',
      page: '2',
      limit: '25',
    });
    assert.equal(capturedRequests[3]?.method, 'POST');
    assert.deepEqual(await capturedRequests[3]?.json(), {
      outcome: 'SYNCED',
      tallyReferenceId: 'MOCK-TALLY-VCH-52',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types dashboard summary and audited export reads', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    return Response.json({
      data: {
        items: [
          {
            code: 'my_unread_notifications',
            label: 'My unread notifications',
            scope: 'SELF',
            count: 2,
          },
        ],
      },
      requestId: capturedRequest.url.endsWith('/export') ? 'request-11' : 'request-10',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const summaryResult = await client.GET('/api/v1/dashboards/summary');
    const exportResult = await client.GET('/api/v1/dashboards/summary/export');

    assert.deepEqual(summaryResult.data?.data.items[0], {
      code: 'my_unread_notifications',
      label: 'My unread notifications',
      scope: 'SELF',
      count: 2,
    });
    assert.deepEqual(exportResult.data?.data.items, summaryResult.data?.data.items);
    assert.equal(capturedRequests[0]?.method, 'GET');
    assert.equal(
      capturedRequests[1]?.url,
      'http://127.0.0.1:3001/api/v1/dashboards/summary/export',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types support ticket filters and resource reads', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  const ticketId = '00000000-0000-4000-8000-000000000062';
  const ticket = {
    id: ticketId,
    raisedByUserId: '00000000-0000-4000-8000-000000000063',
    raisedByRole: 'FARMER' as const,
    raiserOrganisationId: null,
    productOrderId: null,
    category: 'ORDER_ISSUE' as const,
    priority: 'HIGH' as const,
    subject: 'Delivery is late',
    description: 'The order has not arrived.',
    status: 'ASSIGNED' as const,
    assignedToUserId: '00000000-0000-4000-8000-000000000064',
    assignedAt: '2026-08-24T08:00:00.000Z',
    slaDueAt: '2026-08-25T08:00:00.000Z',
    resolutionNote: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: '2026-08-24T07:00:00.000Z',
    updatedAt: '2026-08-24T08:00:00.000Z',
  };
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    const url = new URL(capturedRequest.url);
    if (capturedRequest.method === 'POST') {
      return Response.json({ data: ticket, requestId: 'request-14' }, { status: 201 });
    }
    if (url.pathname.endsWith(`/${ticketId}`)) {
      return Response.json({ data: ticket, requestId: 'request-13' });
    }
    return Response.json({
      data: { items: [ticket], page: 2, limit: 25, total: 26 },
      requestId: 'request-12',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/support/tickets', {
      params: {
        query: { status: 'ASSIGNED', priority: 'HIGH', page: 2, limit: 25 },
      },
    });
    const detailResult = await client.GET('/api/v1/support/tickets/{ticketId}', {
      params: { path: { ticketId } },
    });
    const assignResult = await client.POST('/api/v1/support/tickets/{ticketId}/assign', {
      params: { path: { ticketId } },
      body: { assignedToUserId: ticket.assignedToUserId, reason: 'Owning the case' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/mark-waiting', {
      params: { path: { ticketId } },
      body: { status: 'WAITING_FOR_CUSTOMER', reason: 'Need delivery details' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/resume', {
      params: { path: { ticketId } },
      body: { reason: 'Details received' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/escalate', {
      params: { path: { ticketId } },
      body: { reason: 'SLA risk identified' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/resolve', {
      params: { path: { ticketId } },
      body: { resolutionNote: 'Delivery completed and confirmed.' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/close', {
      params: { path: { ticketId } },
      body: { reason: 'Resolution accepted' },
    });
    await client.POST('/api/v1/support/tickets/{ticketId}/reopen', {
      params: { path: { ticketId } },
      body: { reason: 'Issue recurred' },
    });

    assert.deepEqual(listResult.data?.data.items, [ticket]);
    assert.deepEqual(detailResult.data?.data, ticket);
    assert.deepEqual(assignResult.data?.data, ticket);
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[0]?.url ?? '').searchParams), {
      status: 'ASSIGNED',
      priority: 'HIGH',
      page: '2',
      limit: '25',
    });
    assert.equal(
      capturedRequests[1]?.url,
      `http://127.0.0.1:3001/api/v1/support/tickets/${ticketId}`,
    );
    assert.deepEqual(
      capturedRequests.slice(2).map((request) => new URL(request.url).pathname.split('/').at(-1)),
      ['assign', 'mark-waiting', 'resume', 'escalate', 'resolve', 'close', 'reopen'],
    );
    assert.deepEqual(await capturedRequests[2]?.json(), {
      assignedToUserId: ticket.assignedToUserId,
      reason: 'Owning the case',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types masked payout accounts and backend statement totals', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  const userId = '00000000-0000-4000-8000-000000000072';
  const account = {
    id: '00000000-0000-4000-8000-000000000071',
    userId,
    accountHolderName: 'Test Partner',
    bankName: 'Test Bank',
    accountNumber: '********6789',
    ifscCode: 'TEST0001234',
    upiId: null,
    status: 'VERIFIED' as const,
    verifiedAt: '2026-08-24T09:00:00.000Z',
    verifiedByUserId: '00000000-0000-4000-8000-000000000073',
    verifiedByRole: 'FINANCE_MANAGER' as const,
    rejectionReason: null,
    createdAt: '2026-08-24T08:00:00.000Z',
    updatedAt: '2026-08-24T09:00:00.000Z',
  };
  const statementEntry = {
    id: '00000000-0000-4000-8000-000000000074',
    productOrderId: '00000000-0000-4000-8000-000000000075',
    sellerOrganisationId: '00000000-0000-4000-8000-000000000076',
    commissionRuleId: '00000000-0000-4000-8000-000000000077',
    entryType: 'PROMOTER_COMMISSION' as const,
    amountPaise: 12500,
    status: 'FINAL' as const,
    eligibleAt: '2026-08-24T09:00:00.000Z',
    finalizedAt: '2026-08-24T09:30:00.000Z',
    reversedAt: null,
    reversalReason: null,
    settlementId: null,
    recipientUserId: userId,
    createdAt: '2026-08-24T08:30:00.000Z',
  };
  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    const url = new URL(capturedRequest.url);
    if (capturedRequest.method === 'PUT' || capturedRequest.method === 'POST') {
      return Response.json(
        { data: account, requestId: 'request-19' },
        { status: capturedRequest.method === 'POST' ? 201 : 200 },
      );
    }
    if (url.pathname.endsWith('/statements/me')) {
      return Response.json({
        data: {
          items: [statementEntry],
          page: 2,
          limit: 25,
          total: 26,
          totalsByStatus: [{ status: 'FINAL', amountPaise: 12500 }],
        },
        requestId: 'request-18',
      });
    }
    if (url.pathname.endsWith('/accounts')) {
      return Response.json({
        data: { items: [account], page: 2, limit: 25, total: 26 },
        requestId: 'request-15',
      });
    }
    return Response.json({ data: account, requestId: 'request-16' });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/payouts/accounts', {
      params: { query: { status: 'VERIFIED', page: 2, limit: 25 } },
    });
    const detailResult = await client.GET('/api/v1/payouts/accounts/{userId}', {
      params: { path: { userId } },
    });
    const selfResult = await client.GET('/api/v1/payouts/accounts/me');
    const statementResult = await client.GET('/api/v1/payouts/statements/me', {
      params: { query: { status: 'FINAL', page: 2, limit: 25 } },
    });
    const upsertResult = await client.PUT('/api/v1/payouts/accounts/me', {
      body: {
        accountHolderName: 'Test Partner',
        bankName: 'Test Bank',
        accountNumber: '000123456789',
        ifscCode: 'TEST0001234',
      },
    });
    const verifyResult = await client.POST('/api/v1/payouts/accounts/{accountId}/verify', {
      params: { path: { accountId: account.id } },
      body: { status: 'VERIFIED', reason: 'Bank details matched' },
    });

    assert.equal(listResult.data?.data.items[0]?.accountNumber, '********6789');
    assert.equal(detailResult.data?.data.verifiedByRole, 'FINANCE_MANAGER');
    assert.deepEqual(selfResult.data?.data, account);
    assert.deepEqual(statementResult.data?.data.totalsByStatus, [
      { status: 'FINAL', amountPaise: 12500 },
    ]);
    assert.equal(upsertResult.data?.data.accountNumber, '********6789');
    assert.equal(verifyResult.data?.data.status, 'VERIFIED');
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[0]?.url ?? '').searchParams), {
      status: 'VERIFIED',
      page: '2',
      limit: '25',
    });
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[3]?.url ?? '').searchParams), {
      status: 'FINAL',
      page: '2',
      limit: '25',
    });
    assert.deepEqual(await capturedRequests[4]?.json(), {
      accountHolderName: 'Test Partner',
      bankName: 'Test Bank',
      accountNumber: '000123456789',
      ifscCode: 'TEST0001234',
    });
    assert.deepEqual(await capturedRequests[5]?.json(), {
      status: 'VERIFIED',
      reason: 'Bank details matched',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types safe organisation directory responses', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  const organisationId = '00000000-0000-4000-8000-000000000081';
  const user = {
    id: '00000000-0000-4000-8000-000000000082',
    email: 'reviewer@example.test',
    phone: null,
    status: 'ACTIVE' as const,
    profile: { displayName: 'Catalogue Reviewer' },
  };
  const organisation = {
    id: organisationId,
    type: 'DISTRIBUTOR' as const,
    slug: 'safe-distributor',
    legalName: 'Safe Distributor Private Limited',
    displayName: 'Safe Distributor',
    gstin: null,
    registeredStateCode: null,
    gstinVerifiedAt: null,
    status: 'ACTIVE' as const,
    reviewedAt: '2026-08-24T10:00:00.000Z',
    reviewedByUserId: user.id,
    reviewedBy: user,
    reviewReason: 'Verified',
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
  };
  const membership = {
    id: '00000000-0000-4000-8000-000000000083',
    userId: user.id,
    organisationId,
    role: 'DISTRIBUTOR_OWNER' as const,
    status: 'ACTIVE' as const,
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T09:00:00.000Z',
    user,
  };

  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    const url = new URL(capturedRequest.url);
    if (url.pathname.endsWith(`/${organisationId}`)) {
      return Response.json({
        data: { ...organisation, memberships: [membership] },
        requestId: 'request-21',
      });
    }
    return Response.json({
      data: { items: [organisation], page: 2, limit: 25, total: 26 },
      requestId: 'request-20',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/organisations', {
      params: {
        query: { type: 'DISTRIBUTOR', status: 'ACTIVE', q: 'safe', page: 2, limit: 25 },
      },
    });
    const detailResult = await client.GET('/api/v1/organisations/{organisationId}', {
      params: { path: { organisationId } },
    });

    assert.deepEqual(listResult.data?.data.items, [organisation]);
    assert.deepEqual(detailResult.data?.data.memberships, [membership]);
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[0]?.url ?? '').searchParams), {
      type: 'DISTRIBUTOR',
      status: 'ACTIVE',
      q: 'safe',
      page: '2',
      limit: '25',
    });
    assert.equal(JSON.stringify({ listResult, detailResult }).includes('passwordHash'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated client types safe user directory responses', async () => {
  const originalFetch = globalThis.fetch;
  const capturedRequests: Request[] = [];
  const userId = '00000000-0000-4000-8000-000000000092';
  const user = {
    id: userId,
    email: 'safe.user@example.test',
    phone: null,
    status: 'ACTIVE' as const,
    profile: {
      id: '00000000-0000-4000-8000-000000000093',
      userId,
      displayName: 'Safe User',
      preferredLocale: 'en-IN',
      timezone: 'Asia/Kolkata',
      createdAt: '2026-08-24T11:00:00.000Z',
      updatedAt: '2026-08-24T11:00:00.000Z',
    },
    memberships: [],
    createdAt: '2026-08-24T11:00:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z',
  };

  globalThis.fetch = async (request) => {
    const capturedRequest = request instanceof Request ? request : new Request(request);
    capturedRequests.push(capturedRequest);
    if (new URL(capturedRequest.url).pathname.endsWith(`/${userId}`)) {
      return Response.json({ data: user, requestId: 'request-23' });
    }
    return Response.json({
      data: { items: [user], page: 2, limit: 25, total: 26 },
      requestId: 'request-22',
    });
  };

  try {
    const client = createOpenApiClient({ baseUrl: 'http://127.0.0.1:3001' });
    const listResult = await client.GET('/api/v1/users', {
      params: { query: { status: 'ACTIVE', q: 'safe', page: 2, limit: 25 } },
    });
    const detailResult = await client.GET('/api/v1/users/{userId}', {
      params: { path: { userId } },
    });

    assert.deepEqual(listResult.data?.data.items, [user]);
    assert.deepEqual(detailResult.data?.data, user);
    assert.deepEqual(Object.fromEntries(new URL(capturedRequests[0]?.url ?? '').searchParams), {
      status: 'ACTIVE',
      q: 'safe',
      page: '2',
      limit: '25',
    });
    assert.equal(JSON.stringify({ listResult, detailResult }).includes('passwordHash'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
