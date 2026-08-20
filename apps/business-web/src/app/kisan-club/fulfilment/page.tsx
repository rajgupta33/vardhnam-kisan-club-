import Link from 'next/link';
import type { KisanClubFulfilmentStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadKisanClubFulfilmentAssignments } from '../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;
const limit = 25;
const statuses: KisanClubFulfilmentStatus[] = [
  'ASSIGNED',
  'PROMOTER_ACCEPTED',
  'PROMOTER_DECLINED',
  'PRODUCT_READY',
  'FARMER_CONTACTED',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'FAILED',
  'REASSIGNED',
  'CANCELLED',
];

export default async function ClubFulfilmentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const status = parseAllowed(readParam(params.status), statuses);
  const promoterUserId = readParam(params.promoterUserId)?.trim() || undefined;
  const membershipId = readParam(params.membershipId)?.trim() || undefined;
  const productOrderId = readParam(params.productOrderId)?.trim() || undefined;
  const page = positiveInteger(readParam(params.page), 1);
  const result = await loadKisanClubFulfilmentAssignments({
    ...(status ? { status } : {}),
    ...(promoterUserId ? { promoterUserId } : {}),
    ...(membershipId ? { membershipId } : {}),
    ...(productOrderId ? { productOrderId } : {}),
    page,
    limit,
  });
  const assignments = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <BusinessShell
      active="kisanFulfilment"
      eyebrow="Promoter coordination overlay"
      statuses={[
        {
          label: result.ok ? `${total} assignments` : 'Coordination API unavailable',
          tone: result.ok ? 'ok' : 'danger',
        },
      ]}
      title="Club Fulfilment"
    >
      <section className="panel">
        <p className="eyebrow">Commercial boundary</p>
        <p className="mutedText">
          This queue coordinates promoters. It does not change the distributor order, invoice,
          delivery assignment or seller-of-record lifecycle.
        </p>
      </section>
      <section className="toolbar" aria-label="Club fulfilment filters">
        <form className="filterForm" method="get">
          <label>
            Status
            <select defaultValue={status ?? ''} name="status">
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {labelFromCode(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Promoter UUID
            <input defaultValue={promoterUserId ?? ''} name="promoterUserId" />
          </label>
          <label>
            Member UUID
            <input defaultValue={membershipId ?? ''} name="membershipId" />
          </label>
          <label>
            Order UUID
            <input defaultValue={productOrderId ?? ''} name="productOrderId" />
          </label>
          <button className="queueAction" type="submit">
            Apply filters
          </button>
        </form>
      </section>
      {!result.ok ? (
        <EmptyState description={result.error} title="Unable to load Club fulfilment" />
      ) : assignments.length === 0 ? (
        <EmptyState
          description="Change the filters or wait for a confirmed Club order."
          title="No assignments match"
        />
      ) : (
        <section className="queueList" aria-label="Club fulfilment assignments">
          {assignments.map((assignment) => (
            <article className="queueCard" key={assignment.id}>
              <div className="queueCardMain">
                <div className="rowHeader">
                  <div>
                    <p className="eyebrow">{assignment.order.orderNumber}</p>
                    <h3>{assignment.member.fullName}</h3>
                    <p className="mutedText">
                      {assignment.member.memberNumber} ·{' '}
                      {assignment.promoterName ?? assignment.promoterUserId}
                    </p>
                  </div>
                  <StatusBadge
                    label={labelFromCode(assignment.status)}
                    tone={statusTone(assignment.status)}
                  />
                </div>
                <dl className="definitionGrid threeColumn">
                  <Detail label="Mode" value={labelFromCode(assignment.mode)} />
                  <Detail label="Seller" value={assignment.order.sellerNameSnapshot} />
                  <Detail label="Assigned" value={formatDateTime(assignment.assignedAt)} />
                  <Detail label="Order status" value={labelFromCode(assignment.order.status)} />
                  <Detail
                    label="Farmer payable"
                    value={formatPaise(assignment.order.farmerPayablePaise)}
                  />
                  <Detail
                    label="Club benefit"
                    value={formatPaise(assignment.order.clubBenefitPaise)}
                  />
                </dl>
              </div>
              <Link className="queueAction" href={`/kisan-club/fulfilment/${assignment.id}`}>
                Open
              </Link>
            </article>
          ))}
        </section>
      )}
      {result.ok ? (
        <Pagination
          buildHref={(targetPage) => pageHref(params, targetPage)}
          limit={limit}
          page={page}
          total={total}
        />
      ) : null}
    </BusinessShell>
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
function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function parseAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const key of ['status', 'promoterUserId', 'membershipId', 'productOrderId']) {
    const value = readParam(params[key]);
    if (value) query.set(key, value);
  }
  query.set('page', String(page));
  return `/kisan-club/fulfilment?${query.toString()}`;
}
