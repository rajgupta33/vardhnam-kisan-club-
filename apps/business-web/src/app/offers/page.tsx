import Link from 'next/link';
import type { DistributorOfferStatus, OfferQueueItem } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadOfferReviewQueue } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface OffersPageProps {
  searchParams?: Promise<SearchParams>;
}

const offerStatusValues: DistributorOfferStatus[] = [
  'SUBMITTED',
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'PAUSED',
  'ARCHIVED',
];
const limit = 25;

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseOfferStatus(readParam(resolvedSearchParams.status)) ?? 'SUBMITTED';
  const q = readParam(resolvedSearchParams.q);
  const page = parsePage(readParam(resolvedSearchParams.page));
  const offerQuery = {
    status,
    ...(q ? { q } : {}),
    page,
    limit,
  };
  const offerResult = await loadOfferReviewQueue(offerQuery);
  const items = offerResult.ok ? offerResult.data.items : [];
  const total = offerResult.ok ? offerResult.data.total : 0;
  const readyOffers = items.filter((item) => item.missingRequirements.length === 0).length;
  const totalAvailableQuantity = items.reduce((total, item) => total + item.availableQuantity, 0);
  const statuses = [
    {
      label: offerResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: offerResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: offerResult.ok ? `${items.length} offer items` : 'API not connected',
      tone: offerResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'No cart or checkout', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="offers"
      eyebrow="Offer reviewer"
      statuses={statuses}
      title="Distributor Offer Review Queue"
    >
      <section className="metricStrip" aria-label="Offer queue metrics">
        <article className="metricCard">
          <p className="metricValue">{items.length}</p>
          <p className="metricLabel">Offer records</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{readyOffers}</p>
          <p className="metricLabel">Ready for approval</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{totalAvailableQuantity}</p>
          <p className="metricLabel">Derived sellable units</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Offer filters">
        <div className="segmentedControl">
          {offerStatusValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildOffersHref(statusValue, q, 1)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          <input name="status" type="hidden" value={status} />
          <input defaultValue={q ?? ''} name="q" placeholder="Search offers" type="search" />
          <button className="primaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {!offerResult.ok ? (
        <EmptyState description={offerResult.error} title="Offer API Connection Blocked" />
      ) : (
        <section className="queueList" aria-label="Distributor offer review queue">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Offers</p>
              <h3>Distributor Offer Records</h3>
            </div>
          </div>
          {items.length === 0 ? (
            <EmptyState
              description="Submitted distributor offers will appear here."
              title="No distributor offers"
            />
          ) : (
            items.map((item) => <OfferQueueCard item={item} key={item.offer.id} />)
          )}
          <Pagination
            buildHref={(targetPage) => buildOffersHref(status, q, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function OfferQueueCard({ item }: { item: OfferQueueItem }) {
  const offer = item.offer;
  const ready = item.missingRequirements.length === 0;

  return (
    <article className="queueCard reviewCard">
      <div className="queueCardMain">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">
              {offer.distributorOrganisation?.displayName ?? 'Distributor'} /{' '}
              {offer.product.brand.name}
            </p>
            <h3>{offer.product.name}</h3>
          </div>
          <StatusBadge label={labelFromCode(offer.status)} tone={offerStatusTone(offer.status)} />
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Variant" value={offer.variant.variantName} />
          <DetailField label="Warehouse" value={offer.warehouse.name} />
          <DetailField label="Batch" value={offer.batch?.batchNumber} />
          <DetailField label="Price" value={formatPaise(offer.sellingPricePaise)} />
          <DetailField label="Available" value={String(item.availableQuantity)} />
          <DetailField label="Submitted" value={formatDateTime(offer.createdAt)} />
        </dl>
        <div className="requirementList">
          {ready ? (
            <StatusBadge label="Ready" tone="ok" />
          ) : (
            item.missingRequirements.map((requirement) => (
              <StatusBadge
                key={requirement}
                label={`Missing ${labelFromCode(requirement)}`}
                tone="warn"
              />
            ))
          )}
        </div>
      </div>
      <Link className="queueAction" href={`/offers/${offer.id}`}>
        Review
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

function buildOffersHref(
  status: DistributorOfferStatus,
  q: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams({ status });
  if (q) {
    params.set('q', q);
  }
  if (page > 1) {
    params.set('page', String(page));
  }

  return `/offers?${params.toString()}`;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function offerStatusTone(status: DistributorOfferStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'APPROVED') return 'ok';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'danger';
  return 'warn';
}

function formatPaise(value: number): string {
  return `${value.toLocaleString('en-IN')} paise`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOfferStatus(value: string | undefined): DistributorOfferStatus | undefined {
  return offerStatusValues.includes(value as DistributorOfferStatus)
    ? (value as DistributorOfferStatus)
    : undefined;
}
