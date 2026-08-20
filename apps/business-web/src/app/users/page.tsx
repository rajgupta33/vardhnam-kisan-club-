import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { readPortalSession } from '../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadUsers, type PortalUser, type PortalUserStatus } from '../../lib/marketplace-api';
import { createUserAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statusValues: PortalUserStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];
const limit = 25;

export default async function UsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolved = (await searchParams) ?? {};
  const status = parseStatus(readParam(resolved.status));
  const q = readParam(resolved.q);
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const [result, session] = await Promise.all([
    loadUsers({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
    }),
    readPortalSession(),
  ]);
  const canCreate = session?.permissions.includes('users:create') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Users API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<PortalUser>[] = [
    { key: 'name', header: 'Name', render: (row) => row.profile?.displayName ?? 'Not set' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '—' },
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
        <Link className="textLink" href={`/users/${row.id}`}>
          Manage
        </Link>
      ),
    },
  ];

  return (
    <BusinessShell active="users" eyebrow="User administration" statuses={statuses} title="Users">
      {readParam(resolved.notice) ? <div className="noticeBanner ok">{readParam(resolved.notice)}</div> : null}
      {readParam(resolved.error) ? <div className="noticeBanner danger">{readParam(resolved.error)}</div> : null}

      <section className="toolbar" aria-label="User filters">
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
            <input defaultValue={q ?? ''} name="q" placeholder="Email, phone or name" type="text" />
          </label>
          <button className="secondaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {canCreate ? (
        <section className="panel">
          <p className="eyebrow">Administration</p>
          <h3>Create User</h3>
          <form action={createUserAction} className="decisionForm">
            <label>
              Display name
              <input minLength={2} name="displayName" required type="text" />
            </label>
            <label>
              Email
              <input name="email" type="email" />
            </label>
            <label>
              Phone
              <input name="phone" placeholder="+919999999999" type="text" />
            </label>
            <button className="primaryButton" type="submit">
              Create user
            </button>
          </form>
        </section>
      ) : null}

      {!result.ok ? (
        <EmptyState description={result.error} title="Users are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Users"
            columns={columns}
            emptyDescription="No users match this filter."
            emptyTitle="No users"
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

function statusTone(status: PortalUserStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  return 'danger';
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link aria-current={active ? 'page' : undefined} className={active ? 'selected' : undefined} href={href}>
      {label}
    </Link>
  );
}

function buildHref(status: PortalUserStatus | undefined, q: string | undefined, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  return `/users?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): PortalUserStatus | undefined {
  return statusValues.includes(value as PortalUserStatus) ? (value as PortalUserStatus) : undefined;
}
