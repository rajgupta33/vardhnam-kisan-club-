import Link from 'next/link';
import type { AuditLog, DistributorOffer, InventoryBatch } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadAuditLogs, loadInventoryBatches, loadOfferDetail } from '../../../lib/marketplace-api';
import {
  archiveOfferAction,
  pauseOfferAction,
  reactivateOfferAction,
  reviewOfferAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const batchLimit = 25;
const auditLimit = 10;

interface OfferDetailPageProps {
  params: Promise<{ offerId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function OfferDetailPage({ params, searchParams }: OfferDetailPageProps) {
  const { offerId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const batchPage = parsePage(readParam(resolvedSearchParams.batchPage));
  const auditPage = parsePage(readParam(resolvedSearchParams.auditPage));
  const offerResult = await loadOfferDetail(offerId);
  const [batchResult, auditResult] = offerResult.ok
    ? await Promise.all([
        loadInventoryBatches({
          warehouseId: offerResult.data.warehouseId,
          productId: offerResult.data.productId,
          variantId: offerResult.data.variantId,
          ...(offerResult.data.batchId ? { batchId: offerResult.data.batchId } : {}),
          page: batchPage,
          limit: batchLimit,
        }),
        loadAuditLogs({
          organisationId: offerResult.data.distributorOrganisationId,
          page: auditPage,
          limit: auditLimit,
        }),
      ])
    : [undefined, undefined];
  const batches = batchResult?.ok ? batchResult.data.items : [];
  const batchTotal = batchResult?.ok ? batchResult.data.total : 0;
  const auditEntries = auditResult?.ok ? auditResult.data.items : [];
  const auditTotal = auditResult?.ok ? auditResult.data.total : 0;
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const auditColumns: DataTableColumn<AuditLog>[] = [
    { key: 'time', header: 'Time', render: (entry) => formatDateTime(entry.createdAt) },
    { key: 'action', header: 'Action', render: (entry) => labelFromCode(entry.action) },
    { key: 'resource', header: 'Resource', render: (entry) => entry.resourceType },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
  ];
  const statuses = [
    {
      label: offerResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: offerResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: offerResult.ok ? 'Offer detail loaded' : 'API not connected',
      tone: offerResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Availability derived from inventory', tone: 'ok' as const },
  ];

  return (
    <BusinessShell
      active="offers"
      eyebrow="Offer detail"
      statuses={statuses}
      title={offerResult.ok ? offerResult.data.product.name : 'Distributor Offer'}
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/offers">
          Back to offer queue
        </Link>
        {offerResult.ok ? (
          <Link
            className="textLink"
            href={`/audit?organisationId=${offerResult.data.distributorOrganisationId}`}
          >
            View distributor audit
          </Link>
        ) : null}
      </div>

      {notice ? <p className="noticeBanner ok">{notice}</p> : null}
      {error ? <p className="noticeBanner danger">{error}</p> : null}

      {!offerResult.ok ? (
        <EmptyState description={offerResult.error} title="Offer Detail Unavailable" />
      ) : (
        <OfferWorkspace
          auditPage={auditPage}
          batchPage={batchPage}
          batches={batches}
          batchTotal={batchTotal}
          offer={offerResult.data}
          {...(batchResult && !batchResult.ok ? { batchError: batchResult.error } : {})}
        />
      )}

      {auditResult ? (
        <section className="auditPreview" id="offer-audit-history" aria-label="Offer audit history">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Distributor Offer History</h3>
            </div>
          </div>
          {!auditResult.ok ? (
            <EmptyState description={auditResult.error} title="Offer history is unavailable" />
          ) : (
            <>
              <DataTable
                caption="Distributor offer audit history"
                columns={auditColumns}
                emptyDescription="Offer review and status events will appear here."
                emptyTitle="No offer history"
                rowKey={(entry) => entry.id}
                rows={auditEntries}
              />
              <Pagination
                buildHref={(targetPage) =>
                  buildOfferDetailHref(offerId, batchPage, targetPage, 'offer-audit-history')
                }
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

function OfferWorkspace({
  offer,
  batches,
  batchError,
  batchPage,
  batchTotal,
  auditPage,
}: {
  offer: DistributorOffer;
  batches: InventoryBatch[];
  batchError?: string;
  batchPage: number;
  batchTotal: number;
  auditPage: number;
}) {
  const ready = offer.missingRequirements.length === 0;

  return (
    <div className="detailGrid">
      <section className="panel spanTwo">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">
              {offer.distributorOrganisation?.displayName ?? 'Distributor'} /{' '}
              {offer.product.brand.name}
            </p>
            <h3>{offer.product.name}</h3>
          </div>
          <StatusBadge label={labelFromCode(offer.status)} tone={statusTone(offer.status)} />
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Offer code" value={offer.offerCode} />
          <DetailField label="Variant" value={offer.variant.variantName} />
          <DetailField label="Pack" value={`${offer.variant.packSize} ${offer.variant.packUnit}`} />
          <DetailField label="Selling price" value={formatPaise(offer.sellingPricePaise)} />
          <DetailField label="MRP" value={formatNullablePaise(offer.variant.mrpPaise)} />
          <DetailField label="Available" value={String(offer.availableQuantity)} />
          <DetailField label="Minimum order" value={String(offer.minimumOrderQuantity)} />
          <DetailField label="Maximum order" value={offer.maximumOrderQuantity} />
          <DetailField label="Fulfilment" value={labelFromCode(offer.fulfilmentMode)} />
          <DetailField label="Delivery SLA" value={formatSla(offer.deliverySlaDays)} />
          <DetailField label="Reviewed" value={formatDateTime(offer.reviewedAt)} />
          <DetailField label="Review reason" value={offer.reviewReason} />
        </dl>
      </section>

      <section className="panel">
        <p className="eyebrow">Readiness</p>
        <h3>Approval Checks</h3>
        <div className="requirementList stacked">
          {ready ? (
            <StatusBadge label="Ready for approval" tone="ok" />
          ) : (
            offer.missingRequirements.map((requirement) => (
              <StatusBadge
                key={requirement}
                label={`Missing ${labelFromCode(requirement)}`}
                tone="warn"
              />
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Warehouse</p>
        <h3>{offer.warehouse.name}</h3>
        <dl className="definitionGrid">
          <DetailField label="Code" value={offer.warehouse.code} />
          <DetailField label="Status" value={labelFromCode(offer.warehouse.status)} />
          <DetailField
            label="Location"
            value={`${offer.warehouse.city}, ${offer.warehouse.state}`}
          />
          <DetailField label="Pincode" value={offer.warehouse.pincode} />
          <DetailField label="Batch" value={offer.batch?.batchNumber} />
          <DetailField label="Batch status" value={offer.batch?.status} />
        </dl>
      </section>

      <section className="panel">
        <p className="eyebrow">Serviceability</p>
        <h3>Pincodes</h3>
        {offer.serviceablePincodes.length === 0 ? (
          <p className="mutedText">No serviceable pincodes recorded.</p>
        ) : (
          <div className="requirementList">
            {offer.serviceablePincodes.map((pincode) => (
              <span className="statusBadge" key={pincode}>
                {pincode}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel spanTwo" id="offer-inventory">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Linked Stock Snapshot</h3>
          </div>
        </div>
        {batchError ? (
          <EmptyState description={batchError} title="Linked inventory is unavailable" />
        ) : (
          <>
            <BatchTable batches={batches} />
            <Pagination
              buildHref={(targetPage) =>
                buildOfferDetailHref(offer.id, targetPage, auditPage, 'offer-inventory')
              }
              limit={batchLimit}
              page={batchPage}
              total={batchTotal}
            />
          </>
        )}
      </section>

      <OfferOperationsPanel offer={offer} />

      <OfferReviewPanel offer={offer} ready={ready} />
    </div>
  );
}

function BatchTable({ batches }: { batches: InventoryBatch[] }) {
  const columns: DataTableColumn<InventoryBatch>[] = [
    { key: 'batch', header: 'Batch', render: (batch) => batch.batchNumber },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (batch) => batch.warehouse?.name ?? 'Not recorded',
    },
    { key: 'expiry', header: 'Expiry', render: (batch) => formatDateTime(batch.expiryDate) },
    { key: 'onHand', header: 'On hand', render: (batch) => batch.onHandQuantity },
    { key: 'sellable', header: 'Sellable', render: (batch) => batch.sellableQuantity },
    {
      key: 'status',
      header: 'Status',
      render: (batch) => (
        <StatusBadge
          label={batch.isExpired ? 'Expired' : labelFromCode(batch.status)}
          tone={batch.isExpired ? 'danger' : statusTone(batch.status)}
        />
      ),
    },
  ];

  return (
    <DataTable
      caption="Linked offer inventory"
      columns={columns}
      emptyDescription="Eligible stock rows for this offer will appear here."
      emptyTitle="No eligible stock rows"
      rowKey={(batch) => batch.id}
      rows={batches}
    />
  );
}

function OfferOperationsPanel({ offer }: { offer: DistributorOffer }) {
  const pausable = offer.status === 'APPROVED';
  const reactivatable = offer.status === 'PAUSED';
  const archivable = offer.status !== 'ARCHIVED';

  return (
    <section className="panel spanTwo">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Operations</p>
          <h3>Offer Status Controls</h3>
        </div>
      </div>
      <div className="decisionGrid">
        <form action={pauseOfferAction} className="decisionForm">
          <input name="offerId" type="hidden" value={offer.id} />
          <input
            aria-label="Pause reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Pause reason"
            required
          />
          <ConfirmSubmitButton
            confirmMessage="Pause this distributor offer with the recorded reason?"
            disabled={!pausable}
          >
            Pause Offer
          </ConfirmSubmitButton>
        </form>
        <form action={reactivateOfferAction} className="decisionForm">
          <input name="offerId" type="hidden" value={offer.id} />
          <input
            aria-label="Reactivation reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Reactivation reason"
            required
          />
          <ConfirmSubmitButton
            confirmMessage="Reactivate this distributor offer?"
            disabled={!reactivatable}
          >
            Reactivate Offer
          </ConfirmSubmitButton>
        </form>
        <form action={archiveOfferAction} className="decisionForm">
          <input name="offerId" type="hidden" value={offer.id} />
          <input
            aria-label="Archive reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Archive reason"
            required
          />
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Archive this distributor offer with the recorded reason?"
            disabled={!archivable}
          >
            Archive Offer
          </ConfirmSubmitButton>
        </form>
      </div>
    </section>
  );
}

function OfferReviewPanel({ offer, ready }: { offer: DistributorOffer; ready: boolean }) {
  const reviewable = offer.status === 'SUBMITTED';

  return (
    <section className="panel spanTwo">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Decision</p>
          <h3>Distributor Offer Review</h3>
        </div>
      </div>
      <div className="decisionGrid">
        <form action={reviewOfferAction} className="decisionForm">
          <input name="offerId" type="hidden" value={offer.id} />
          <input name="decision" type="hidden" value="APPROVE" />
          <input
            name="reason"
            type="hidden"
            value="Offer price, stock and serviceability verified."
          />
          <ConfirmSubmitButton
            confirmMessage="Approve this distributor offer for publication?"
            disabled={!ready || !reviewable}
          >
            Approve Offer
          </ConfirmSubmitButton>
        </form>
        <form action={reviewOfferAction} className="decisionForm">
          <input name="offerId" type="hidden" value={offer.id} />
          <input name="decision" type="hidden" value="REJECT" />
          <input
            aria-label="Offer rejection reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Rejection reason"
            required
          />
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Reject this distributor offer with the recorded reason?"
            disabled={!reviewable}
          >
            Reject Offer
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

function formatPaise(value: number): string {
  return `${value.toLocaleString('en-IN')} paise`;
}

function formatNullablePaise(value?: number | null): string {
  return value === undefined || value === null ? 'Not recorded' : formatPaise(value);
}

function formatSla(value?: number | null): string {
  if (value === undefined || value === null) {
    return 'Not recorded';
  }
  return value === 1 ? '1 day' : `${value} days`;
}

function buildOfferDetailHref(
  offerId: string,
  batchPage: number,
  auditPage: number,
  anchor: 'offer-inventory' | 'offer-audit-history',
): string {
  const params = new URLSearchParams();
  if (batchPage > 1) params.set('batchPage', String(batchPage));
  if (auditPage > 1) params.set('auditPage', String(auditPage));
  const query = params.toString();
  return `/offers/${offerId}${query ? `?${query}` : ''}#${anchor}`;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return 'ok';
  }
  if (status === 'BLOCKED' || status === 'EXPIRED' || status === 'REJECTED') {
    return 'danger';
  }
  return 'warn';
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
