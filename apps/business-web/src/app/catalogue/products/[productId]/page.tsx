import Link from 'next/link';
import type { ProductDetail, ProductDocument, ProductVariant } from '@vardhnam/api-client';
import { BusinessShell } from '../../../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../../../lib/format';
import { loadAuditLogs, loadProductDetail } from '../../../../lib/marketplace-api';
import { reviewProductAction } from '../../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface ProductDetailPageProps {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function ProductDetailPage({ params, searchParams }: ProductDetailPageProps) {
  const { productId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const productResult = await loadProductDetail(productId);
  const auditResult = productResult.ok
    ? await loadAuditLogs({
        organisationId: productResult.data.companyOrganisationId,
        page: 1,
        limit: 10,
      })
    : undefined;
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const statuses = [
    {
      label: productResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
        <section className="emptyState">
          <h3>Product Detail Unavailable</h3>
          <p className="mutedText">{productResult.error}</p>
        </section>
      ) : (
        <ProductWorkspace product={productResult.data} />
      )}

      {auditResult ? (
        <section className="auditPreview" aria-label="Catalogue audit history">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Company Catalogue History</h3>
            </div>
          </div>
          {!auditResult.ok ? (
            <p className="mutedText">{auditResult.error}</p>
          ) : (
            <div className="tableShell">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditResult.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{labelFromCode(entry.action)}</td>
                      <td>{entry.resourceType}</td>
                      <td>{entry.reason ?? 'Not recorded'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <span className={`statusBadge ${product.status === 'APPROVED' ? 'ok' : 'warn'}`}>
            {labelFromCode(product.status)}
          </span>
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
            <span className="statusBadge ok">Ready for approval</span>
          ) : (
            product.missingRequirements.map((requirement) => (
              <span className="statusBadge warn" key={requirement}>
                Missing {labelFromCode(requirement)}
              </span>
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
  return (
    <section className="panel">
      <p className="eyebrow">Variants</p>
      <h3>Pack Sizes</h3>
      {variants.length === 0 ? (
        <p className="mutedText">No pack sizes recorded.</p>
      ) : (
        <div className="tableShell">
          <table>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Pack</th>
                <th>MRP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id}>
                  <td>{variant.variantName}</td>
                  <td>
                    {variant.packSize} {variant.packUnit}
                  </td>
                  <td>{formatPaise(variant.mrpPaise)}</td>
                  <td>{variant.isActive ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DocumentPanel({ documents }: { documents: ProductDocument[] }) {
  return (
    <section className="panel spanTwo">
      <p className="eyebrow">Documents</p>
      <h3>Product Document Metadata</h3>
      {documents.length === 0 ? (
        <p className="mutedText">No document metadata recorded.</p>
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
          <button className="primaryButton" disabled={!ready || !reviewable} type="submit">
            Approve Product
          </button>
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
          <button className="dangerButton" disabled={!reviewable} type="submit">
            Reject Product
          </button>
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

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
