import Link from 'next/link';
import type { DistributorOfferStatus, OfferQueueItem } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
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

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseOfferStatus(readParam(resolvedSearchParams.status)) ?? 'SUBMITTED';
  const q = readParam(resolvedSearchParams.q);
  const offerQuery = {
    status,
    ...(q ? { q } : {}),
    page: 1,
    limit: 25,
  };
  const offerResult = await loadOfferReviewQueue(offerQuery);
  const items = offerResult.ok ? offerResult.data.items : [];
  const readyOffers = items.filter((item) => item.missingRequirements.length === 0).length;
  const totalAvailableQuantity = items.reduce((total, item) => total + item.availableQuantity, 0);
  const statuses = [
    {
      label: offerResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
              href={buildOffersHref(statusValue, q)}
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
        <section className="emptyState">
          <h3>Offer API Connection Blocked</h3>
          <p className="mutedText">{offerResult.error}</p>
        </section>
      ) : (
        <section className="queueList" aria-label="Distributor offer review queue">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Offers</p>
              <h3>Distributor Offer Records</h3>
            </div>
          </div>
          {items.length === 0 ? (
            <article className="emptyState">
              <h3>No distributor offers</h3>
              <p className="mutedText">Submitted distributor offers will appear here.</p>
            </article>
          ) : (
            items.map((item) => <OfferQueueCard item={item} key={item.offer.id} />)
          )}
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
          <span className={`statusBadge ${offer.status === 'APPROVED' ? 'ok' : 'warn'}`}>
            {labelFromCode(offer.status)}
          </span>
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
            <span className="statusBadge ok">Ready</span>
          ) : (
            item.missingRequirements.map((requirement) => (
              <span className="statusBadge warn" key={requirement}>
                Missing {labelFromCode(requirement)}
              </span>
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

function buildOffersHref(status: DistributorOfferStatus, q: string | undefined): string {
  const params = new URLSearchParams({ status });
  if (q) {
    params.set('q', q);
  }

  return `/offers?${params.toString()}`;
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
