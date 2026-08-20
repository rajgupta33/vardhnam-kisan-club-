import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../../components/business-shell';
import { DataTable } from '../../../../components/data-table';
import { EmptyState } from '../../../../components/empty-state';
import { StatusBadge } from '../../../../components/status-badge';
import { formatDateTime, formatPaise, labelFromCode } from '../../../../lib/format';
import { loadSettlementDetail, type CommissionEntry } from '../../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface SettlementDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function SettlementDetailPage({
  params,
  searchParams,
}: SettlementDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const result = await loadSettlementDetail(id);
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);

  if (!result.ok && result.error.includes('NOT_FOUND')) {
    notFound();
  }

  const settlement = result.ok ? result.data : undefined;
  const connectionError = result.ok ? undefined : result.error;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Finance API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="finance"
      eyebrow="Marketplace finance"
      statuses={statuses}
      title={settlement ? settlement.settlementNumber || settlement.id : 'Settlement Detail'}
    >
      {notice ? <div className="noticeBanner ok">{notice}</div> : null}
      {error ? <div className="noticeBanner danger">{error}</div> : null}

      {connectionError || !settlement ? (
        <EmptyState
          description={connectionError ?? 'Settlement was not loaded'}
          title="API Connection Blocked"
        />
      ) : (
        <>
          <div className="breadcrumbRow">
            <Link className="textLink" href="/finance/settlements">
              Back to settlements
            </Link>
          </div>

          <section className="detailGrid">
            <article className="panel spanTwo">
              <div className="rowHeader">
                <div>
                  <p className="eyebrow">{settlement.sellerOrganisationId}</p>
                  <h3>Settlement Summary</h3>
                </div>
                <StatusBadge
                  label={labelFromCode(settlement.status)}
                  tone={statusTone(settlement.status)}
                />
              </div>
              <dl className="definitionGrid threeColumn">
                <DetailField label="Amount" value={formatPaise(settlement.totalPayablePaise)} />
                <DetailField label="Commission entries" value={settlement.entryCount} />
                <DetailField label="Created At" value={formatDateTime(settlement.createdAt)} />
              </dl>
            </article>
          </section>

          <section className="panel" aria-label="Settlement commission entries">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Immutable source entries</p>
                <h3>Distributor Payables</h3>
              </div>
            </div>
            <DataTable<CommissionEntry>
              caption="Commission entries included in this settlement"
              columns={[
                {
                  key: 'order',
                  header: 'Order',
                  render: (entry) => entry.productOrderId,
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (entry) => labelFromCode(entry.entryType),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (entry) => formatPaise(entry.amountPaise),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (entry) => (
                    <StatusBadge
                      label={labelFromCode(entry.status)}
                      tone={commissionEntryStatusTone(entry.status)}
                    />
                  ),
                },
                {
                  key: 'created',
                  header: 'Created',
                  render: (entry) => formatDateTime(entry.createdAt),
                },
              ]}
              emptyDescription="No immutable commission entries were returned for this settlement."
              emptyTitle="No commission entries"
              rowKey={(entry) => entry.id}
              rows={settlement.commissionEntries}
            />
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const printable =
    value === undefined || value === null || value === '' ? 'Not recorded' : String(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd>{printable}</dd>
    </div>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'ELIGIBLE') return 'ok';
  return 'warn';
}

function commissionEntryStatusTone(status: CommissionEntry['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'FINAL') return 'ok';
  if (status === 'REVERSED') return 'danger';
  return 'warn';
}
