import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadTallySyncRecord,
  type TallySyncAttempt,
  type TallySyncStatus,
} from '../../../lib/marketplace-api';
import { attemptTallySyncAction } from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TallySyncRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const resolved = (await searchParams) ?? {};
  const [result, session] = await Promise.all([loadTallySyncRecord(id), readPortalSession()]);
  if (!result.ok && result.error.toLowerCase().includes('not found')) {
    notFound();
  }
  const record = result.ok ? result.data : undefined;
  const canManage = session?.permissions.includes('tally-sync:manage') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Tally API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell active="tally" eyebrow="Tally sync" statuses={statuses} title="Sync Record">
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/tally">
          Back to Tally
        </Link>
      </div>

      {!result.ok || !record ? (
        <EmptyState
          description={result.ok ? 'Unknown error' : result.error}
          title="Record could not be loaded"
        />
      ) : (
        <section className="detailGrid">
          <article className="panel spanTwo">
            <div className="rowHeader">
              <div>
                <p className="eyebrow">{labelFromCode(record.recordType)}</p>
                <h3>{record.referenceLabelSnapshot}</h3>
              </div>
              <StatusBadge label={labelFromCode(record.status)} tone={statusTone(record.status)} />
            </div>
            <dl className="definitionGrid threeColumn">
              <DetailField
                label="Reference number"
                value={record.referenceNumberSnapshot ?? 'Not recorded'}
              />
              <DetailField
                label="Amount"
                value={
                  record.amountPaise === null ? 'Not recorded' : formatPaise(record.amountPaise)
                }
              />
              <DetailField
                label="Tally reference"
                value={record.tallyReferenceId ?? 'Not synced'}
              />
              <DetailField label="Attempts" value={String(record.attemptCount)} />
              <DetailField label="Last attempt" value={formatDateTime(record.lastAttemptAt)} />
              <DetailField label="Created" value={formatDateTime(record.createdAt)} />
              {record.lastErrorMessage ? (
                <DetailField label="Last error" value={record.lastErrorMessage} />
              ) : null}
            </dl>

            <DataTable<TallySyncAttempt>
              caption="Tally sync attempt history"
              columns={[
                {
                  key: 'attempt',
                  header: 'Attempt',
                  render: (attempt) => attempt.attemptNumber,
                },
                {
                  key: 'outcome',
                  header: 'Outcome',
                  render: (attempt) => (
                    <StatusBadge
                      label={labelFromCode(attempt.outcome)}
                      tone={statusTone(attempt.outcome)}
                    />
                  ),
                },
                {
                  key: 'error',
                  header: 'Error',
                  render: (attempt) => attempt.errorMessage ?? '—',
                },
                {
                  key: 'when',
                  header: 'When',
                  render: (attempt) => formatDateTime(attempt.createdAt),
                },
              ]}
              emptyDescription="No sync attempts have been recorded for this item."
              emptyTitle="No sync attempts"
              rowKey={(attempt) => attempt.id}
              rows={record.attempts ?? []}
            />
          </article>

          {canManage ? (
            <article className="panel">
              <p className="eyebrow">Sync outcome</p>
              <h3>Confirm Attempt</h3>
              <form action={attemptTallySyncAction} className="decisionForm">
                <input name="recordId" type="hidden" value={record.id} />
                <label>
                  Outcome
                  <select defaultValue="SYNCED" name="outcome" required>
                    <option value="SYNCED">Synced</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </label>
                <label>
                  Tally reference ID
                  <input name="tallyReferenceId" type="text" />
                </label>
                <label>
                  Error code
                  <input name="errorCode" type="text" />
                </label>
                <label>
                  Error message
                  <input name="errorMessage" type="text" />
                </label>
                <label>
                  Reason
                  <input name="reason" type="text" />
                </label>
                <ConfirmSubmitButton confirmMessage="Record this manual Tally sync outcome? This will update the reconciliation history.">
                  Record attempt
                </ConfirmSubmitButton>
              </form>
            </article>
          ) : null}
        </section>
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
