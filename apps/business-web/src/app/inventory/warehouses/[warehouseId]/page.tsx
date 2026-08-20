import Link from 'next/link';
import type { AuditLog, InventoryBatch, InventoryMovement, Warehouse } from '@vardhnam/api-client';
import { BusinessShell } from '../../../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../../../components/data-table';
import { EmptyState } from '../../../../components/empty-state';
import { Pagination } from '../../../../components/pagination';
import { StatusBadge } from '../../../../components/status-badge';
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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}
const batchLimit = 25;
const movementLimit = 20;
const auditLimit = 10;

export default async function WarehouseDetailPage({
  params,
  searchParams,
}: WarehouseDetailPageProps) {
  const { warehouseId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const batchPage = parsePage(readParam(resolvedSearchParams.batchPage));
  const movementPage = parsePage(readParam(resolvedSearchParams.movementPage));
  const auditPage = parsePage(readParam(resolvedSearchParams.auditPage));
  const warehouseResult = await loadWarehouseDetail(warehouseId);
  const [batchResult, movementResult, auditResult] = warehouseResult.ok
    ? await Promise.all([
        loadInventoryBatches({ warehouseId, page: batchPage, limit: batchLimit }),
        loadInventoryMovements({ warehouseId, page: movementPage, limit: movementLimit }),
        loadAuditLogs({
          organisationId: warehouseResult.data.distributorOrganisationId,
          page: auditPage,
          limit: auditLimit,
        }),
      ])
    : [undefined, undefined, undefined];
  const batches = batchResult?.ok ? batchResult.data.items : [];
  const batchTotal = batchResult?.ok ? batchResult.data.total : 0;
  const movements = movementResult?.ok ? movementResult.data.items : [];
  const movementTotal = movementResult?.ok ? movementResult.data.total : 0;
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
      label: warehouseResult.config.configured ? 'Authenticated session' : 'Session missing',
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
        <EmptyState description={warehouseResult.error} title="Warehouse Detail Unavailable" />
      ) : (
        <WarehouseWorkspace
          auditPage={auditPage}
          batchPage={batchPage}
          batches={batches}
          batchTotal={batchTotal}
          movementPage={movementPage}
          movements={movements}
          movementTotal={movementTotal}
          warehouse={warehouseResult.data}
          {...(batchResult && !batchResult.ok ? { batchError: batchResult.error } : {})}
          {...(movementResult && !movementResult.ok ? { movementError: movementResult.error } : {})}
        />
      )}

      {auditResult ? (
        <section
          className="auditPreview"
          id="warehouse-audit-history"
          aria-label="Inventory audit history"
        >
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Audit</p>
              <h3>Distributor Inventory History</h3>
            </div>
          </div>
          {!auditResult.ok ? (
            <EmptyState description={auditResult.error} title="Inventory history is unavailable" />
          ) : (
            <>
              <DataTable
                caption="Distributor inventory audit history"
                columns={auditColumns}
                emptyDescription="Inventory audit events will appear here."
                emptyTitle="No inventory history"
                rowKey={(entry) => entry.id}
                rows={auditEntries}
              />
              <Pagination
                buildHref={(targetPage) =>
                  buildWarehouseHref(
                    warehouseId,
                    batchPage,
                    movementPage,
                    targetPage,
                    'warehouse-audit-history',
                  )
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

function WarehouseWorkspace({
  warehouse,
  batches,
  movements,
  batchError,
  movementError,
  batchPage,
  batchTotal,
  movementPage,
  movementTotal,
  auditPage,
}: {
  warehouse: Warehouse;
  batches: InventoryBatch[];
  movements: InventoryMovement[];
  batchError?: string;
  movementError?: string;
  batchPage: number;
  batchTotal: number;
  movementPage: number;
  movementTotal: number;
  auditPage: number;
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
          <StatusBadge
            label={labelFromCode(warehouse.status)}
            tone={statusTone(warehouse.status)}
          />
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
          <DetailField label="Batch rows in view" value={String(batches.length)} />
          <DetailField label="On hand in view" value={String(onHandQuantity)} />
          <DetailField label="Sellable in view" value={String(sellableQuantity)} />
          <DetailField
            label="Blocked or expired in view"
            value={String(batches.filter((batch) => batch.sellableQuantity === 0).length)}
          />
        </dl>
      </section>

      <section className="panel spanTwo" id="warehouse-batches">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Batches</p>
            <h3>Warehouse Batch Stock</h3>
          </div>
        </div>
        {batchError ? (
          <EmptyState description={batchError} title="Warehouse batches are unavailable" />
        ) : (
          <>
            <BatchTable batches={batches} />
            <Pagination
              buildHref={(targetPage) =>
                buildWarehouseHref(
                  warehouse.id,
                  targetPage,
                  movementPage,
                  auditPage,
                  'warehouse-batches',
                )
              }
              limit={batchLimit}
              page={batchPage}
              total={batchTotal}
            />
          </>
        )}
      </section>

      <section className="panel" id="warehouse-movements">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Movements</p>
            <h3>Recent Stock History</h3>
          </div>
        </div>
        {movementError ? (
          <EmptyState description={movementError} title="Stock history is unavailable" />
        ) : (
          <>
            <MovementTable movements={movements} />
            <Pagination
              buildHref={(targetPage) =>
                buildWarehouseHref(
                  warehouse.id,
                  batchPage,
                  targetPage,
                  auditPage,
                  'warehouse-movements',
                )
              }
              limit={movementLimit}
              page={movementPage}
              total={movementTotal}
            />
          </>
        )}
      </section>
    </div>
  );
}

function BatchTable({ batches }: { batches: InventoryBatch[] }) {
  const columns: DataTableColumn<InventoryBatch>[] = [
    { key: 'batch', header: 'Batch', render: (batch) => batch.batchNumber },
    {
      key: 'product',
      header: 'Product',
      render: (batch) => (
        <>
          {batch.product.name}
          <br />
          <span className="mutedText">{batch.variant.variantName}</span>
        </>
      ),
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
      caption="Warehouse batch stock"
      columns={columns}
      emptyDescription="Batch stock for this warehouse will appear here."
      emptyTitle="No warehouse batch stock"
      rowKey={(batch) => batch.id}
      rows={batches}
    />
  );
}

function MovementTable({ movements }: { movements: InventoryMovement[] }) {
  const columns: DataTableColumn<InventoryMovement>[] = [
    {
      key: 'type',
      header: 'Movement',
      render: (movement) => labelFromCode(movement.movementType),
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (movement) => movement.batch?.batchNumber ?? 'Not recorded',
    },
    { key: 'quantity', header: 'Quantity', render: (movement) => movement.quantityDelta },
    { key: 'balance', header: 'Balance', render: (movement) => movement.balanceAfter },
    { key: 'reason', header: 'Reason', render: (movement) => movement.reason },
    {
      key: 'recorded',
      header: 'Recorded',
      render: (movement) => formatDateTime(movement.createdAt),
    },
  ];

  return (
    <DataTable
      caption="Warehouse stock movements"
      columns={columns}
      emptyDescription="Append-only inventory movements will appear here."
      emptyTitle="No inventory movements"
      rowKey={(movement) => movement.id}
      rows={movements}
    />
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

function buildWarehouseHref(
  warehouseId: string,
  batchPage: number,
  movementPage: number,
  auditPage: number,
  anchor: 'warehouse-batches' | 'warehouse-movements' | 'warehouse-audit-history',
): string {
  const params = new URLSearchParams();
  if (batchPage > 1) params.set('batchPage', String(batchPage));
  if (movementPage > 1) params.set('movementPage', String(movementPage));
  if (auditPage > 1) params.set('auditPage', String(auditPage));
  const query = params.toString();
  return `/inventory/warehouses/${warehouseId}${query ? `?${query}` : ''}#${anchor}`;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') {
    return 'ok';
  }
  return status === 'BLOCKED' || status === 'EXPIRED' ? 'danger' : 'warn';
}
