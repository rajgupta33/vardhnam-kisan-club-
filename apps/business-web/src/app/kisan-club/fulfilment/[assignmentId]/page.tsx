import Link from 'next/link';
import type {
  KisanClubFulfilmentAction,
  KisanClubFulfilmentAssignment,
  KisanClubFulfilmentStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../../components/confirm-submit-button';
import { EmptyState } from '../../../../components/empty-state';
import { StatusBadge } from '../../../../components/status-badge';
import { readPortalSession } from '../../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../../lib/format';
import { loadKisanClubFulfilmentAssignment } from '../../../../lib/marketplace-api';
import { reassignClubFulfilmentAction, transitionClubFulfilmentAction } from '../actions';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;
type ActionOption = { action: KisanClubFulfilmentAction; label: string; danger?: boolean };

const actionsByStatus: Record<KisanClubFulfilmentStatus, ActionOption[]> = {
  ASSIGNED: [
    { action: 'accept', label: 'Accept' },
    { action: 'decline', label: 'Decline', danger: true },
  ],
  PROMOTER_ACCEPTED: [
    { action: 'product-ready', label: 'Product ready' },
    { action: 'fail', label: 'Mark failed', danger: true },
  ],
  PROMOTER_DECLINED: [],
  PRODUCT_READY: [
    { action: 'farmer-contacted', label: 'Farmer contacted' },
    { action: 'ready-for-pickup', label: 'Ready for pickup' },
    { action: 'fail', label: 'Mark failed', danger: true },
  ],
  FARMER_CONTACTED: [
    { action: 'ready-for-pickup', label: 'Ready for pickup' },
    { action: 'out-for-delivery', label: 'Out for delivery' },
    { action: 'complete', label: 'Complete coordination' },
    { action: 'fail', label: 'Mark failed', danger: true },
  ],
  READY_FOR_PICKUP: [
    { action: 'out-for-delivery', label: 'Out for delivery' },
    { action: 'complete', label: 'Complete coordination' },
    { action: 'fail', label: 'Mark failed', danger: true },
  ],
  OUT_FOR_DELIVERY: [
    { action: 'complete', label: 'Complete coordination' },
    { action: 'fail', label: 'Mark failed', danger: true },
  ],
  COMPLETED: [],
  FAILED: [],
  REASSIGNED: [],
  CANCELLED: [],
};
const reassignable: readonly KisanClubFulfilmentStatus[] = [
  'ASSIGNED',
  'PROMOTER_ACCEPTED',
  'PROMOTER_DECLINED',
  'PRODUCT_READY',
  'FARMER_CONTACTED',
  'READY_FOR_PICKUP',
  'FAILED',
];
const cancellable: readonly KisanClubFulfilmentStatus[] = reassignable;

export default async function ClubFulfilmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { assignmentId } = await params;
  const query = (await searchParams) ?? {};
  const [result, session] = await Promise.all([
    loadKisanClubFulfilmentAssignment(assignmentId),
    readPortalSession(),
  ]);
  const permissions = new Set(session?.permissions ?? []);
  const canManage =
    permissions.has('kisan-club-fulfilment:manage:any') ||
    permissions.has('kisan-club-fulfilment:manage:own');
  const canManageAny = permissions.has('kisan-club-fulfilment:manage:any');
  return (
    <BusinessShell
      active="kisanFulfilment"
      eyebrow="Club coordination detail"
      statuses={[
        {
          label: result.ok ? labelFromCode(result.data.status) : 'Assignment unavailable',
          tone: result.ok ? statusTone(result.data.status) : 'danger',
        },
      ]}
      title={result.ok ? result.data.order.orderNumber : 'Club Fulfilment'}
    >
      {readParam(query.notice) ? (
        <p className="noticeBanner ok">{readParam(query.notice)}</p>
      ) : null}
      {readParam(query.error) ? (
        <p className="noticeBanner danger">{readParam(query.error)}</p>
      ) : null}
      {!result.ok ? (
        <EmptyState description={result.error} title="Unable to load assignment" />
      ) : (
        <AssignmentDetail
          assignment={result.data}
          canManage={canManage}
          canManageAny={canManageAny}
        />
      )}
    </BusinessShell>
  );
}

