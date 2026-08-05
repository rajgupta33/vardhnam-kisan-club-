import Link from 'next/link';
import type { ProductOrder, ProductOrderStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadFulfilmentOrders } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface OrdersPageProps {
  searchParams?: Promise<SearchParams>;
}

const fulfilmentStatusValues: ProductOrderStatus[] = [
  'CONFIRMED',
  'DISTRIBUTOR_ACCEPTED',
  'DISTRIBUTOR_REJECTED',
  'READY_TO_PACK',
  'PACKED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseOrderStatus(readParam(resolvedSearchParams.status)) ?? 'CONFIRMED';
  const q = readParam(resolvedSearchParams.q);
  const orderResult = await loadFulfilmentOrders({
    status,
    ...(q ? { q } : {}),
    page: 1,
    limit: 25,
  });
  const orders = orderResult.ok ? orderResult.data.items : [];
  const totalItems = orders.reduce((total, order) => total + order.itemCount, 0);
  const totalValuePaise = orders.reduce((total, order) => total + order.subtotalPaise, 0);
  const actionReadyOrders = orders.filter((order) =>
    [
      'CONFIRMED',
      'DISTRIBUTOR_ACCEPTED',
      'READY_TO_PACK',
      'PACKED',
      'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
    ].includes(order.status),
  ).length;
  const statuses = [
    {
      label: orderResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
      tone: orderResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: orderResult.ok ? `${orders.length} order rows` : 'API not connected',
      tone: orderResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Delivery assignment ready', tone: 'ok' as const },
  ];

  return (
    <BusinessShell
      active="orders"
      eyebrow="Distributor fulfilment"
      statuses={statuses}
      title="Product Order Dashboard"
    >
      <section className="metricStrip" aria-label="Fulfilment order metrics">
        <article className="metricCard">
          <p className="metricValue">{orders.length}</p>
          <p className="metricLabel">Orders in view</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{actionReadyOrders}</p>
          <p className="metricLabel">Awaiting seller action</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{formatPaise(totalValuePaise)}</p>
          <p className="metricLabel">{totalItems} order items</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Fulfilment order filters">
        <div className="segmentedControl">
          {fulfilmentStatusValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildOrdersHref(statusValue, q)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          <input name="status" type="hidden" value={status} />
          <input
            defaultValue={q ?? ''}
            name="q"
            placeholder="Search order or pincode"
            type="search"
          />
          <button className="primaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {!orderResult.ok ? (
        <section className="emptyState">
          <h3>Fulfilment API Connection Blocked</h3>
          <p className="mutedText">{orderResult.error}</p>
        </section>
      ) : (
        <section className="queueList" aria-label="Distributor fulfilment order queue">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Product orders</p>
              <h3>Distributor Seller Records</h3>
            </div>
          </div>
          {orders.length === 0 ? (
            <article className="emptyState">
              <h3>No product orders</h3>
              <p className="mutedText">
                Confirmed child orders will appear here after mock payment.
              </p>
            </article>
          ) : (
            orders.map((order) => <OrderQueueCard key={order.id} order={order} />)
          )}
        </section>
      )}
    </BusinessShell>
  );
}

function OrderQueueCard({ order }: { order: ProductOrder }) {
  return (
    <article className="queueCard reviewCard">
      <div className="queueCardMain">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{order.sellerNameSnapshot}</p>
            <h3>{order.orderNumber}</h3>
          </div>
          <span className={`statusBadge ${statusTone(order.status)}`}>
            {labelFromCode(order.status)}
          </span>
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Pincode" value={order.serviceablePincode} />
          <DetailField label="Items" value={order.itemCount} />
          <DetailField label="Subtotal" value={formatPaise(order.subtotalPaise)} />
          <DetailField label="Created" value={formatDateTime(order.createdAt)} />
          <DetailField label="Seller GSTIN" value={order.sellerGstinSnapshot} />
          <DetailField label="Latest action" value={latestStatusReason(order)} />
        </dl>
      </div>
      <Link className="queueAction" href={`/orders/${order.id}`}>
        Manage
      </Link>
    </article>
  );
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

function latestStatusReason(order: ProductOrder): string {
  const latest = order.statusHistory.at(-1);
  return latest?.reason ?? 'Not recorded';
}

function buildOrdersHref(status: ProductOrderStatus, q: string | undefined): string {
  const params = new URLSearchParams({ status });
  if (q) {
    params.set('q', q);
  }

  return `/orders?${params.toString()}`;
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

function parseOrderStatus(value: string | undefined): ProductOrderStatus | undefined {
  return fulfilmentStatusValues.includes(value as ProductOrderStatus)
    ? (value as ProductOrderStatus)
    : undefined;
}
