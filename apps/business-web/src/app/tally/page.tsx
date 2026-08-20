import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import {
  loadTallyReconciliation,
  loadTallySyncRecords,
  type TallyReconciliationRow,
  type TallySyncRecord,
  type TallySyncRecordType,
  type TallySyncStatus,
} from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const statusValues: TallySyncStatus[] = ['PENDING', 'SYNCED', 'FAILED'];
const recordTypeValues: TallySyncRecordType[] = [
  'PARTY_MASTER',
  'ITEM_MASTER',
  'INVOICE',
  'SETTLEMENT',
  'COMMISSION_INVOICE',
  'CREDIT_NOTE',
  'RECEIPT',
  'VOUCHER',
];
const limit = 25;

export default async function TallyPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const status = parseEnum(readParam(resolved.status), statusValues);
  const recordType = parseEnum(readParam(resolved.recordType), recordTypeValues);
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const [recordsResult, reconciliationResult] = await Promise.all([
    loadTallySyncRecords({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(recordType ? { recordType } : {}),
    }),
    loadTallyReconciliation(),
  ]);

  const statuses = [
    {
      label: recordsResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: recordsResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: recordsResult.ok ? 'Tally API connected' : 'API not connected',
      tone: recordsResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<TallySyncRecord>[] = [
    { key: 'type', header: 'Type', render: (row) => labelFromCode(row.recordType) },
    { key: 'reference', header: 'Reference', render: (row) => row.referenceLabelSnapshot },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (row.amountPaise === null ? '—' : formatPaise(row.amountPaise)),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />
      ),
    },
    { key: 'attempts', header: 'Attempts', render: (row) => String(row.attemptCount) },
    { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Link className="textLink" href={`/tally/${row.id}`}>
          Detail
        </Link>
      ),
    },
  ];

  return (
    <BusinessShell
      active="tally"
      eyebrow="Tally sync"
      statuses={statuses}
      title="Tally Reconciliation"
    >
      {!reconciliationResult.ok ? (
        <EmptyState
          description={reconciliationResult.error}
          title="Reconciliation summary is unavailable"
        />
      ) : (
        <section className="panel" aria-label="Reconciliation summary">
          <DataTable<TallyReconciliationRow>
            caption="Tally reconciliation summary"
            columns={[
              {
                key: 'record-type',
                header: 'Record type',
                render: (row) => labelFromCode(row.recordType),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />
                ),
              },
              { key: 'count', header: 'Count', render: (row) => row.count },
              {
                key: 'total-amount',
                header: 'Total amount',
                render: (row) => formatPaise(row.totalAmountPaise),
              },
              {
                key: 'oldest-unsynced',
                header: 'Oldest unsynced',
                render: (row) =>
                  row.oldestUnsyncedAgeHours === null ? '—' : `${row.oldestUnsyncedAgeHours}h`,
              },
            ]}
            emptyDescription="No Tally reconciliation aggregates are available."
            emptyTitle="No reconciliation data"
            rowKey={(row) => `${row.recordType}-${row.status}`}
            rows={reconciliationResult.data}
          />
        </section>
      )}

      <section className="toolbar" aria-label="Sync record filters">
        <div className="segmentedControl">
          <FilterLink
            active={!status}
            href={buildHref(undefined, recordType, 1)}
            label="All statuses"
          />
          {statusValues.map((value) => (
            <FilterLink
              active={status === value}
              href={buildHref(value, recordType, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <div className="segmentedControl">
          <FilterLink
            active={!recordType}
            href={buildHref(status, undefined, 1)}
            label="All types"
          />
          {recordTypeValues.map((value) => (
            <FilterLink
              active={recordType === value}
              href={buildHref(status, value, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
      </section>

      {!recordsResult.ok ? (
        <EmptyState description={recordsResult.error} title="Sync records are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Tally sync records"
            columns={columns}
            emptyDescription="No sync records match this filter."
            emptyTitle="No sync records"
            rowKey={(row) => row.id}
            rows={recordsResult.data.items}
          />
          <Pagination
            buildHref={(target) => buildHref(status, recordType, target)}
            limit={limit}
            page={recordsResult.data.page}
            total={recordsResult.data.total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function statusTone(status: TallySyncStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'SYNCED') return 'ok';
  if (status === 'FAILED') return 'danger';
  return 'warn';
}

function formatPaise(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(value / 100);
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

function buildHref(
  status: TallySyncStatus | undefined,
  recordType: TallySyncRecordType | undefined,
  page: number,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);
  if (recordType) params.set('recordType', recordType);
  return `/tally?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}
