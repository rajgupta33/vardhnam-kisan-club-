import Link from 'next/link';
import type { ReturnRequest, ReturnRequestStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadReturnRequests } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const returnStatuses: ReturnRequestStatus[] = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'COMPLETED',
  'CANCELLED',
];
const limit = 50;

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const status = parseStatus(readParam(params.status));
  const q = readParam(params.q);
  const page = parsePage(readParam(params.page));
  const result = await loadReturnRequests({
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    page,
    limit,
  });
  const requests = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;
  const columns: DataTableColumn<ReturnRequest>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (request) => (
        <Link className="textLink" href={`/returns/${request.id}`}>
          {request.orderNumber}
        </Link>
      ),
    },
    { key: 'seller', header: 'Seller', render: (request) => request.sellerName },
    {
      key: 'reason',
      header: 'Reason',
      render: (request) => labelFromCode(request.reasonCode),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (request) => formatPaise(request.refundableAmountPaise),
    },
    {
      key: 'status',
      header: 'Status',
      render: (request) => (
        <StatusBadge label={labelFromCode(request.status)} tone={statusTone(request.status)} />
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      render: (request) => formatDateTime(request.requestedAt),
    },
  ];

  return (
    <BusinessShell
      active="returns"
      eyebrow="Reverse logistics"
      statuses={[
        {
          label: result.ok ? `${requests.length} return rows` : 'Return API unavailable',
          tone: result.ok ? 'ok' : 'warn',
        },
        { label: 'Inspection does not auto-restock', tone: 'warn' },
      ]}
      title="Return Requests"
    >
      <section className="toolbar" aria-label="Return request filters">
        <div className="segmentedControl">
          <FilterLink active={!status} href={returnsHref(undefined, q, 1)} label="All" />
          {returnStatuses.map((value) => (
            <FilterLink
              active={status === value}
              href={returnsHref(value, q, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          {status ? <input name="status" type="hidden" value={status} /> : null}
          <input defaultValue={q ?? ''} name="q" placeholder="Order or seller" type="search" />
          <button className="primaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Return API Connection Blocked" />
      ) : (
        <>
          <DataTable
            caption="Return request queue"
            columns={columns}
            emptyDescription="Return requests matching this filter will appear here."
            emptyTitle="No return requests found"
            rowKey={(request) => request.id}
            rows={requests}
          />
          <Pagination
            buildHref={(targetPage) => returnsHref(status, q, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={active ? 'selected' : undefined}
      href={href}
    >
      {label}
    </Link>
  );
}

function returnsHref(
  status: ReturnRequestStatus | undefined,
  q: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/returns?${query}` : '/returns';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseStatus(value: string | undefined): ReturnRequestStatus | undefined {
  return returnStatuses.find((status) => status === value);
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: ReturnRequestStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'COMPLETED') return 'ok';
  return 'warn';
}

function formatPaise(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}
