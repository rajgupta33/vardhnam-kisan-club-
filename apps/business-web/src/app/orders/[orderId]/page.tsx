import Link from 'next/link';
import { notFound } from 'next/navigation';
import type {
  ProductDeliveryAssignmentStatus,
  ProductInvoiceDocument,
  ProductOrder,
  ProductOrderStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadFulfilmentInvoicePdf, loadFulfilmentOrderDetail } from '../../../lib/marketplace-api';
import {
  canIssuePickupCode,
  orderHandoffTtlSeconds,
  readOrderHandoffCredentials,
  type OrderHandoffCredentials,
} from '../../../lib/order-handoff';
import {
  acceptOrderAction,
  assignDeliveryAction,
  completeDeliveryAction,
  downloadInvoicePdfAction,
  generateInvoiceAction,
  issuePickupCodeAction,
  markOutForDeliveryAction,
  markReadyForPickupAction,
  markReadyToPackAction,
  packOrderAction,
  rejectOrderAction,
  requestInvoicePdfAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { orderId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const result = await loadFulfilmentOrderDetail(orderId);
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const handoffCredentials = await readOrderHandoffCredentials(orderId);

  if (!result.ok && result.error.includes('NOT_FOUND')) {
    notFound();
  }

  const order = result.ok ? result.data : undefined;
  const invoicePdfResult = order?.invoice ? await loadFulfilmentInvoicePdf(orderId) : undefined;
  const connectionError = result.ok ? undefined : result.error;
  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok && order?.invoice ? 'Invoice generated' : 'Invoice pending',
      tone: result.ok && order?.invoice ? ('ok' as const) : ('warn' as const),
    },
    {
      label: result.ok && order?.dispatch ? 'Ready for pickup' : 'Dispatch pending',
      tone: result.ok && order?.dispatch ? ('ok' as const) : ('warn' as const),
    },
    {
      label: result.ok && order?.deliveryAssignment ? 'Delivery assigned' : 'Delivery pending',
      tone: result.ok && order?.deliveryAssignment ? ('ok' as const) : ('warn' as const),
    },
    {
      label: result.ok ? 'Order API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="orders"
      eyebrow="Distributor fulfilment"
      statuses={statuses}
      title={order ? order.orderNumber : 'Fulfilment Order'}
    >
      {notice ? <div className="noticeBanner ok">{notice}</div> : null}
      {error ? <div className="noticeBanner danger">{error}</div> : null}

      {connectionError || !order ? (
        <EmptyState
          description={connectionError ?? 'Order was not loaded'}
          title="Fulfilment Order API Connection Blocked"
        />
      ) : (
        <>
          <div className="breadcrumbRow">
            <Link className="textLink" href="/orders">
              Back to orders
            </Link>
          </div>

          <section className="detailGrid">
            <article className="panel spanTwo">
              <div className="rowHeader">
                <div>
                  <p className="eyebrow">{order.sellerNameSnapshot}</p>
                  <h3>Order Summary</h3>
                </div>
                <StatusBadge label={labelFromCode(order.status)} tone={statusTone(order.status)} />
              </div>
              <dl className="definitionGrid threeColumn">
                <DetailField label="Order number" value={order.orderNumber} />
                <DetailField label="Pincode" value={order.serviceablePincode} />
                <DetailField label="Subtotal" value={formatPaise(order.subtotalPaise)} />
                <DetailField label="Seller GSTIN" value={order.sellerGstinSnapshot} />
                <DetailField label="Items" value={order.itemCount} />
                <DetailField label="Created" value={formatDateTime(order.createdAt)} />
              </dl>
            </article>

            <DecisionPanel order={order} />
          </section>

          <InvoicePanel
            document={invoicePdfResult?.ok ? invoicePdfResult.data : undefined}
            documentError={
              invoicePdfResult && !invoicePdfResult.ok ? invoicePdfResult.error : undefined
            }
            order={order}
          />
          <DispatchPanel order={order} />
          <PickupHandoffPanel credentials={handoffCredentials} order={order} />
          <DeliveryAssignmentPanel order={order} />

          <section className="panel" aria-label="Order items">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Items</p>
                <h3>Reserved Product Snapshots</h3>
              </div>
            </div>
            <DataTable<ProductOrder['items'][number]>
              caption="Reserved product snapshots for this order"
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  render: (item) => (
                    <>
                      {item.productNameSnapshot}
                      <br />
                      <span className="mutedText">{item.variantNameSnapshot}</span>
                    </>
                  ),
                },
                {
                  key: 'warehouse',
                  header: 'Warehouse',
                  render: (item) => item.warehouseNameSnapshot,
                },
                { key: 'quantity', header: 'Qty', render: (item) => item.quantity },
                {
                  key: 'unit-price',
                  header: 'Unit price',
                  render: (item) => formatPaise(item.unitPricePaise),
                },
                {
                  key: 'line-total',
                  header: 'Line total',
                  render: (item) => formatPaise(item.lineTotalPaise),
                },
                {
                  key: 'reservations',
                  header: 'Reservations',
                  render: (item) =>
                    item.reservations.length === 0
                      ? 'Not recorded'
                      : item.reservations
                          .map(
                            (reservation) => `${reservation.batchNumber}: ${reservation.quantity}`,
                          )
                          .join(', '),
                },
              ]}
              emptyDescription="The API returned no reserved product snapshots for this order."
              emptyTitle="No order items"
              rowKey={(item) => item.id}
              rows={order.items}
            />
          </section>

          <section className="panel" aria-label="Order status history">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Audit trail</p>
                <h3>Status History</h3>
              </div>
            </div>
            <DataTable<ProductOrder['statusHistory'][number]>
              caption="Order status transition history"
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
              emptyDescription="No state transitions were returned for this order."
              emptyTitle="No status history"
              rowKey={(history) => history.id}
              rows={order.statusHistory}
            />
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function DecisionPanel({ order }: { order: ProductOrder }) {
  const canDecide = order.status === 'CONFIRMED';
  const canMarkReadyToPack = order.status === 'DISTRIBUTOR_ACCEPTED';
  const canPack = order.status === 'READY_TO_PACK';
  const hasInvoice = Boolean(order.invoice);
  const hasDispatch = Boolean(order.dispatch);
  const hasDeliveryAssignment = Boolean(order.deliveryAssignment);
  const canGenerateInvoice = order.status === 'PACKED' && !hasInvoice;
  const canMarkReadyForPickup = order.status === 'PACKED' && hasInvoice && !hasDispatch;
  const canAssignDelivery = order.status === 'READY_FOR_PICKUP' && !hasDeliveryAssignment;
  const canMarkOutForDelivery =
    order.status === 'READY_FOR_PICKUP' &&
    order.deliveryAssignment?.status === 'ACCEPTED' &&
    Boolean(order.deliveryAssignment.pickupVerifiedAt);
  const canCompleteDelivery =
    order.status === 'OUT_FOR_DELIVERY' && order.deliveryAssignment?.status === 'OUT_FOR_DELIVERY';

  return (
    <article className="panel">
      <p className="eyebrow">Distributor action</p>
      <h3>Fulfilment Actions</h3>
      <p className="mutedText">
        Phase 4A accepts or rejects confirmed orders. Phase 4B moves accepted orders through ready
        to pack and packed. Phase 4C records the invoice snapshot. Phase 4D marks invoiced packed
        orders ready for pickup. Phase 4E assigns delivery and verifies the mock OTP on completion.
      </p>
      <div className="actionCluster">
        <form action={acceptOrderAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Acceptance reason
            <input
              disabled={!canDecide}
              name="reason"
              placeholder="Stock checked and ready"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Accept this order and reserve it for distributor fulfilment?"
            disabled={!canDecide}
          >
            Accept order
          </ConfirmSubmitButton>
        </form>
        <form action={rejectOrderAction} className="rejectForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Rejection reason
            <input
              disabled={!canDecide}
              name="reason"
              placeholder="Required before rejecting"
              required
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Reject this order with the entered reason?"
            disabled={!canDecide}
          >
            Reject order
          </ConfirmSubmitButton>
        </form>
        <form action={markReadyToPackAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Picking note
            <input
              disabled={!canMarkReadyToPack}
              name="reason"
              placeholder="Items picked and checked"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Mark this order ready to pack?"
            disabled={!canMarkReadyToPack}
          >
            Ready to pack
          </ConfirmSubmitButton>
        </form>
        <form action={packOrderAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Packing note
            <input
              disabled={!canPack}
              name="reason"
              placeholder="Packed for dispatch"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Confirm that this order has been packed?"
            disabled={!canPack}
          >
            Mark packed
          </ConfirmSubmitButton>
        </form>
        <form action={generateInvoiceAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Invoice note
            <input
              disabled={!canGenerateInvoice}
              name="reason"
              placeholder="Invoice checked against packed items"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Generate the immutable seller invoice snapshot for this packed order?"
            disabled={!canGenerateInvoice}
          >
            {hasInvoice ? 'Invoice generated' : 'Generate invoice'}
          </ConfirmSubmitButton>
        </form>
        <form action={markReadyForPickupAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Pickup note
            <input
              disabled={!canMarkReadyForPickup}
              name="reason"
              placeholder="Packages ready at warehouse"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Mark this invoiced order ready for pickup?"
            disabled={!canMarkReadyForPickup}
          >
            {hasDispatch ? 'Ready for pickup' : 'Mark ready for pickup'}
          </ConfirmSubmitButton>
        </form>
        <form action={assignDeliveryAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Delivery partner user ID
            <input
              disabled={!canAssignDelivery}
              name="deliveryPartnerUserId"
              placeholder="Delivery partner UUID"
              required
              type="text"
            />
          </label>
          <label>
            Assignment note
            <input
              disabled={!canAssignDelivery}
              name="reason"
              placeholder="Assigned to local route partner"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Assign this order to the entered delivery partner?"
            disabled={!canAssignDelivery}
          >
            {hasDeliveryAssignment ? 'Delivery assigned' : 'Assign delivery'}
          </ConfirmSubmitButton>
        </form>
        <form action={markOutForDeliveryAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Pickup handoff note
            <input
              disabled={!canMarkOutForDelivery}
              name="reason"
              placeholder="Partner collected packages"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Confirm pickup handoff and mark this order out for delivery?"
            disabled={!canMarkOutForDelivery}
          >
            Mark out for delivery
          </ConfirmSubmitButton>
        </form>
        <form action={completeDeliveryAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Farmer OTP
            <input
              disabled={!canCompleteDelivery}
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="otpCode"
              pattern="[0-9]{6}"
              placeholder="6 digit OTP"
              required
              type="text"
            />
          </label>
          <label>
            Proof note
            <input
              disabled={!canCompleteDelivery}
              name="proofNote"
              placeholder="Delivered to farmer"
              type="text"
            />
          </label>
          <ConfirmSubmitButton
            confirmMessage="Complete delivery using the entered farmer OTP and proof note?"
            disabled={!canCompleteDelivery}
          >
            Complete delivery
          </ConfirmSubmitButton>
        </form>
      </div>
    </article>
  );
}

function InvoicePanel({
  order,
  document,
  documentError,
}: {
  order: ProductOrder;
  document?: ProductInvoiceDocument | undefined;
  documentError?: string | undefined;
}) {
  if (!order.invoice) {
    return null;
  }

  const invoice = order.invoice;

  return (
    <section className="panel" aria-label="Product invoice">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">Invoice</p>
          <h3>{invoice.invoiceNumber}</h3>
        </div>
        <StatusBadge label={labelFromCode(invoice.status)} tone="ok" />
      </div>
      <dl className="definitionGrid threeColumn">
        <DetailField label="Farmer" value={invoice.farmerNameSnapshot} />
        <DetailField label="Seller legal name" value={invoice.sellerLegalNameSnapshot} />
        <DetailField label="Seller GSTIN" value={invoice.sellerGstinSnapshot} />
        <DetailField label="Subtotal" value={formatPaise(invoice.subtotalPaise)} />
        <DetailField label="Tax" value={formatPaise(invoice.taxPaise)} />
        <DetailField label="Total" value={formatPaise(invoice.totalPaise)} />
        <DetailField label="Items" value={invoice.itemCount} />
        <DetailField label="Generated" value={formatDateTime(invoice.generatedAt)} />
      </dl>
      <div className="actionCluster">
        {document?.status === 'AVAILABLE' ? (
          <form action={downloadInvoicePdfAction} className="inlineForm">
            <input name="orderId" type="hidden" value={order.id} />
            <p className="mutedText">A short-lived audited download URL is issued on click.</p>
            <button className="primaryButton" type="submit">
              Download invoice PDF
            </button>
          </form>
        ) : document?.status === 'QUEUED' || document?.status === 'PROCESSING' ? (
          <div>
            <p className="mutedText">
              PDF status: {labelFromCode(document.status)}. Refresh to check the worker result.
            </p>
            <Link className="secondaryButton" href={`/orders/${order.id}`}>
              Check PDF status
            </Link>
          </div>
        ) : (
          <form action={requestInvoicePdfAction} className="inlineForm">
            <input name="orderId" type="hidden" value={order.id} />
            <p className="mutedText">
              {document?.status === 'FAILED'
                ? 'PDF generation failed. Requesting it again safely requeues the same document.'
                : documentError?.includes('NOT_FOUND')
                  ? 'The invoice PDF has not been requested.'
                  : (documentError ?? 'The invoice PDF is not available yet.')}
            </p>
            <button className="primaryButton" type="submit">
              {document?.status === 'FAILED' ? 'Retry invoice PDF' : 'Prepare invoice PDF'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function DispatchPanel({ order }: { order: ProductOrder }) {
  if (!order.dispatch) {
    return null;
  }

  const dispatch = order.dispatch;

  return (
    <section className="panel" aria-label="Product dispatch">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">Dispatch</p>
          <h3>{dispatch.dispatchNumber}</h3>
        </div>
        <StatusBadge label={labelFromCode(dispatch.status)} tone="ok" />
      </div>
      <dl className="definitionGrid threeColumn">
        <DetailField label="Invoice" value={dispatch.invoiceNumberSnapshot} />
        <DetailField label="Seller" value={dispatch.sellerNameSnapshot} />
        <DetailField label="Pincode" value={dispatch.serviceablePincode} />
        <DetailField label="Warehouses" value={dispatch.warehouseSnapshot.length} />
        <DetailField label="Items" value={dispatch.itemsSnapshot.length} />
        <DetailField label="Ready at" value={formatDateTime(dispatch.readyAt)} />
        <DetailField label="Ready note" value={dispatch.readyForPickupReason} />
      </dl>
    </section>
  );
}

/**
 * The pickup code and the farmer OTP are both returned exactly once and stored
 * only as hashes, so neither can be re-read from the order. Without this panel
 * the delivery partner has no way to obtain the code their app asks for, which
 * strands every order at ready-for-pickup.
 */
function PickupHandoffPanel({
  order,
  credentials,
}: {
  order: ProductOrder;
  credentials: OrderHandoffCredentials;
}) {
  if (!order.dispatch) {
    return null;
  }

  const dispatch = order.dispatch;
  const assignment = order.deliveryAssignment;
  const pickupVerified = Boolean(assignment?.pickupVerifiedAt);
  const canIssue = canIssuePickupCode(order);

  return (
    <section className="panel" aria-label="Delivery handoff credentials">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">Delivery handoff</p>
          <h3>Pickup Code and Farmer OTP</h3>
        </div>
        <StatusBadge
          label={pickupVerified ? 'Pickup verified' : 'Pickup pending'}
          tone={pickupVerified ? 'ok' : 'warn'}
        />
      </div>

      {credentials.pickupCode ? (
        <div className="handoffCredential">
          <p className="eyebrow">Pickup code for the delivery partner</p>
          <code className="handoffCode">{credentials.pickupCode}</code>
          <p className="mutedText">
            The partner app accepts this under &ldquo;Enter pickup code&rdquo;. It disappears after{' '}
            {orderHandoffTtlSeconds / 60} minutes; issue it again below if it is lost.
          </p>
        </div>
      ) : null}

      {credentials.deliveryOtp ? (
        <div className="handoffCredential">
          <p className="eyebrow">Farmer delivery OTP</p>
          <code className="handoffCode">{credentials.deliveryOtp}</code>
          <p className="mutedText">
            Shown only while SMS is mocked. It is entered at delivery completion, not at pickup.
          </p>
        </div>
      ) : null}

      <dl className="definitionGrid threeColumn">
        <DetailField label="Order ID" value={order.id} />
        <DetailField label="Dispatch number" value={dispatch.dispatchNumber} />
        <DetailField label="Assignment number" value={assignment?.assignmentNumber} />
        <DetailField label="Delivery partner user" value={assignment?.deliveryPartnerUserId} />
        <DetailField
          label="Pickup code issued"
          value={formatDateTime(dispatch.packageQrIssuedAt)}
        />
        <DetailField label="Pickup verified" value={formatDateTime(assignment?.pickupVerifiedAt)} />
        <DetailField
          label="Pickup attempts"
          value={assignment?.pickupVerificationAttemptCount ?? 0}
        />
        <DetailField label="OTP expires" value={formatDateTime(assignment?.otpExpiresAt)} />
      </dl>

      <div className="actionCluster">
        <form action={issuePickupCodeAction} className="inlineForm">
          <input name="orderId" type="hidden" value={order.id} />
          <label>
            Label note
            <input
              disabled={!canIssue}
              name="reason"
              placeholder="Label printed for partner handoff"
              type="text"
            />
          </label>
          <p className="mutedText">
            {pickupVerified
              ? 'Pickup is already verified, so the code cannot be reissued.'
              : canIssue
                ? 'Issuing replaces any previous code for this dispatch.'
                : 'Available once the order and its dispatch are ready for pickup.'}
          </p>
          <ConfirmSubmitButton
            confirmMessage="Issue a new pickup code? Any previously issued code stops working."
            disabled={!canIssue}
          >
            {dispatch.packageQrIssuedAt ? 'Reissue pickup code' : 'Issue pickup code'}
          </ConfirmSubmitButton>
        </form>
      </div>
    </section>
  );
}

function DeliveryAssignmentPanel({ order }: { order: ProductOrder }) {
  if (!order.deliveryAssignment) {
    return null;
  }

  const assignment = order.deliveryAssignment;

  return (
    <section className="panel" aria-label="Delivery assignment">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">Delivery</p>
          <h3>{assignment.assignmentNumber}</h3>
        </div>
        <StatusBadge
          label={labelFromCode(assignment.status)}
          tone={deliveryStatusTone(assignment.status)}
        />
      </div>
      <dl className="definitionGrid threeColumn">
        <DetailField label="Partner user" value={assignment.deliveryPartnerUserId} />
        <DetailField label="Dispatch" value={assignment.dispatchNumberSnapshot} />
        <DetailField label="Invoice" value={assignment.invoiceNumberSnapshot} />
        <DetailField label="Pincode" value={assignment.serviceablePincode} />
        <DetailField label="OTP expires" value={formatDateTime(assignment.otpExpiresAt)} />
        <DetailField label="OTP attempts" value={assignment.otpAttemptCount} />
        <DetailField label="Assigned" value={formatDateTime(assignment.assignedAt)} />
        <DetailField label="Started" value={formatDateTime(assignment.startedAt)} />
        <DetailField label="Completed" value={formatDateTime(assignment.completedAt)} />
        <DetailField label="Proof note" value={assignment.deliveryProofNote} />
      </dl>
    </section>
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

function statusTone(status: ProductOrderStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'DISTRIBUTOR_REJECTED') {
    return 'danger';
  }
  if (status === 'CONFIRMED') {
    return 'warn';
  }
  return 'ok';
}

function deliveryStatusTone(status: ProductDeliveryAssignmentStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'DELIVERY_FAILED' || status === 'CANCELLED') {
    return 'danger';
  }
  if (status === 'ASSIGNED' || status === 'OUT_FOR_DELIVERY') {
    return 'warn';
  }
  return 'ok';
}

function formatPaise(value: number): string {
  const rupees = Math.trunc(value / 100);
  const paise = value % 100;
  return paise === 0
    ? `Rs ${rupees.toLocaleString('en-IN')}`
    : `Rs ${rupees.toLocaleString('en-IN')}.${paise.toString().padStart(2, '0')}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
