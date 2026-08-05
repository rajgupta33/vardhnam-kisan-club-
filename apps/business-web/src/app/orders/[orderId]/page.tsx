import Link from 'next/link';
import { notFound } from 'next/navigation';
import type {
  ProductDeliveryAssignmentStatus,
  ProductOrder,
  ProductOrderStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadFulfilmentOrderDetail } from '../../../lib/marketplace-api';
import {
  acceptOrderAction,
  assignDeliveryAction,
  completeDeliveryAction,
  generateInvoiceAction,
  markOutForDeliveryAction,
  markReadyForPickupAction,
  markReadyToPackAction,
  packOrderAction,
  rejectOrderAction,
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

  if (!result.ok && result.error.includes('NOT_FOUND')) {
    notFound();
  }

  const order = result.ok ? result.data : undefined;
  const connectionError = result.ok ? undefined : result.error;
  const statuses = [
    {
      label: result.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
        <section className="emptyState">
          <h3>Fulfilment Order API Connection Blocked</h3>
          <p className="mutedText">{connectionError ?? 'Order was not loaded'}</p>
        </section>
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
                <span className={`statusBadge ${statusTone(order.status)}`}>
                  {labelFromCode(order.status)}
                </span>
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

          <InvoicePanel order={order} />
          <DispatchPanel order={order} />
          <DeliveryAssignmentPanel order={order} />

          <section className="panel" aria-label="Order items">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Items</p>
                <h3>Reserved Product Snapshots</h3>
              </div>
            </div>
            <div className="tableShell">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Warehouse</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Line total</th>
                    <th>Reservations</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.productNameSnapshot}
                        <br />
                        <span className="mutedText">{item.variantNameSnapshot}</span>
                      </td>
                      <td>{item.warehouseNameSnapshot}</td>
                      <td>{item.quantity}</td>
                      <td>{formatPaise(item.unitPricePaise)}</td>
                      <td>{formatPaise(item.lineTotalPaise)}</td>
                      <td>
                        {item.reservations.length === 0
                          ? 'Not recorded'
                          : item.reservations
                              .map(
                                (reservation) =>
                                  `${reservation.batchNumber}: ${reservation.quantity}`,
                              )
                              .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" aria-label="Order status history">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Audit trail</p>
                <h3>Status History</h3>
              </div>
            </div>
            <div className="tableShell">
              <table>
                <thead>
                  <tr>
                    <th>Transition</th>
                    <th>Actor</th>
                    <th>Reason</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {order.statusHistory.map((history) => (
                    <tr key={history.id}>
                      <td>
                        {history.fromStatus ? labelFromCode(history.fromStatus) : 'Created'} to{' '}
                        {labelFromCode(history.toStatus)}
                      </td>
                      <td>{history.actorRole ? labelFromCode(history.actorRole) : 'System'}</td>
                      <td>{history.reason ?? 'Not recorded'}</td>
                      <td>{formatDateTime(history.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    order.status === 'READY_FOR_PICKUP' && order.deliveryAssignment?.status === 'ASSIGNED';
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
          <button className="primaryButton" disabled={!canDecide} type="submit">
            Accept order
          </button>
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
          <button className="dangerButton" disabled={!canDecide} type="submit">
            Reject order
          </button>
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
          <button className="primaryButton" disabled={!canMarkReadyToPack} type="submit">
            Ready to pack
          </button>
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
          <button className="primaryButton" disabled={!canPack} type="submit">
            Mark packed
          </button>
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
          <button className="primaryButton" disabled={!canGenerateInvoice} type="submit">
            {hasInvoice ? 'Invoice generated' : 'Generate invoice'}
          </button>
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
          <button className="primaryButton" disabled={!canMarkReadyForPickup} type="submit">
            {hasDispatch ? 'Ready for pickup' : 'Mark ready for pickup'}
          </button>
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
          <button className="primaryButton" disabled={!canAssignDelivery} type="submit">
            {hasDeliveryAssignment ? 'Delivery assigned' : 'Assign delivery'}
          </button>
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
          <button className="primaryButton" disabled={!canMarkOutForDelivery} type="submit">
            Mark out for delivery
          </button>
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
          <button className="primaryButton" disabled={!canCompleteDelivery} type="submit">
            Complete delivery
          </button>
        </form>
      </div>
    </article>
  );
}

function InvoicePanel({ order }: { order: ProductOrder }) {
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
        <span className="statusBadge ok">{labelFromCode(invoice.status)}</span>
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
        <span className="statusBadge ok">{labelFromCode(dispatch.status)}</span>
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
        <span className={`statusBadge ${deliveryStatusTone(assignment.status)}`}>
          {labelFromCode(assignment.status)}
        </span>
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
