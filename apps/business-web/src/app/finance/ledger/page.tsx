import Link from 'next/link';
import { BusinessShell } from '../../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { parseFinancePage } from '../../../lib/finance-route-state';
import { formatDateTime, formatPaise, labelFromCode } from '../../../lib/format';
import { type FinancialLedgerEntry, loadLedgerEntries } from '../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const ledgerTypes = [
  'FARMER_PAYMENT',
  'DISTRIBUTOR_PAYABLE',
  'MARKETPLACE_COMMISSION',
  'DELIVERY_FEE',
  'PROMOTER_COMMISSION',
  'REFUND',
  'SETTLEMENT',
] as const;
type LedgerType = (typeof ledgerTypes)[number];
const limit = 50;

export default async function LedgerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const entryType = parseLedgerType(readParam(resolvedSearchParams.entryType));
  const page = parseFinancePage(readParam(resolvedSearchParams.page));
  const entriesResult = await loadLedgerEntries({
    ...(entryType ? { entryType } : {}),
    page: String(page),
    limit: String(limit),
  });
  const entries = entriesResult.ok ? entriesResult.data.items : [];
  const total = entriesResult.ok ? entriesResult.data.total : 0;
  const columns: DataTableColumn<FinancialLedgerEntry>[] = [
    { key: 'type', header: 'Type', render: (entry) => labelFromCode(entry.entryType) },
    { key: 'amount', header: 'Amount', render: (entry) => formatPaise(entry.amountPaise) },
    {
      key: 'organisation',
      header: 'Organisation',
      render: (entry) => entry.organisationId ?? 'Not recorded',
    },
    {
      key: 'reference',
      header: 'Order / Settlement',
      render: (entry) => entry.productOrderId ?? entry.settlementId ?? 'Not recorded',
    },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
    { key: 'recorded', header: 'Recorded', render: (entry) => formatDateTime(entry.createdAt) },
  ];
  const statuses = [
    {
      label: entriesResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: entriesResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: entriesResult.ok ? 'Finance API connected' : 'API not connected',
      tone: entriesResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="finance"
      eyebrow="Marketplace finance"
      statuses={statuses}
      title="Financial Ledger"
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/finance">
          Back to finance
        </Link>
      </div>
      <section className="metricStrip" aria-label="Displayed ledger metrics">
        <article className="metricCard">
          <p className="metricValue">{entriesResult.ok ? entriesResult.data.total : 'Unavailable'}</p>
          <p className="metricLabel">Matching ledger entries</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{entriesResult.ok ? entries.length : 'Unavailable'}</p>
          <p className="metricLabel">Entries on this page</p>
        </article>
      </section>
      <section className="toolbar" aria-label="Ledger filters">
        <div className="segmentedControl">
          <FilterLink active={!entryType} href={buildLedgerHref(undefined, 1)} label="All types" />
          {ledgerTypes.map((value) => (
            <FilterLink
              active={entryType === value}
              href={buildLedgerHref(value, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
      </section>
      {!entriesResult.ok ? (
        <EmptyState description={entriesResult.error} title="API Connection Blocked" />
      ) : (
        <section className="panel" aria-label="Ledger entries">
          <DataTable
            caption="Financial ledger entries"
            columns={columns}
            emptyDescription="Ledger entries matching the selected type will appear here."
            emptyTitle="No ledger entries found"
            rowKey={(entry) => entry.id}
            rows={entries}
          />
          <Pagination
            buildHref={(targetPage) => buildLedgerHref(entryType, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function buildLedgerHref(entryType: LedgerType | undefined, page: number): string {
  const params = new URLSearchParams();
  if (entryType) params.set('entryType', entryType);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/finance/ledger?${query}` : '/finance/ledger';
}

function parseLedgerType(value: string | undefined): LedgerType | undefined {
  return ledgerTypes.find((entryType) => entryType === value);
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

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
