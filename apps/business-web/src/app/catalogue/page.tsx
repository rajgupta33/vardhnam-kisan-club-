import Link from 'next/link';
import type { Brand, CatalogueStatus, ProductQueueItem } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadBrandReviewQueue, loadProductReviewQueue } from '../../lib/marketplace-api';
import { reviewBrandAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface CataloguePageProps {
  searchParams?: Promise<SearchParams>;
}

const statusFilterValues: CatalogueStatus[] = [
  'SUBMITTED',
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
];

export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseStatus(readParam(resolvedSearchParams.status)) ?? 'SUBMITTED';
  const q = readParam(resolvedSearchParams.q);
  const catalogueQuery = {
    status,
    page: 1,
    limit: 25,
    ...(q ? { q } : {}),
  };
  const [brandResult, productResult] = await Promise.all([
    loadBrandReviewQueue(catalogueQuery),
    loadProductReviewQueue(catalogueQuery),
  ]);
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const brands = brandResult.ok ? brandResult.data.items : [];
  const productItems = productResult.ok ? productResult.data.items : [];
  const readyProducts = productItems.filter((item) => item.missingRequirements.length === 0).length;
  const connectionError = !brandResult.ok
    ? brandResult.error
    : !productResult.ok
      ? productResult.error
      : undefined;
  const statuses = [
    {
      label: brandResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
      tone: brandResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: productResult.ok ? `${productItems.length} product items` : 'API not connected',
      tone: productResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'No checkout in scope', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="catalogue"
      eyebrow="Catalogue reviewer"
      statuses={statuses}
      title="Catalogue Review Queue"
    >
      {notice ? <p className="noticeBanner ok">{notice}</p> : null}
      {error ? <p className="noticeBanner danger">{error}</p> : null}

      <section className="metricStrip" aria-label="Catalogue queue metrics">
        <article className="metricCard">
          <p className="metricValue">{brands.length}</p>
          <p className="metricLabel">Brand records</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{productItems.length}</p>
          <p className="metricLabel">Product masters</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{readyProducts}</p>
          <p className="metricLabel">Products ready for approval</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Catalogue filters">
        <div className="segmentedControl">
          {statusFilterValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildCatalogueHref(statusValue, q)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          <input name="status" type="hidden" value={status} />
          <input defaultValue={q ?? ''} name="q" placeholder="Search catalogue" type="search" />
          <button className="primaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {connectionError ? (
        <section className="emptyState">
          <h3>Catalogue API Connection Blocked</h3>
          <p className="mutedText">{connectionError}</p>
        </section>
      ) : (
        <>
          <section className="queueList" aria-label="Brand review queue">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Brands</p>
                <h3>Brand Review Queue</h3>
              </div>
            </div>
            {brands.length === 0 ? (
              <article className="emptyState">
                <h3>No brand records</h3>
                <p className="mutedText">Submitted company brand records will appear here.</p>
              </article>
            ) : (
              brands.map((brand) => <BrandQueueCard brand={brand} key={brand.id} />)
            )}
          </section>

          <section className="queueList" aria-label="Product review queue">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Products</p>
                <h3>Master Product Review Queue</h3>
              </div>
            </div>
            {productItems.length === 0 ? (
              <article className="emptyState">
                <h3>No product masters</h3>
                <p className="mutedText">Submitted product master records will appear here.</p>
              </article>
            ) : (
              productItems.map((item) => <ProductQueueCard item={item} key={item.product.id} />)
            )}
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function BrandQueueCard({ brand }: { brand: Brand }) {
  return (
    <article className="queueCard reviewCard">
      <div className="queueCardMain">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{brand.companyOrganisation?.displayName ?? 'Company'}</p>
            <h3>{brand.name}</h3>
          </div>
          <span className={`statusBadge ${brand.status === 'APPROVED' ? 'ok' : 'warn'}`}>
            {labelFromCode(brand.status)}
          </span>
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Slug" value={brand.slug} />
          <DetailField label="Submitted" value={formatDateTime(brand.createdAt)} />
          <DetailField label="Reason" value={brand.reviewReason} />
        </dl>
      </div>
      <div className="actionCluster">
        <BrandReviewForm brand={brand} decision="APPROVE" />
        <BrandRejectForm brand={brand} />
      </div>
    </article>
  );
}

function ProductQueueCard({ item }: { item: ProductQueueItem }) {
  return (
    <article className="queueCard reviewCard">
      <div className="queueCardMain">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{item.product.brand.name}</p>
            <h3>{item.product.name}</h3>
          </div>
          <span className={`statusBadge ${item.product.status === 'APPROVED' ? 'ok' : 'warn'}`}>
            {labelFromCode(item.product.status)}
          </span>
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Company" value={item.product.companyOrganisation?.displayName} />
          <DetailField label="Category" value={item.product.category} />
          <DetailField
            label="Metadata"
            value={`${item.activeVariantCount} variants / ${item.documentCount} documents`}
          />
        </dl>
        <div className="requirementList">
          {item.missingRequirements.length === 0 ? (
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
      <Link className="queueAction" href={`/catalogue/products/${item.product.id}`}>
        Review
      </Link>
    </article>
  );
}

function BrandReviewForm({ brand, decision }: { brand: Brand; decision: 'APPROVE' }) {
  return (
    <form action={reviewBrandAction} className="inlineForm">
      <input name="brandId" type="hidden" value={brand.id} />
      <input name="decision" type="hidden" value={decision} />
      <input name="reason" type="hidden" value="Brand metadata verified." />
      <button className="queueAction" disabled={brand.status !== 'SUBMITTED'} type="submit">
        Approve
      </button>
    </form>
  );
}

function BrandRejectForm({ brand }: { brand: Brand }) {
  return (
    <form action={reviewBrandAction} className="rejectForm">
      <input name="brandId" type="hidden" value={brand.id} />
      <input name="decision" type="hidden" value="REJECT" />
      <input
        aria-label={`${brand.name} rejection reason`}
        maxLength={500}
        minLength={3}
        name="reason"
        placeholder="Rejection reason"
        required
      />
      <button className="dangerButton" disabled={brand.status !== 'SUBMITTED'} type="submit">
        Reject
      </button>
    </form>
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

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && value.length > 0 ? value : 'Not recorded'}</dd>
    </div>
  );
}

function buildCatalogueHref(status: CatalogueStatus, q: string | undefined): string {
  const params = new URLSearchParams({ status });
  if (q) {
    params.set('q', q);
  }

  return `/catalogue?${params.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): CatalogueStatus | undefined {
  return statusFilterValues.includes(value as CatalogueStatus)
    ? (value as CatalogueStatus)
    : undefined;
}
