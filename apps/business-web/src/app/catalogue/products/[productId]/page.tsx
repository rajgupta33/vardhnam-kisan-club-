import Link from 'next/link';
import type {
  AuditLog,
  CatalogueStatus,
  ProductDetail,
  ProductDocument,
  ProductVariant,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../../components/data-table';
import { EmptyState } from '../../../../components/empty-state';
import { Pagination } from '../../../../components/pagination';
import { StatusBadge } from '../../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../../lib/format';
import { loadAuditLogs, loadProductDetail } from '../../../../lib/marketplace-api';
import { reviewProductAction } from '../../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const auditLimit = 10;

interface ProductDetailPageProps {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { productId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const auditPage = parsePage(readParam(resolvedSearchParams.auditPage));
  const productResult = await loadProductDetail(productId);
  const auditResult = productResult.ok
    ? await loadAuditLogs({
        organisationId: productResult.data.companyOrganisationId,
        page: auditPage,
        limit: auditLimit,
      })
    : undefined;
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const auditEntries = auditResult?.ok ? auditResult.data.items : [];
  const auditTotal = auditResult?.ok ? auditResult.data.total : 0;
  const auditColumns: DataTableColumn<AuditLog>[] = [
    { key: 'time', header: 'Time', render: (entry) => formatDateTime(entry.createdAt) },
    { key: 'action', header: 'Action', render: (entry) => labelFromCode(entry.action) },
    { key: 'resource', header: 'Resource', render: (entry) => entry.resourceType },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
  ];
  const statuses = [
    {
      label: productResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: productResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: productResult.ok ? 'Product detail loaded' : 'API not connected',
      tone: productResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'No inventory in scope', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="catalogue"
      eyebrow="Catalogue detail"
      statuses={statuses}
      title={productResult.ok ? productResult.data.name : 'Product Master'}
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/catalogue">
          Back to catalogue queue
        </Link>
        {productResult.ok ? (
          <Link
            className="textLink"
            href={`/audit?organisationId=${productResult.data.companyOrganisationId}`}
          >
            View audit trail
          </Link>
        ) : null}
      </div>

      {notice ? <p className="noticeBanner ok">{notice}</p> : null}
      {error ? <p className="noticeBanner danger">{error}</p> : null}

      {!productResult.ok ? (
        <EmptyState description={productResult.error} title="Product Detail Unavailable" />
      ) : (
        <ProductWorkspace product={productResult.data} />
      )}

      {auditResult ? (
        <section
          className="auditPreview"
          id="catalogue-audit-history"
          aria-label="Catalogue audit history"
        >
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Company Catalogue History</h3>
            </div>
          </div>
          {!auditResult.ok ? (
            <EmptyState description={auditResult.error} title="Catalogue history is unavailable" />
          ) : (
            <>
              <DataTable
                caption="Company catalogue audit history"
                columns={auditColumns}
                emptyDescription="Catalogue review events will appear here."
                emptyTitle="No catalogue history"
                rowKey={(entry) => entry.id}
                rows={auditEntries}
              />
              <Pagination
                buildHref={(targetPage) => buildProductHref(productId, targetPage)}
                limit={auditLimit}
                page={auditPage}
                total={auditTotal}
              />
            </>
          )}
        </section>
      ) : null}
    </BusinessShell>
  );
}

function ProductWorkspace({ product }: { product: ProductDetail }) {
  const ready = product.missingRequirements.length === 0;

  return (
    <div className="detailGrid">
      <section className="panel spanTwo">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{product.brand.name}</p>
            <h3>{product.name}</h3>
          </div>
          <StatusBadge
            label={labelFromCode(product.status)}
            tone={catalogueStatusTone(product.status)}
          />
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Company" value={product.companyOrganisation?.displayName} />
          <DetailField label="Category" value={product.category} />
          <DetailField label="Slug" value={product.slug} />
          <DetailField label="Brand status" value={labelFromCode(product.brand.status)} />
          <DetailField label="Crops" value={product.cropTargets.join(', ')} />
          <DetailField label="Reviewed" value={formatDateTime(product.reviewedAt)} />
        </dl>
        <p className="mutedText">{product.description ?? 'No product description recorded.'}</p>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Readiness</p>
            <h3>Approval Checks</h3>
          </div>
        </div>
        <div className="requirementList stacked">
          {ready ? (
            <StatusBadge label="Ready for approval" tone="ok" />
          ) : (
            product.missingRequirements.map((requirement) => (
              <StatusBadge
                key={requirement}
                label={`Missing ${labelFromCode(requirement)}`}
                tone="warn"
              />
            ))
          )}
        </div>
      </section>

      <VariantPanel variants={product.variants} />
      <DocumentPanel documents={product.documents} />
      <ProductReviewPanel product={product} ready={ready} />
    </div>
  );
}

function VariantPanel({ variants }: { variants: ProductVariant[] }) {
  const columns: DataTableColumn<ProductVariant>[] = [
    { key: 'variant', header: 'Variant', render: (variant) => variant.variantName },
    {
      key: 'pack',
      header: 'Pack',
      render: (variant) => `${variant.packSize} ${variant.packUnit}`,
    },
    { key: 'mrp', header: 'MRP', render: (variant) => formatPaise(variant.mrpPaise) },
    {
      key: 'status',
      header: 'Status',
      render: (variant) => (
        <StatusBadge
          label={variant.isActive ? 'Active' : 'Inactive'}
          tone={variant.isActive ? 'ok' : 'warn'}
        />
      ),
    },
  ];

  return (
    <section className="panel">
      <p className="eyebrow">Variants</p>
      <h3>Pack Sizes</h3>
      <DataTable
        caption="Product pack sizes"
        columns={columns}
        emptyDescription="Product variants will appear here when recorded."
        emptyTitle="No pack sizes recorded"
        rowKey={(variant) => variant.id}
        rows={variants}
      />
    </section>
  );
}

function DocumentPanel({ documents }: { documents: ProductDocument[] }) {
  return (
    <section className="panel spanTwo">
      <p className="eyebrow">Documents</p>
      <h3>Product Document Metadata</h3>
      {documents.length === 0 ? (
        <EmptyState
          description="Product document metadata will appear here when recorded."
          title="No document metadata recorded"
        />
      ) : (
        <div className="documentList">
          {documents.map((document) => (
            <article className="documentRow" key={document.id}>
              <div>
                <h4>{document.title}</h4>
                <dl className="definitionGrid threeColumn">
                  <DetailField label="Type" value={labelFromCode(document.documentType)} />
                  <DetailField label="Number" value={document.documentNumber} />
                  <DetailField label="File" value={document.fileName} />
                  <DetailField label="Storage key" value={document.storageKey} />
                  <DetailField label="Issued" value={formatDateTime(document.issuedAt)} />
                  <DetailField label="Expires" value={formatDateTime(document.expiresAt)} />
                </dl>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductReviewPanel({ product, ready }: { product: ProductDetail; ready: boolean }) {
  const reviewable = product.status === 'SUBMITTED';

  return (
    <section className="panel spanTwo">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Decision</p>
          <h3>Product Master Review</h3>
        </div>
      </div>
      <div className="decisionGrid">
        <form action={reviewProductAction} className="decisionForm">
          <input name="productId" type="hidden" value={product.id} />
          <input name="decision" type="hidden" value="APPROVE" />
          <input name="reason" type="hidden" value="Master product metadata verified." />
          <ConfirmSubmitButton
            confirmMessage="Approve this product master for publication?"
            disabled={!ready || !reviewable}
          >
            Approve Product
          </ConfirmSubmitButton>
        </form>
        <form action={reviewProductAction} className="decisionForm">
          <input name="productId" type="hidden" value={product.id} />
          <input name="decision" type="hidden" value="REJECT" />
          <input
            aria-label="Product rejection reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Rejection reason"
            required
          />
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Reject this product master with the recorded reason?"
            disabled={!reviewable}
          >
            Reject Product
          </ConfirmSubmitButton>
        </form>
      </div>
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

function formatPaise(value?: number | null): string {
  if (value === undefined || value === null) {
    return 'Not recorded';
  }
  return `${value.toLocaleString('en-IN')} paise`;
}

function buildProductHref(productId: string, auditPage: number): string {
  const params = new URLSearchParams();
  if (auditPage > 1) params.set('auditPage', String(auditPage));
  const query = params.toString();
  return `/catalogue/products/${productId}${query ? `?${query}` : ''}#catalogue-audit-history`;
}

function catalogueStatusTone(status: CatalogueStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'APPROVED') return 'ok';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'danger';
  return 'warn';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