function AssignmentDetail({
  assignment,
  canManage,
  canManageAny,
}: {
  assignment: KisanClubFulfilmentAssignment;
  canManage: boolean;
  canManageAny: boolean;
}) {
  const options = canManage ? actionsByStatus[assignment.status] : [];
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{assignment.member.memberNumber}</p>
            <h3>{assignment.member.fullName}</h3>
            <p className="mutedText">
              Promoter: {assignment.promoterName ?? assignment.promoterUserId}
            </p>
          </div>
          <StatusBadge
            label={labelFromCode(assignment.status)}
            tone={statusTone(assignment.status)}
          />
        </div>
        <dl className="definitionGrid threeColumn">
          <Detail label="Coordination mode" value={labelFromCode(assignment.mode)} />
          <Detail label="Assigned" value={formatDateTime(assignment.assignedAt)} />
          <Detail label="Accepted" value={formatDateTime(assignment.acceptedAt)} />
          <Detail label="Completed" value={formatDateTime(assignment.completedAt)} />
          <Detail
            label="Member location"
            value={[
              assignment.member.village,
              assignment.member.district,
              assignment.member.state,
              assignment.member.pincode,
            ]
              .filter(Boolean)
              .join(', ')}
          />
          <Detail label="Failure reason" value={assignment.failureReason ?? 'Not applicable'} />
        </dl>
      </section>
      <section className="panel">
        <p className="eyebrow">Separate seller order</p>
        <div className="rowHeader">
          <h3>{assignment.order.orderNumber}</h3>
          <StatusBadge label={labelFromCode(assignment.order.status)} tone="warn" />
        </div>
        <dl className="definitionGrid threeColumn">
          <Detail label="Seller of record" value={assignment.order.sellerNameSnapshot} />
          <Detail label="Subtotal" value={formatPaise(assignment.order.subtotalPaise)} />
          <Detail label="Club benefit" value={formatPaise(assignment.order.clubBenefitPaise)} />
          <Detail label="Farmer payable" value={formatPaise(assignment.order.farmerPayablePaise)} />
          <Detail label="Pincode" value={assignment.order.serviceablePincode} />
          <div>
            <dt>Product order</dt>
            <dd>
              <Link className="textLink" href={`/orders/${assignment.productOrderId}`}>
                Open legal fulfilment record
              </Link>
            </dd>
          </div>
        </dl>
        <p className="mutedText">
          Coordination completion is not proof of product delivery and does not mutate this order.
        </p>
      </section>
      {options.length > 0 ? (
        <section className="panel">
          <p className="eyebrow">Allowed next coordination steps</p>
          <div className="decisionGrid">
            {options.map((option) => (
              <TransitionForm assignmentId={assignment.id} key={option.action} option={option} />
            ))}
          </div>
        </section>
      ) : null}
      {canManageAny && cancellable.includes(assignment.status) ? (
        <TransitionForm
          assignmentId={assignment.id}
          option={{ action: 'cancel', label: 'Cancel coordination', danger: true }}
        />
      ) : null}
      {canManageAny && reassignable.includes(assignment.status) ? (
        <form action={reassignClubFulfilmentAction} className="panel rejectForm">
          <div>
            <p className="eyebrow">Operations override</p>
            <h3>Reassign promoter</h3>
          </div>
          <input name="assignmentId" type="hidden" value={assignment.id} />
          <label>
            New promoter user UUID
            <input name="promoterUserId" required />
          </label>
          <label>
            Reason
            <input maxLength={500} minLength={3} name="reason" required />
          </label>
          <p className="mutedText">
            The backend requires a different active, Club-enabled promoter with an active
            organisation membership and preserves both reassignment history entries.
          </p>
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Reassign this coordination record to the entered promoter? The existing history will be preserved."
          >
            Reassign coordination
          </ConfirmSubmitButton>
        </form>
      ) : null}
      <section className="panel">
        <h3>Status history</h3>
        {assignment.statusHistory.length > 0 ? (
          <div className="timeline">
            {assignment.statusHistory.map((entry) => (
              <article className="timelineItem" key={entry.id}>
                <span className="timelineDot" />
                <div>
                  <div className="rowHeader">
                    <strong>{labelFromCode(entry.toStatus)}</strong>
                    <span className="mutedText">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p>{entry.reason ?? 'No reason recorded'}</p>
                  <p className="mutedText">
                    {entry.changedByRole ? labelFromCode(entry.changedByRole) : 'System'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No coordination transitions were returned for this assignment."
            title="No status history"
          />
        )}
      </section>
      <Link className="textLink" href="/kisan-club/fulfilment">
        Back to Club fulfilment
      </Link>
    </>
  );
}

function TransitionForm({ assignmentId, option }: { assignmentId: string; option: ActionOption }) {
  return (
    <form action={transitionClubFulfilmentAction} className="panel rejectForm">
      <input name="assignmentId" type="hidden" value={assignmentId} />
      <input name="action" type="hidden" value={option.action} />
      <label>
        Reason
        <input maxLength={500} minLength={3} name="reason" required />
      </label>
      <ConfirmSubmitButton
        className={option.danger ? 'dangerButton' : 'primaryButton'}
        confirmMessage={`Confirm “${option.label}” for this Club coordination assignment?`}
      >
        {option.label}
      </ConfirmSubmitButton>
    </form>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function formatPaise(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}
function statusTone(status: KisanClubFulfilmentStatus): 'ok' | 'warn' | 'danger' {
  return status === 'COMPLETED'
    ? 'ok'
    : status === 'FAILED' || status === 'CANCELLED' || status === 'PROMOTER_DECLINED'
      ? 'danger'
      : 'warn';
}
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
