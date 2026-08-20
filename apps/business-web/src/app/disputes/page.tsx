import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { labelFromCode } from '../../lib/format';
import { loadDisputes, type Dispute, type DisputeCategory, type DisputeStatus } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statusValues: DisputeStatus[] = [
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_FARMER',
  'AWAITING_DISTRIBUTOR',
  'RESOLVED_FOR_FARMER',
  'RESOLVED_FOR_DISTRIBUTOR',
  'RESOLVED_SPLIT',
  'CLOSED',
];
const categoryValues: DisputeCategory[] = [
  'PRODUCT_QUALITY',
  'DELIVERY',
  'RETURN_DECISION',
  'REFUND_AMOUNT',
  'PAYMENT',
  'OTHER',
];
const limit = 25;

export default async function DisputesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolved = (await searchParams) ?? {};
  const status = parseEnum(readParam(resolved.status), statusValues);
  const category = parseEnum(readParam(resolved.category), categoryValues);
  const q = readParam(resolved.q);
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const result = await loadDisputes({
    page: String(page),
    limit: String(limit),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(q ? { q } : {}),
  });

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Disputes API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<Dispute>[] = [
    { key: 'order', header: 'Order', render: (row) => row.orderNumber },
    { key: 'seller', header: 'Seller', render: (row) => row.sellerName },
    { key: 'category', header: 'Category', render: (row) => labelFromCode(row.category) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />,
    },
    { key: 'assignee', header: 'Assigned to', render: (row) => row.assignedToUserId ?? 'Unassigned' },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Link className="textLink" href={`/disputes/${row.id}`}>
          Review
        </Link>
      ),
    },
  ];

  return (
    <BusinessShell active="disputes" eyebrow="Dispute resolution" statuses={statuses} title="Disputes">
      <section className="toolbar" aria-label="Dispute filters">
        <div className="segmentedControl">
          <FilterLink active={!status} href={buildHref(undefined, category, q, 1)} label="All statuses" />
          {statusValues.map((value) => (
            <FilterLink
              active={status === value}
              href={buildHref(value, category, q, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <div className="segmentedControl">
          <FilterLink active={!category} href={buildHref(status, undefined, q, 1)} label="All categories" />
          {categoryValues.map((value) => (
            <FilterLink
              active={category === value}
              href={buildHref(status, value, q, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          {status ? <input name="status" type="hidden" value={status} /> : null}
          {category ? <input name="category" type="hidden" value={category} /> : null}
          <label>
            Search
            <input defaultValue={q ?? ''} name="q" placeholder="Order number" type="text" />
          </label>
          <button className="secondaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Disputes are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Disputes"
            columns={columns}
            emptyDescription="No disputes match this filter."
            emptyTitle="No disputes"
            rowKey={(row) => row.id}
            rows={result.data.items}
          />
          <Pagination
            buildHref={(target) => buildHref(status, category, q, target)}
            limit={limit}
            page={result.data.page}
            total={result.data.total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function statusTone(status: DisputeStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'CLOSED' || status.startsWith('RESOLVED')) return 'ok';
  if (status === 'OPEN') return 'danger';
  return 'warn';
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link aria-current={active ? 'page' : undefined} className={active ? 'selected' : undefined} href={href}>
      {label}
    </Link>
  );
}

function buildHref(
  status: DisputeStatus | undefined,
  category: DisputeCategory | undefined,
  q: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  if (q) params.set('q', q);
  return `/disputes?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}
