import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadDispute, type Dispute, type DisputeStatus } from '../../../lib/marketplace-api';
import {
  addDisputeNoteAction,
  assignDisputeAction,
  closeDisputeAction,
  requestDisputeInfoAction,
  resolveDisputeAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DisputeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ disputeId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { disputeId } = await params;
  const resolved = (await searchParams) ?? {};
  const [result, session] = await Promise.all([loadDispute(disputeId), readPortalSession()]);
  if (!result.ok && result.error.toLowerCase().includes('not found')) {
    notFound();
  }
  const dispute = result.ok ? result.data : undefined;
  const canManage = session?.permissions.includes('disputes:manage') ?? false;
  const canResolve = session?.permissions.includes('disputes:resolve') ?? false;

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

  return (
    <BusinessShell
      active="disputes"
      eyebrow="Dispute resolution"
      statuses={statuses}
      title={dispute?.orderNumber ?? 'Dispute'}
    >
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/disputes">
          Back to disputes
        </Link>
      </div>

      {!result.ok || !dispute ? (
        <EmptyState
          description={result.ok ? 'Unknown error' : result.error}
          title="Dispute could not be loaded"
        />
      ) : (
        <>
          <section className="detailGrid">
            <article className="panel spanTwo">
              <div className="rowHeader">
                <div>
                  <p className="eyebrow">{dispute.id}</p>
                  <h3>Order {dispute.orderNumber}</h3>
                </div>
                <StatusBadge
                  label={labelFromCode(dispute.status)}
                  tone={statusTone(dispute.status)}
                />
              </div>
              <dl className="definitionGrid threeColumn">
                <DetailField label="Category" value={labelFromCode(dispute.category)} />
                <DetailField label="Seller" value={dispute.sellerName} />
                <DetailField label="Raised by" value={dispute.raisedByUserId} />
                <DetailField label="Raised by role" value={labelFromCode(dispute.raisedByRole)} />
                <DetailField label="Assigned to" value={dispute.assignedToUserId ?? 'Unassigned'} />
                <DetailField
                  label="Order status before dispute"
                  value={labelFromCode(dispute.orderStatusBeforeDispute)}
                />
                {dispute.returnRequestId ? (
                  <DetailField
                    label="Linked return"
                    value={
                      dispute.returnStatus
                        ? labelFromCode(dispute.returnStatus)
                        : dispute.returnRequestId
                    }
                  />
                ) : null}
              </dl>
              <div className="requirementList">
                <p>
                  <strong>Description:</strong> {dispute.description}
                </p>
                {dispute.resolutionNote ? (
                  <p>
                    <strong>Resolution:</strong> {dispute.resolutionNote}
                    {dispute.resolutionAmountPaise !== null
                      ? ` (${formatPaise(dispute.resolutionAmountPaise)})`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="rowHeader compact">
                <h3>Timeline</h3>
              </div>
              <DataTable<Dispute['events'][number]>
                caption="Dispute event timeline"
                columns={[
                  {
                    key: 'when',
                    header: 'When',
                    render: (event) => formatDateTime(event.createdAt),
                  },
                  {
                    key: 'event',
                    header: 'Event',
                    render: (event) => labelFromCode(event.eventType),
                  },
                  {
                    key: 'note',
                    header: 'Note',
                    render: (event) => event.note ?? '—',
                  },
                ]}
                emptyDescription="No events were returned for this dispute."
                emptyTitle="No dispute events"
                rowKey={(event) => event.id}
                rows={dispute.events}
              />
            </article>

            {canManage || canResolve ? (
              <DecisionPanel canManage={canManage} canResolve={canResolve} dispute={dispute} />
            ) : null}
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function DecisionPanel({
  dispute,
  canManage,
  canResolve,
}: {
  dispute: Dispute;
  canManage: boolean;
  canResolve: boolean;
}) {
  const active = ![
    'RESOLVED_FOR_FARMER',
    'RESOLVED_FOR_DISTRIBUTOR',
    'RESOLVED_SPLIT',
    'CLOSED',
  ].includes(dispute.status);
  const resolved = ['RESOLVED_FOR_FARMER', 'RESOLVED_FOR_DISTRIBUTOR', 'RESOLVED_SPLIT'].includes(
    dispute.status,
  );

  return (
    <article className="panel">
      <p className="eyebrow">Dispute workflow</p>
      <h3>Actions</h3>
      <div className="actionCluster">
        {canManage && active ? (
          <form action={assignDisputeAction} className="inlineForm">
            <input name="disputeId" type="hidden" value={dispute.id} />
            <label>
              Assign to (user ID)
              <input name="assignedToUserId" required type="text" />
            </label>
            <label>
              Note
              <input name="note" type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Assign this dispute to the entered user?">
              Assign
            </ConfirmSubmitButton>
          </form>
        ) : null}

        {(canManage || canResolve) && active ? (
          <form action={addDisputeNoteAction} className="inlineForm">
            <input name="disputeId" type="hidden" value={dispute.id} />
            <label>
              Add note
              <input name="note" required type="text" />
            </label>
            <ConfirmSubmitButton
              className="secondaryButton"
              confirmMessage="Add this note to the append-only dispute timeline?"
            >
              Add note
            </ConfirmSubmitButton>
          </form>
        ) : null}

        {canManage && active ? (
          <form action={requestDisputeInfoAction} className="inlineForm">
            <input name="disputeId" type="hidden" value={dispute.id} />
            <label>
              Request information from
              <select defaultValue="FARMER" name="target">
                <option value="FARMER">Farmer</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </label>
            <label>
              Note
              <input name="note" required type="text" />
            </label>
            <ConfirmSubmitButton
              className="secondaryButton"
              confirmMessage="Request this information from the selected dispute participant?"
            >
              Request info
            </ConfirmSubmitButton>
          </form>
        ) : null}

        {canResolve && active ? (
          <form action={resolveDisputeAction} className="inlineForm">
            <input name="disputeId" type="hidden" value={dispute.id} />
            <label>
              Outcome
              <select defaultValue="FARMER" name="outcome">
                <option value="FARMER">Farmer</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="SPLIT">Split</option>
              </select>
            </label>
            <label>
              Farmer award (paise, 0 if distributor outcome)
              <input min="0" name="resolutionAmountPaise" required step="1" type="number" />
            </label>
            <label>
              Resolution note
              <input minLength={3} name="resolutionNote" required type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Resolve this dispute? This records a farmer award and cannot be undone from here.">
              Resolve
            </ConfirmSubmitButton>
          </form>
        ) : null}

        {canResolve && resolved ? (
          <form action={closeDisputeAction} className="inlineForm">
            <input name="disputeId" type="hidden" value={dispute.id} />
            <label>
              Closing note
              <input name="note" required type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Close this resolved dispute with the entered note?">
              Close dispute
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function statusTone(status: DisputeStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'CLOSED' || status.startsWith('RESOLVED')) return 'ok';
  if (status === 'OPEN') return 'danger';
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
