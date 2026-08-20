import Link from 'next/link';
import type {
  CreditNote,
  ReturnInspectionOutcome,
  ReturnRequest,
  ReturnRequestStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadCreditNote, loadReturnRequestDetail } from '../../../lib/marketplace-api';
import {
  approveReturnAction,
  assignReturnPickupAction,
  confirmRefundAction,
  createRefundAction,
  downloadCreditNoteAction,
  inspectReturnAction,
  pickupReturnAction,
  receiveReturnAction,
  rejectReturnAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ returnRequestId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { returnRequestId } = await params;
  const query = (await searchParams) ?? {};
  const result = await loadReturnRequestDetail(returnRequestId);
  const session = await readPortalSession();
  const permissions = new Set(session?.permissions ?? []);
  const successfulRefund = result.ok
    ? result.data.refunds.find((refund) => refund.status === 'SUCCEEDED')
    : undefined;
  const creditNoteResult = successfulRefund ? await loadCreditNote(successfulRefund.id) : undefined;

  return (
    <BusinessShell
      active="returns"
      eyebrow="Reverse logistics"
      statuses={[
        {
          label: result.ok ? 'Return loaded' : 'Return unavailable',
          tone: result.ok ? 'ok' : 'danger',
        },
      ]}
      title={result.ok ? result.data.orderNumber : 'Return Request'}
    >
      {readParam(query.notice) ? <p className="noticeBanner">{readParam(query.notice)}</p> : null}
      {readParam(query.error) ? <p className="errorBanner">{readParam(query.error)}</p> : null}
      {!result.ok ? (
        <EmptyState description={result.error} title="Unable to load return" />
      ) : (
        <ReturnDetail
          canManage={
            permissions.has('returns:manage:any') || permissions.has('returns:manage:seller-own')
          }
          canPickup={permissions.has('returns:manage:any')}
          canAssignPickup={permissions.has('return-pickups:manage:any')}
          canCreateRefund={permissions.has('refunds:create:any')}
          canConfirmRefund={permissions.has('refunds:confirm:mock')}
          creditNote={creditNoteResult?.ok ? creditNoteResult.data : undefined}
          creditNoteError={
            creditNoteResult && !creditNoteResult.ok ? creditNoteResult.error : undefined
          }
          request={result.data}
        />
      )}
    </BusinessShell>
  );
}

