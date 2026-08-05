import Link from 'next/link';
import type { InventoryBatch, Warehouse, WarehouseStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadInventoryBatches, loadWarehouses } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface InventoryPageProps {
  searchParams?: Promise<SearchParams>;
}

const warehouseStatusValues: WarehouseStatus[] = ['ACTIVE', 'INACTIVE', 'BLOCKED'];

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseWarehouseStatus(readParam(resolvedSearchParams.status));
  const q = readParam(resolvedSearchParams.q);
  const warehouseQuery = {
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    page: 1,
    limit: 25,
  };
  const batchQuery = {
    ...(q ? { q } : {}),
    page: 1,
    limit: 25,
  };
  const [warehouseResult, batchResult] = await Promise.all([
    loadWarehouses(warehouseQuery),
    loadInventoryBatches(batchQuery),
  ]);
  const warehouses = warehouseResult.ok ? warehouseResult.data.items : [];
  const batches = batchResult.ok ? batchResult.data.items : [];
  const onHandQuantity = batches.reduce((total, batch) => total + batch.onHandQuantity, 0);
  const sellableQuantity = batches.reduce((total, batch) => total + batch.sellableQuantity, 0);
  const connectionError = !warehouseResult.ok
    ? warehouseResult.error
    : !batchResult.ok
      ? batchResult.error
      : undefined;
  const statuses = [
    {
      label: warehouseResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
            href={buildInventoryHref(undefined, q)}
            label="All Warehouses"
          />
          {warehouseStatusValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildInventoryHref(statusValue, q)}
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
        <section className="emptyState">
          <h3>Inventory API Connection Blocked</h3>
          <p className="mutedText">{connectionError}</p>
        </section>
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
              <article className="emptyState">
                <h3>No warehouses</h3>
                <p className="mutedText">Distributor warehouse records will appear here.</p>
              </article>
            ) : (
              warehouses.map((warehouse) => (
                <WarehouseCard key={warehouse.id} warehouse={warehouse} />
              ))
            )}
          </section>

          <section className="panel" aria-label="Batch inventory">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Batches</p>
                <h3>Batch Stock Snapshot</h3>
              </div>
            </div>
            <BatchTable batches={batches} />
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
          <span className={`statusBadge ${statusTone(warehouse.status)}`}>
            {labelFromCode(warehouse.status)}
          </span>
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
  if (batches.length === 0) {
    return <p className="mutedText">No batch stock records match the current filters.</p>;
  }

  return (
    <div className="tableShell">
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Product</th>
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
              <td>
                {batch.product.name}
                <br />
                <span className="mutedText">{batch.variant.variantName}</span>
              </td>
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

function buildInventoryHref(status: WarehouseStatus | undefined, q: string | undefined): string {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  if (q) {
    params.set('q', q);
  }

  const value = params.toString();
  return value ? `/inventory?${value}` : '/inventory';
}

function statusTone(status: WarehouseStatus | 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'INACTIVE') {
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
