import Link from 'next/link';
import type { Brand, CatalogueStatus, ProductQueueItem } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
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
const limit = 25;

export default async function CataloguePage({ searchParams }: CataloguePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseStatus(readParam(resolvedSearchParams.status)) ?? 'SUBMITTED';
  const q = readParam(resolvedSearchParams.q);
  const brandPage = parsePage(readParam(resolvedSearchParams.brandPage));
  const productPage = parsePage(readParam(resolvedSearchParams.productPage));
  const [brandResult, productResult] = await Promise.all([
    loadBrandReviewQueue({ status, page: brandPage, limit, ...(q ? { q } : {}) }),
    loadProductReviewQueue({ status, page: productPage, limit, ...(q ? { q } : {}) }),
  ]);
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const brands = brandResult.ok ? brandResult.data.items : [];
  const brandTotal = brandResult.ok ? brandResult.data.total : 0;
  const productItems = productResult.ok ? productResult.data.items : [];
  const productTotal = productResult.ok ? productResult.data.total : 0;
  const readyProducts = productItems.filter((item) => item.missingRequirements.length === 0).length;
  const connectionError = !brandResult.ok
    ? brandResult.error
    : !productResult.ok
      ? productResult.error
      : undefined;
  const statuses = [
    {
      label: brandResult.config.configured ? 'Authenticated session' : 'Session missing',
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
              href={buildCatalogueHref(statusValue, q, 1, 1)}
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
        <EmptyState description={connectionError} title="Catalogue API Connection Blocked" />
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
              <EmptyState
                description="Submitted company brand records will appear here."
                title="No brand records"
              />
            ) : (
              brands.map((brand) => <BrandQueueCard brand={brand} key={brand.id} />)
            )}
            <Pagination
              buildHref={(targetPage) => buildCatalogueHref(status, q, targetPage, productPage)}
              limit={limit}
              page={brandPage}
              total={brandTotal}
            />
          </section>

          <section className="queueList" aria-label="Product review queue">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Products</p>
                <h3>Master Product Review Queue</h3>
              </div>
            </div>
            {productItems.length === 0 ? (
              <EmptyState
                description="Submitted product master records will appear here."
                title="No product masters"
              />
            ) : (
              productItems.map((item) => <ProductQueueCard item={item} key={item.product.id} />)
            )}
            <Pagination
              buildHref={(targetPage) => buildCatalogueHref(status, q, brandPage, targetPage)}
              limit={limit}
              page={productPage}
              total={productTotal}
            />
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
          <StatusBadge
            label={labelFromCode(brand.status)}
            tone={catalogueStatusTone(brand.status)}
          />
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
          <StatusBadge
            label={labelFromCode(item.product.status)}
            tone={catalogueStatusTone(item.product.status)}
          />
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

function buildCatalogueHref(
  status: CatalogueStatus,
  q: string | undefined,
  brandPage: number,
  productPage: number,
): string {
  const params = new URLSearchParams({ status });
  if (q) {
    params.set('q', q);
  }
  if (brandPage > 1) {
    params.set('brandPage', String(brandPage));
  }
  if (productPage > 1) {
    params.set('productPage', String(productPage));
  }

  return `/catalogue?${params.toString()}`;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function catalogueStatusTone(status: CatalogueStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'APPROVED') return 'ok';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'danger';
  return 'warn';
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatus(value: string | undefined): CatalogueStatus | undefined {
  return statusFilterValues.includes(value as CatalogueStatus)
    ? (value as CatalogueStatus)
    : undefined;
}