function ReturnDetail({
  request,
  canManage,
  canPickup,
  canAssignPickup,
  canCreateRefund,
  canConfirmRefund,
  creditNote,
  creditNoteError,
}: {
  request: ReturnRequest;
  canManage: boolean;
  canPickup: boolean;
  canAssignPickup: boolean;
  canCreateRefund: boolean;
  canConfirmRefund: boolean;
  creditNote?: CreditNote | undefined;
  creditNoteError?: string | undefined;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{request.sellerName}</p>
            <h3>{request.orderNumber}</h3>
          </div>
          <StatusBadge
            label={labelFromCode(request.status)}
            tone={returnStatusTone(request.status)}
          />
        </div>
        <dl className="definitionGrid threeColumn">
          <Detail label="Reason" value={labelFromCode(request.reasonCode)} />
          <Detail label="Reason details" value={request.reasonNote} />
          <Detail label="Return amount" value={formatPaise(request.refundableAmountPaise)} />
          <Detail label="Requested" value={formatDateTime(request.requestedAt)} />
          <Detail label="Window expired" value={formatDateTime(request.windowExpiresAt)} />
          <div>
            <dt>Seller order</dt>
            <dd>
              <Link className="textLink" href={`/orders/${request.productOrderId}`}>
                Open order
              </Link>
            </dd>
          </div>
        </dl>
      </section>
      <ReturnActions
        request={request}
        canManage={canManage}
        canPickup={canPickup}
        canAssignPickup={canAssignPickup}
        canCreateRefund={canCreateRefund}
        canConfirmRefund={canConfirmRefund}
      />
      <section className="panel">
        <h3>Return Items</h3>
        <DataTable<ReturnRequest['items'][number]>
          caption="Items included in this return request"
          columns={[
            {
              key: 'product',
              header: 'Product',
              render: (item) => (
                <>
                  {item.productName}
                  <br />
                  <span className="mutedText">{item.variantName}</span>
                </>
              ),
            },
            { key: 'quantity', header: 'Quantity', render: (item) => item.quantity },
            {
              key: 'unit-price',
              header: 'Unit price',
              render: (item) => formatPaise(item.unitPricePaise),
            },
            {
              key: 'amount',
              header: 'Amount',
              render: (item) => formatPaise(item.lineRefundPaise),
            },
          ]}
          emptyDescription="The API returned no items for this return request."
          emptyTitle="No return items"
          rowKey={(item) => item.id}
          rows={request.items}
        />
      </section>
      <section className="panel">
        <h3>Inspection Dispositions</h3>
        <DataTable<ReturnRequest['inspectionDispositions'][number]>
          caption="Batch-level inspection dispositions"
          columns={[
            { key: 'batch', header: 'Batch', render: (row) => row.batchNumber },
            {
              key: 'outcome',
              header: 'Outcome',
              render: (row) => labelFromCode(row.outcome),
            },
            { key: 'quantity', header: 'Quantity', render: (row) => row.quantity },
            {
              key: 'stock-delta',
              header: 'Stock delta',
              render: (row) => row.quantityDelta ?? 'No stock change',
            },
            {
              key: 'balance-after',
              header: 'Balance after',
              render: (row) => row.balanceAfter ?? 'Not applicable',
            },
          ]}
          emptyDescription="Batch-level outcomes appear after the return has been inspected."
          emptyTitle="No inspection dispositions"
          rowKey={(row) => row.id}
          rows={request.inspectionDispositions}
        />
      </section>
      {request.refunds.length > 0 ? (
        <section className="panel">
          <h3>Refund</h3>
          {request.refunds.map((refund) => (
            <div key={refund.id}>
              <dl className="definitionGrid threeColumn">
                <Detail label="Status" value={labelFromCode(refund.status)} />
                <Detail label="Amount" value={formatPaise(refund.amountPaise)} />
                <Detail label="Method" value={labelFromCode(refund.method)} />
                <Detail
                  label="Provider"
                  value={`${labelFromCode(refund.providerMode)} (development)`}
                />
                <Detail label="Provider reference" value={refund.providerRefundReference} />
                <Detail label="Failure reason" value={refund.failureReason} />
              </dl>
              {refund.status === 'SUCCEEDED' ? (
                <CreditNotePanel
                  creditNote={creditNote?.refundId === refund.id ? creditNote : undefined}
                  error={creditNoteError}
                  refundId={refund.id}
                  returnRequestId={request.id}
                />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      <section className="panel">
        <h3>Status History</h3>
        <DataTable<ReturnRequest['statusHistory'][number]>
          caption="Return request status history"
          columns={[
            {
              key: 'transition',
              header: 'Transition',
              render: (history) => (
                <>
                  {history.fromStatus ? labelFromCode(history.fromStatus) : 'Created'} to{' '}
                  {labelFromCode(history.toStatus)}
                </>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (history) =>
                history.actorRole ? labelFromCode(history.actorRole) : 'System',
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (history) => history.reason ?? 'Not recorded',
            },
            {
              key: 'recorded',
              header: 'Recorded',
              render: (history) => formatDateTime(history.createdAt),
            },
          ]}
          emptyDescription="No state transitions were returned for this return request."
          emptyTitle="No status history"
          rowKey={(history) => history.id}
          rows={request.statusHistory}
        />
      </section>
    </>
  );
}

function CreditNotePanel({
  creditNote,
  error,
  refundId,
  returnRequestId,
}: {
  creditNote?: CreditNote | undefined;
  error?: string | undefined;
  refundId: string;
  returnRequestId: string;
}) {
  if (!creditNote) {
    return (
      <div className="noticeBanner warn">
        Credit note is not available yet. {error ? `API: ${error}` : 'Refresh to check again.'}
      </div>
    );
  }

  return (
    <div className="subPanel">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">GST credit note</p>
          <h4>{creditNote.creditNoteNumber}</h4>
        </div>
        <StatusBadge
          label={creditNote.document ? labelFromCode(creditNote.document.status) : 'PDF pending'}
          tone={creditNote.document?.status === 'AVAILABLE' ? 'ok' : 'warn'}
        />
      </div>
      <dl className="definitionGrid threeColumn">
        <Detail label="Original invoice" value={creditNote.originalInvoiceNumber} />
        <Detail label="Gross credit" value={formatPaise(creditNote.grossCreditPaise)} />
        <Detail label="Farmer refund" value={formatPaise(creditNote.farmerRefundPaise)} />
        <Detail label="Tax credited" value={formatPaise(creditNote.taxPaise)} />
        <Detail label="Subsidy reversal" value={formatPaise(creditNote.subsidyReversalPaise)} />
        <Detail label="Issued" value={formatDateTime(creditNote.issuedAt)} />
      </dl>
      {creditNote.document?.status === 'AVAILABLE' ? (
        <form action={downloadCreditNoteAction} className="inlineForm">
          <input name="returnRequestId" type="hidden" value={returnRequestId} />
          <input name="refundId" type="hidden" value={refundId} />
          <p className="mutedText">A short-lived audited download URL is issued on click.</p>
          <button className="primaryButton" type="submit">
            Download credit note PDF
          </button>
        </form>
      ) : (
        <div>
          <p className="mutedText">
            {creditNote.document?.status === 'FAILED'
              ? 'PDF generation failed. The existing maintenance sweep will safely retry it.'
              : 'The document worker is preparing this PDF.'}
          </p>
          <Link className="secondaryButton" href={`/returns/${returnRequestId}`}>
            Check credit note status
          </Link>
        </div>
      )}
    </div>
  );
}

function ReturnActions({
  request,
  canManage,
  canPickup,
  canAssignPickup,
  canCreateRefund,
  canConfirmRefund,
}: {
  request: ReturnRequest;
  canManage: boolean;
  canPickup: boolean;
  canAssignPickup: boolean;
  canCreateRefund: boolean;
  canConfirmRefund: boolean;
}) {
  const canDecide = canManage && request.status === 'REQUESTED';
  const canRecordPickup = canPickup && request.status === 'APPROVED';
  const canAssign =
    canAssignPickup &&
    request.status === 'APPROVED' &&
    (!request.pickupAssignment || request.pickupAssignment.status === 'REJECTED');
  const canReceive = canManage && request.status === 'IN_TRANSIT';
  const canInspect = canManage && request.status === 'RECEIVED';
  const refund = request.refunds[0];
  const mayCreateRefund = canCreateRefund && request.status === 'INSPECTED' && !refund;
  const mayConfirmRefund =
    canConfirmRefund &&
    refund?.providerMode === 'MOCK' &&
    ['PENDING', 'FAILED'].includes(refund.status);
  return (
    <section className="panel">
      <p className="eyebrow">Authorised actions</p>
      <h3>Return Workflow</h3>
      <p className="mutedText">
        Receiving goods records them for inspection only. It does not make inventory sellable.
      </p>
      <div className="actionCluster">
        <ActionForm
          action={approveReturnAction}
          confirmMessage="Approve this return request?"
          disabled={!canDecide}
          id={request.id}
          label="Approve return"
          placeholder="Approval note"
        />
        <ActionForm
          action={rejectReturnAction}
          confirmMessage="Reject this return request with the entered reason?"
          disabled={!canDecide}
          id={request.id}
          label="Reject return"
          placeholder="Rejection reason (required)"
          required
          danger
        />
        <form action={assignReturnPickupAction} className="inlineForm">
          <input name="returnRequestId" type="hidden" value={request.id} />
          <label>
            Online delivery partner user ID
            <input disabled={!canAssign} name="deliveryPartnerUserId" required type="text" />
          </label>
          <label>
            Assignment reason
            <input disabled={!canAssign} name="reason" type="text" />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Assign this return pickup to the entered delivery partner?"
            disabled={!canAssign}
          >
            {request.pickupAssignment?.status === 'REJECTED'
              ? 'Reassign return pickup'
              : 'Assign return pickup'}
          </ConfirmSubmitButton>
        </form>
        {request.pickupAssignment ? (
          <p className="mutedText">
            Pickup {request.pickupAssignment.assignmentNumber}:{' '}
            {labelFromCode(request.pickupAssignment.status)}
          </p>
        ) : null}
        <ActionForm
          action={pickupReturnAction}
          confirmMessage="Record the legacy operations pickup for this return?"
          disabled={!canRecordPickup || Boolean(request.pickupAssignment)}
          id={request.id}
          label="Legacy operations pickup"
          placeholder="Available only when no partner assignment exists"
        />
        <ActionForm
          action={receiveReturnAction}
          confirmMessage="Record this return as received for inspection?"
          disabled={!canReceive}
          id={request.id}
          label="Receive for inspection"
          placeholder="Receiving note"
        />
      </div>
      <InspectionForm disabled={!canInspect} request={request} />
      <div className="actionCluster">
        <form action={createRefundAction} className="inlineForm">
          <input name="returnRequestId" type="hidden" value={request.id} />
          <p className="mutedText">Amount is taken from the backend inspection decision.</p>
          <ConfirmSubmitButton
            confirmMessage="Initiate the backend-calculated refund for this inspected return?"
            disabled={!mayCreateRefund}
          >
            Initiate refund
          </ConfirmSubmitButton>
        </form>
        {refund ? (
          <form action={confirmRefundAction} className="inlineForm">
            <input name="returnRequestId" type="hidden" value={request.id} />
            <input name="refundId" type="hidden" value={refund.id} />
            <p className="mutedText">Development provider only; no real money is moved.</p>
            <ConfirmSubmitButton
              confirmMessage="Complete this development-only mock refund?"
              disabled={!mayConfirmRefund}
            >
              Complete mock refund
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function InspectionForm({ disabled, request }: { disabled: boolean; request: ReturnRequest }) {
  return (
    <form action={inspectReturnAction} className="inspectionForm">
      <input name="returnRequestId" type="hidden" value={request.id} />
      <h4>Batch inspection allocation</h4>
      <p className="mutedText">
        Allocate every returned unit to its original batch. Only Restockable increases sellable
        stock. Enter zero for unused outcomes.
      </p>
      {request.items.map((item) => (
        <fieldset disabled={disabled} key={item.id}>
          <legend>
            {item.productName} — {item.variantName} (return quantity {item.quantity})
          </legend>
          {item.reservations.map((reservation) => (
            <div className="inspectionBatch" key={reservation.id}>
              <strong>Batch {reservation.batchNumber}</strong>{' '}
              <span className="mutedText">originally reserved {reservation.quantity}</span>
              <div className="definitionGrid fourColumn">
                {inspectionOutcomes.map((outcome) => (
                  <label key={outcome}>
                    {labelFromCode(outcome)}
                    <input
                      defaultValue="0"
                      max={reservation.quantity}
                      min="0"
                      name={`disposition:${item.id}:${reservation.id}:${outcome}`}
                      step="1"
                      type="number"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      <label>
        Inspection note
        <textarea
          disabled={disabled}
          maxLength={1000}
          minLength={3}
          name="inspectionNote"
          required
        />
      </label>
      <ConfirmSubmitButton
        confirmMessage="Record these batch inspection dispositions? Only restockable quantities will increase sellable stock."
        disabled={disabled}
      >
        Record inspection
      </ConfirmSubmitButton>
    </form>
  );
}

const inspectionOutcomes: ReturnInspectionOutcome[] = [
  'RESTOCKABLE',
  'DAMAGED_WRITE_OFF',
  'QUARANTINED',
  'REJECTED_RETURN',
];

function ActionForm({
  action,
  confirmMessage,
  disabled,
  id,
  label,
  placeholder,
  required = false,
  danger = false,
}: {
  action: (data: FormData) => Promise<void>;
  confirmMessage: string;
  disabled: boolean;
  id: string;
  label: string;
  placeholder: string;
  required?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={action} className="inlineForm">
      <input name="returnRequestId" type="hidden" value={id} />
      <label>
        {placeholder}
        <input
          disabled={disabled}
          name="reason"
          placeholder={placeholder}
          required={required}
          type="text"
        />
      </label>
      <ConfirmSubmitButton
        className={danger ? 'dangerButton' : 'primaryButton'}
        confirmMessage={confirmMessage}
        disabled={disabled}
      >
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
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
function returnStatusTone(status: ReturnRequestStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'COMPLETED') return 'ok';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  return 'warn';
}
function formatPaise(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}
