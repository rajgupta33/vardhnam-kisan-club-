import Link from 'next/link';
import type { DistributorOffer, InventoryBatch } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
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

interface OfferDetailPageProps {
  params: Promise<{ offerId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function OfferDetailPage({ params, searchParams }: OfferDetailPageProps) {
  const { offerId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const offerResult = await loadOfferDetail(offerId);
  const [batchResult, auditResult] = offerResult.ok
    ? await Promise.all([
        loadInventoryBatches({
          warehouseId: offerResult.data.warehouseId,
          productId: offerResult.data.productId,
          variantId: offerResult.data.variantId,
          ...(offerResult.data.batchId ? { batchId: offerResult.data.batchId } : {}),
          page: 1,
          limit: 25,
        }),
        loadAuditLogs({
          organisationId: offerResult.data.distributorOrganisationId,
          page: 1,
          limit: 10,
        }),
      ])
    : [undefined, undefined];
  const batches = batchResult?.ok ? batchResult.data.items : [];
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const statuses = [
    {
      label: offerResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
        <section className="emptyState">
          <h3>Offer Detail Unavailable</h3>
          <p className="mutedText">{offerResult.error}</p>
        </section>
      ) : (
        <OfferWorkspace
          batches={batches}
          offer={offerResult.data}
          {...(batchResult && !batchResult.ok ? { batchError: batchResult.error } : {})}
        />
      )}

      {auditResult ? (
        <section className="auditPreview" aria-label="Offer audit history">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Distributor Offer History</h3>
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

function OfferWorkspace({
  offer,
  batches,
  batchError,
}: {
  offer: DistributorOffer;
  batches: InventoryBatch[];
  batchError?: string;
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
          <span className={`statusBadge ${statusTone(offer.status)}`}>
            {labelFromCode(offer.status)}
          </span>
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
            <span className="statusBadge ok">Ready for approval</span>
          ) : (
            offer.missingRequirements.map((requirement) => (
              <span className="statusBadge warn" key={requirement}>
                Missing {labelFromCode(requirement)}
              </span>
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

      <section className="panel spanTwo">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Inventory</p>
            <h3>Linked Stock Snapshot</h3>
          </div>
        </div>
        {batchError ? <p className="mutedText">{batchError}</p> : null}
        <BatchTable batches={batches} />
      </section>

      <OfferOperationsPanel offer={offer} />

      <OfferReviewPanel offer={offer} ready={ready} />
    </div>
  );
}

function BatchTable({ batches }: { batches: InventoryBatch[] }) {
  if (batches.length === 0) {
    return <p className="mutedText">No eligible stock rows were returned for this offer.</p>;
  }

  return (
    <div className="tableShell">
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Warehouse</th>
            <th>Expiry</th>
            <th>On hand</th>
            <th>Sellable</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id}>
              <td>{batch.batchNumber}</td>
              <td>{batch.warehouse?.name ?? 'Not recorded'}</td>
              <td>{formatDateTime(batch.expiryDate)}</td>
              <td>{batch.onHandQuantity}</td>
              <td>{batch.sellableQuantity}</td>
              <td>
                <span
                  className={`statusBadge ${batch.isExpired ? 'danger' : statusTone(batch.status)}`}
                >
                  {batch.isExpired ? 'Expired' : labelFromCode(batch.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <button className="primaryButton" disabled={!pausable} type="submit">
            Pause Offer
          </button>
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
          <button className="primaryButton" disabled={!reactivatable} type="submit">
            Reactivate Offer
          </button>
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
          <button className="dangerButton" disabled={!archivable} type="submit">
            Archive Offer
          </button>
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
          <button className="primaryButton" disabled={!ready || !reviewable} type="submit">
            Approve Offer
          </button>
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
          <button className="dangerButton" disabled={!reviewable} type="submit">
            Reject Offer
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

function statusTone(status: string) {
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
