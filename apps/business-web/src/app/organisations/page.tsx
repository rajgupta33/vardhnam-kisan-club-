import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import {
  loadOrganisations,
  type OrganisationDirectoryStatus,
  type PortalOrganisation,
} from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statusValues: OrganisationDirectoryStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
];
const limit = 25;

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const status = parseStatus(readParam(resolved.status));
  const q = readParam(resolved.q);
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const result = await loadOrganisations({
    page,
    limit,
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
  });

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Organisations API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<PortalOrganisation>[] = [
    { key: 'name', header: 'Organisation', render: (row) => row.displayName },
    { key: 'type', header: 'Type', render: (row) => labelFromCode(row.type) },
    { key: 'legal', header: 'Legal name', render: (row) => row.legalName },
    { key: 'gstin', header: 'GSTIN', render: (row) => row.gstin ?? 'Not recorded' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />,
    },
    { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Link className="textLink" href={`/organisations/${row.id}`}>
          Manage
        </Link>
      ),
    },
  ];

  return (
    <BusinessShell active="organisations" eyebrow="Organisation directory" statuses={statuses} title="Organisations">
      <section className="toolbar" aria-label="Organisation filters">
        <div className="segmentedControl">
          <FilterLink active={!status} href={buildHref(undefined, q, 1)} label="All" />
          {statusValues.map((value) => (
            <FilterLink
              active={status === value}
              href={buildHref(value, q, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          {status ? <input name="status" type="hidden" value={status} /> : null}
          <label>
            Search
            <input defaultValue={q ?? ''} name="q" placeholder="Slug, legal name or GSTIN" type="text" />
          </label>
          <button className="secondaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Organisations are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Organisations"
            columns={columns}
            emptyDescription="No organisations match this filter."
            emptyTitle="No organisations"
            rowKey={(row) => row.id}
            rows={result.data.items}
          />
          <Pagination
            buildHref={(target) => buildHref(status, q, target)}
            limit={limit}
            page={result.data.page}
            total={result.data.total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function statusTone(status: OrganisationDirectoryStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  return 'warn';
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link aria-current={active ? 'page' : undefined} className={active ? 'selected' : undefined} href={href}>
      {label}
    </Link>
  );
}

function buildHref(status: OrganisationDirectoryStatus | undefined, q: string | undefined, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  return `/organisations?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): OrganisationDirectoryStatus | undefined {
  return statusValues.includes(value as OrganisationDirectoryStatus)
    ? (value as OrganisationDirectoryStatus)
    : undefined;
}
