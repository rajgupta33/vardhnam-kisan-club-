import Link from 'next/link';
import type { InventoryBatch, InventoryMovement, Warehouse } from '@vardhnam/api-client';
import { BusinessShell } from '../../../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../../../lib/format';
import {
  loadAuditLogs,
  loadInventoryBatches,
  loadInventoryMovements,
  loadWarehouseDetail,
} from '../../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

interface WarehouseDetailPageProps {
  params: Promise<{ warehouseId: string }>;
}

export default async function WarehouseDetailPage({ params }: WarehouseDetailPageProps) {
  const { warehouseId } = await params;
  const warehouseResult = await loadWarehouseDetail(warehouseId);
  const [batchResult, movementResult, auditResult] = warehouseResult.ok
    ? await Promise.all([
        loadInventoryBatches({ warehouseId, page: 1, limit: 25 }),
        loadInventoryMovements({ warehouseId, page: 1, limit: 20 }),
        loadAuditLogs({
          organisationId: warehouseResult.data.distributorOrganisationId,
          page: 1,
          limit: 10,
        }),
      ])
    : [undefined, undefined, undefined];
  const batches = batchResult?.ok ? batchResult.data.items : [];
  const movements = movementResult?.ok ? movementResult.data.items : [];
  const statuses = [
    {
      label: warehouseResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
      tone: warehouseResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: batchResult?.ok ? `${batches.length} batch rows` : 'Inventory API required',
      tone: batchResult?.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Append-only movements', tone: 'ok' as const },
  ];

  return (
    <BusinessShell
      active="inventory"
      eyebrow="Warehouse detail"
      statuses={statuses}
      title={warehouseResult.ok ? warehouseResult.data.name : 'Warehouse'}
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/inventory">
          Back to inventory
        </Link>
        {warehouseResult.ok ? (
          <Link
            className="textLink"
            href={`/audit?organisationId=${warehouseResult.data.distributorOrganisationId}`}
          >
            View distributor audit
          </Link>
        ) : null}
      </div>

      {!warehouseResult.ok ? (
        <section className="emptyState">
          <h3>Warehouse Detail Unavailable</h3>
          <p className="mutedText">{warehouseResult.error}</p>
        </section>
      ) : (
        <WarehouseWorkspace
          batches={batches}
          movements={movements}
          warehouse={warehouseResult.data}
          {...(movementResult && !movementResult.ok ? { movementError: movementResult.error } : {})}
        />
      )}

      {auditResult ? (
        <section className="auditPreview" aria-label="Inventory audit history">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Distributor Inventory History</h3>
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

function WarehouseWorkspace({
  warehouse,
  batches,
  movements,
  movementError,
}: {
  warehouse: Warehouse;
  batches: InventoryBatch[];
  movements: InventoryMovement[];
  movementError?: string;
}) {
  const onHandQuantity = batches.reduce((total, batch) => total + batch.onHandQuantity, 0);
  const sellableQuantity = batches.reduce((total, batch) => total + batch.sellableQuantity, 0);

  return (
    <div className="detailGrid">
      <section className="panel spanTwo">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">
              {warehouse.distributorOrganisation?.displayName ?? 'Distributor'}
            </p>
            <h3>{warehouse.name}</h3>
          </div>
          <span className={`statusBadge ${statusTone(warehouse.status)}`}>
            {labelFromCode(warehouse.status)}
          </span>
        </div>
        <dl className="definitionGrid threeColumn">
          <DetailField label="Code" value={warehouse.code} />
          <DetailField label="Address" value={warehouse.addressLine1} />
          <DetailField label="Address 2" value={warehouse.addressLine2} />
          <DetailField label="City" value={warehouse.city} />
          <DetailField label="State" value={warehouse.state} />
          <DetailField label="Pincode" value={warehouse.pincode} />
          <DetailField label="Contact" value={warehouse.contactName} />
          <DetailField label="Phone" value={warehouse.contactPhone} />
          <DetailField label="Updated" value={formatDateTime(warehouse.updatedAt)} />
        </dl>
      </section>

      <section className="panel">
        <p className="eyebrow">Stock</p>
        <h3>Warehouse Snapshot</h3>
        <dl className="definitionGrid">
          <DetailField label="Batch rows" value={String(batches.length)} />
          <DetailField label="On hand" value={String(onHandQuantity)} />
          <DetailField label="Sellable" value={String(sellableQuantity)} />
          <DetailField
            label="Blocked or expired"
            value={String(batches.filter((batch) => batch.sellableQuantity === 0).length)}
          />
        </dl>
      </section>

      <section className="panel spanTwo">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Batches</p>
            <h3>Warehouse Batch Stock</h3>
          </div>
        </div>
        <BatchTable batches={batches} />
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Movements</p>
            <h3>Recent Stock History</h3>
          </div>
        </div>
        {movementError ? <p className="mutedText">{movementError}</p> : null}
        <MovementList movements={movements} />
      </section>
    </div>
  );
}

function BatchTable({ batches }: { batches: InventoryBatch[] }) {
  if (batches.length === 0) {
    return <p className="mutedText">No batch stock has been recorded for this warehouse.</p>;
  }

  return (
    <div className="tableShell">
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Product</th>
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
              <td>
                {batch.product.name}
                <br />
                <span className="mutedText">{batch.variant.variantName}</span>
              </td>
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

function MovementList({ movements }: { movements: InventoryMovement[] }) {
  if (movements.length === 0) {
    return <p className="mutedText">No inventory movements have been recorded.</p>;
  }

  return (
    <ul className="compactList">
      {movements.map((movement) => (
        <li key={movement.id}>
          <strong>{labelFromCode(movement.movementType)}</strong>
          <br />
          {movement.batch?.batchNumber ?? 'Batch'}: {movement.quantityDelta} units, balance{' '}
          {movement.balanceAfter}
          <br />
          <span className="mutedText">
            {formatDateTime(movement.createdAt)} - {movement.reason}
          </span>
        </li>
      ))}
    </ul>
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

function statusTone(status: string) {
  if (status === 'ACTIVE') {
    return 'ok';
  }
  return status === 'BLOCKED' || status === 'EXPIRED' ? 'danger' : 'warn';
}
