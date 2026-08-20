import Link from 'next/link';
import type { InventoryBatch, Warehouse, WarehouseStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadInventoryBatches, loadWarehouses } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface InventoryPageProps {
  searchParams?: Promise<SearchParams>;
}

const warehouseStatusValues: WarehouseStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const limit = 25;

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseWarehouseStatus(readParam(resolvedSearchParams.status));
  const q = readParam(resolvedSearchParams.q);
  const warehousePage = parsePage(readParam(resolvedSearchParams.warehousePage));
  const batchPage = parsePage(readParam(resolvedSearchParams.batchPage));
  const warehouseQuery = {
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    page: warehousePage,
    limit,
  };
  const batchQuery = {
    ...(q ? { q } : {}),
    page: batchPage,
    limit,
  };
  const [warehouseResult, batchResult] = await Promise.all([
    loadWarehouses(warehouseQuery),
    loadInventoryBatches(batchQuery),
  ]);
  const warehouses = warehouseResult.ok ? warehouseResult.data.items : [];
  const warehouseTotal = warehouseResult.ok ? warehouseResult.data.total : 0;
  const batches = batchResult.ok ? batchResult.data.items : [];
  const batchTotal = batchResult.ok ? batchResult.data.total : 0;
  const onHandQuantity = batches.reduce((total, batch) => total + batch.onHandQuantity, 0);
  const sellableQuantity = batches.reduce((total, batch) => total + batch.sellableQuantity, 0);
  const connectionError = !warehouseResult.ok
    ? warehouseResult.error
    : !batchResult.ok
      ? batchResult.error
      : undefined;
  const statuses = [
    {
      label: warehouseResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: warehouseResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: batchResult.ok ? `${batches.length} batch rows` : 'API not connected',
      tone: batchResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'No reservations or checkout', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="inventory"
      eyebrow="Distributor operations"
      statuses={statuses}
      title="Warehouse Inventory"
    >
      <section className="metricStrip" aria-label="Inventory metrics">
        <article className="metricCard">
          <p className="metricValue">{warehouses.length}</p>
          <p className="metricLabel">Warehouses</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{onHandQuantity}</p>
          <p className="metricLabel">On-hand units</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{sellableQuantity}</p>
          <p className="metricLabel">Sellable units</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Inventory filters">
        <div className="segmentedControl">
          <FilterLink
            active={!status}
            href={buildInventoryHref(undefined, q, 1, 1)}
            label="All Warehouses"
          />
          {warehouseStatusValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildInventoryHref(statusValue, q, 1, 1)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          {status ? <input name="status" type="hidden" value={status} /> : null}
          <input defaultValue={q ?? ''} name="q" placeholder="Search inventory" type="search" />
          <button className="primaryButton" type="submit">
            Search
          </button>
        </form>
      </section>

      {connectionError ? (
        <EmptyState description={connectionError} title="Inventory API Connection Blocked" />
      ) : (
        <>
          <div className="breadcrumbRow">
            <Link className="textLink" href="/inventory/ageing">
              View inventory ageing
            </Link>
          </div>

          <section className="queueList" aria-label="Warehouse list">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Warehouses</p>
                <h3>Distributor Warehouse Records</h3>
              </div>
            </div>
            {warehouses.length === 0 ? (
              <EmptyState
                description="Distributor warehouse records will appear here."
                title="No warehouses"
              />
            ) : (
              warehouses.map((warehouse) => (
                <WarehouseCard key={warehouse.id} warehouse={warehouse} />
              ))
            )}
            <Pagination
              buildHref={(targetPage) => buildInventoryHref(status, q, targetPage, batchPage)}
              limit={limit}
              page={warehousePage}
              total={warehouseTotal}
            />
          </section>

          <section className="panel" aria-label="Batch inventory">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Batches</p>
                <h3>Batch Stock Snapshot</h3>
              </div>
            </div>
            <BatchTable batches={batches} />
            <Pagination
              buildHref={(targetPage) => buildInventoryHref(status, q, warehousePage, targetPage)}
              limit={limit}
              page={batchPage}
              total={batchTotal}
            />
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function WarehouseCard({ warehouse }: { warehouse: Warehouse }) {
  return (
    <article className="queueCard">
      <div className="queueCardMain">
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
          <DetailField label="Location" value={`${warehouse.city}, ${warehouse.state}`} />
          <DetailField label="Pincode" value={warehouse.pincode} />
        </dl>
      </div>
      <Link className="queueAction" href={`/inventory/warehouses/${warehouse.id}`}>
        Inspect
      </Link>
    </article>
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
      caption="Batch stock snapshot"
      columns={columns}
      emptyDescription="Batch stock records matching the current filters will appear here."
      emptyTitle="No batch stock records"
      rowKey={(batch) => batch.id}
      rows={batches}
    />
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

function buildInventoryHref(
  status: WarehouseStatus | undefined,
  q: string | undefined,
  warehousePage: number,
  batchPage: number,
): string {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  if (q) {
    params.set('q', q);
  }
  if (warehousePage > 1) {
    params.set('warehousePage', String(warehousePage));
  }
  if (batchPage > 1) {
    params.set('batchPage', String(batchPage));
  }

  const value = params.toString();
  return value ? `/inventory?${value}` : '/inventory';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function statusTone(
  status: WarehouseStatus | 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'INACTIVE',
): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') {
    return 'ok';
  }
  return status === 'BLOCKED' || status === 'EXPIRED' ? 'danger' : 'warn';
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseWarehouseStatus(value: string | undefined): WarehouseStatus | undefined {
  return warehouseStatusValues.includes(value as WarehouseStatus)
    ? (value as WarehouseStatus)
    : undefined;
}
