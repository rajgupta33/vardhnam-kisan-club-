import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { readPortalSession } from '../../../lib/auth-session';
import { loadSupportTicketDetail, type SupportTicket } from '../../../lib/marketplace-api';
import {
  assignTicketAction,
  closeTicketAction,
  escalateTicketAction,
  markWaitingAction,
  reopenTicketAction,
  resolveTicketAction,
  resumeTicketAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [result, session] = await Promise.all([loadSupportTicketDetail(id), readPortalSession()]);
  if (!result.ok && result.error.includes('not found')) {
    notFound();
  }
  const ticket = result.ok ? result.data : undefined;
  const canManage = session?.permissions.includes('support-tickets:manage') ?? false;
  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Support API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="support"
      eyebrow="Marketplace support"
      statuses={statuses}
      title={ticket?.subject ?? 'Ticket Detail'}
    >
      {readParam(resolvedSearchParams.notice) ? (
        <div className="noticeBanner ok">{readParam(resolvedSearchParams.notice)}</div>
      ) : null}
      {readParam(resolvedSearchParams.error) ? (
        <div className="noticeBanner danger">{readParam(resolvedSearchParams.error)}</div>
      ) : null}
      {!result.ok || !ticket ? (
        <EmptyState
          description={result.ok ? 'Unknown error' : result.error}
          title="Ticket could not be loaded"
        />
      ) : (
        <>
          <div className="breadcrumbRow">
            <Link className="textLink" href="/support">
              Back to tickets
            </Link>
          </div>
          <section className="detailGrid">
            <article className="panel spanTwo">
              <div className="rowHeader">
                <div>
                  <p className="eyebrow">{ticket.id}</p>
                  <h3>Ticket Information</h3>
                </div>
                <StatusBadge
                  label={labelFromCode(ticket.status)}
                  tone={statusTone(ticket.status)}
                />
              </div>
              <dl className="definitionGrid threeColumn">
                <DetailField label="Category" value={labelFromCode(ticket.category)} />
                <DetailField label="Priority" value={labelFromCode(ticket.priority)} />
                <DetailField label="Raised by" value={ticket.raisedByUserId} />
                <DetailField label="Organisation" value={ticket.raiserOrganisationId} />
                <DetailField label="Assigned to" value={ticket.assignedToUserId} />
                <DetailField label="Related order" value={ticket.productOrderId} />
                <DetailField label="SLA due" value={formatDateTime(ticket.slaDueAt)} />
                <DetailField label="Created" value={formatDateTime(ticket.createdAt)} />
                <DetailField label="Updated" value={formatDateTime(ticket.updatedAt)} />
              </dl>
              <div className="requirementList">
                <p>
                  <strong>Description:</strong> {ticket.description}
                </p>
                {ticket.resolutionNote ? (
                  <p>
                    <strong>Resolution:</strong> {ticket.resolutionNote}
                  </p>
                ) : null}
              </div>
            </article>
            {canManage ? <DecisionPanel ticket={ticket} /> : null}
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function DecisionPanel({ ticket }: { ticket: SupportTicket }) {
  const waiting =
    ticket.status === 'WAITING_FOR_CUSTOMER' || ticket.status === 'WAITING_FOR_SELLER';
  return (
    <article className="panel">
      <p className="eyebrow">Support workflow</p>
      <h3>Ticket Actions</h3>
      <div className="actionCluster">
        {['OPEN', 'ESCALATED', 'REOPENED'].includes(ticket.status) ? (
          <form action={assignTicketAction} className="inlineForm">
            <input name="ticketId" type="hidden" value={ticket.id} />
            <label>
              Support agent user ID
              <input name="assignedToUserId" required type="text" />
            </label>
            <label>
              Reason
              <input name="reason" type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Assign this support ticket to the entered user?">
              Assign
            </ConfirmSubmitButton>
          </form>
        ) : null}
        {ticket.status === 'ASSIGNED' ? (
          <form action={markWaitingAction} className="inlineForm">
            <input name="ticketId" type="hidden" value={ticket.id} />
            <label>
              Waiting for
              <select name="status" required>
                <option value="WAITING_FOR_CUSTOMER">Customer</option>
                <option value="WAITING_FOR_SELLER">Seller</option>
              </select>
            </label>
            <label>
              Reason
              <input name="reason" type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Move this support ticket into the selected waiting state?">
              Mark waiting
            </ConfirmSubmitButton>
          </form>
        ) : null}
        {waiting ? (
          <ReasonAction
            action={resumeTicketAction}
            button="Resume"
            confirmMessage="Resume work on this support ticket?"
            ticketId={ticket.id}
          />
        ) : null}
        {ticket.status === 'ASSIGNED' || waiting ? (
          <ReasonAction
            action={escalateTicketAction}
            button="Escalate"
            confirmMessage="Escalate this support ticket?"
            danger
            ticketId={ticket.id}
          />
        ) : null}
        {ticket.status === 'ASSIGNED' || ticket.status === 'ESCALATED' || waiting ? (
          <form action={resolveTicketAction} className="inlineForm">
            <input name="ticketId" type="hidden" value={ticket.id} />
            <label>
              Resolution note
              <input minLength={3} name="resolutionNote" required type="text" />
            </label>
            <ConfirmSubmitButton confirmMessage="Resolve this support ticket with the entered resolution note?">
              Resolve
            </ConfirmSubmitButton>
          </form>
        ) : null}
        {ticket.status === 'RESOLVED' ? (
          <ReasonAction
            action={closeTicketAction}
            button="Close"
            confirmMessage="Close this resolved support ticket?"
            ticketId={ticket.id}
          />
        ) : null}
        {ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? (
          <ReasonAction
            action={reopenTicketAction}
            button="Reopen"
            confirmMessage="Reopen this support ticket?"
            ticketId={ticket.id}
          />
        ) : null}
      </div>
    </article>
  );
}

function ReasonAction({
  action,
  button,
  confirmMessage,
  danger = false,
  ticketId,
}: {
  action: (formData: FormData) => Promise<void>;
  button: string;
  confirmMessage: string;
  danger?: boolean;
  ticketId: string;
}) {
  return (
    <form action={action} className="inlineForm">
      <input name="ticketId" type="hidden" value={ticketId} />
      <label>
        Reason
        <input name="reason" type="text" />
      </label>
      <ConfirmSubmitButton
        className={danger ? 'dangerButton' : 'primaryButton'}
        confirmMessage={confirmMessage}
      >
        {button}
      </ConfirmSubmitButton>
    </form>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || 'Not recorded'}</dd>
    </div>
  );
}
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'ok';
  if (status === 'ESCALATED' || status === 'REOPENED') return 'danger';
  return 'warn';
}
