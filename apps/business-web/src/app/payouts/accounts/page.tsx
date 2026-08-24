import Link from 'next/link';
import { BusinessShell } from '../../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadPayoutAccounts, type PayoutAccount, type PayoutAccountStatus } from '../../../lib/marketplace-api';
import { payoutAccountDetailPath } from '../../../lib/payout-account-route';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statusValues: PayoutAccountStatus[] = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'];
const limit = 25;

export default async function PayoutAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const status = parseStatus(readParam(resolved.status));
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const result = await loadPayoutAccounts({
    page,
    limit,
    ...(status ? { status } : {}),
  });

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Payouts API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<PayoutAccount>[] = [
    { key: 'holder', header: 'Account holder', render: (row) => row.accountHolderName },
    { key: 'bank', header: 'Bank', render: (row) => row.bankName },
    { key: 'accountNumber', header: 'Account number', render: (row) => row.accountNumber },
    { key: 'ifsc', header: 'IFSC', render: (row) => row.ifscCode },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />,
    },
    { key: 'updated', header: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Link className="textLink" href={payoutAccountDetailPath(row.userId)}>
          Review
        </Link>
      ),
    },
  ];

  return (
    <BusinessShell active="payouts" eyebrow="Partner payouts" statuses={statuses} title="Payout Accounts">
      <section className="toolbar" aria-label="Payout account filters">
        <div className="segmentedControl">
          <FilterLink active={!status} href={buildHref(undefined, 1)} label="All" />
          {statusValues.map((value) => (
            <FilterLink
              active={status === value}
              href={buildHref(value, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
      </section>

      <div className="breadcrumbRow">
        <p className="mutedText">
          Review bank details partners submit before they can receive payouts. Reviewed accounts
          appear masked to everyone except the platform.
        </p>
        <Link className="textLink" href="/payouts/statements">
          My payout statement
        </Link>
      </div>

      {!result.ok ? (
        <EmptyState description={result.error} title="Payout accounts are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Payout accounts"
            columns={columns}
            emptyDescription="No payout accounts match this filter."
            emptyTitle="No payout accounts"
            rowKey={(row) => row.id}
            rows={result.data.items}
          />
          <Pagination
            buildHref={(target) => buildHref(status, target)}
            limit={limit}
            page={result.data.page}
            total={result.data.total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function statusTone(status: PayoutAccountStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'VERIFIED') return 'ok';
  if (status === 'REJECTED') return 'danger';
  return 'warn';
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link aria-current={active ? 'page' : undefined} className={active ? 'selected' : undefined} href={href}>
      {label}
    </Link>
  );
}

function buildHref(status: PayoutAccountStatus | undefined, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  return `/payouts/accounts?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): PayoutAccountStatus | undefined {
  return statusValues.includes(value as PayoutAccountStatus) ? (value as PayoutAccountStatus) : undefined;
}
