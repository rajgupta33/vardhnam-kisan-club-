import Link from 'next/link';
import type {
  InventoryAgeingBucket,
  InventoryAgeingQuery,
  InventoryAgeingReportItem,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadExpiringInventory,
  loadInventoryAgeing,
  loadLowStockInventory,
} from '../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type AgeingView = 'all' | 'low-stock' | 'expiring';

interface InventoryAgeingPageProps {
  searchParams?: Promise<SearchParams>;
}

const ageingViews: Array<{ value: AgeingView; label: string }> = [
  { value: 'all', label: 'All Alerts' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'expiring', label: 'Expiring Batches' },
];
const limit = 50;

export default async function InventoryAgeingPage({ searchParams }: InventoryAgeingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const view = parseAgeingView(readParam(resolvedSearchParams.view)) ?? 'all';
  const lowStockThreshold = parsePositiveInt(readParam(resolvedSearchParams.lowStockThreshold));
  const expiringWithinDays = parsePositiveInt(readParam(resolvedSearchParams.expiringWithinDays));
  const page = parsePage(readParam(resolvedSearchParams.page));
  const query: InventoryAgeingQuery = {
    page,
    limit,
    ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
    ...(expiringWithinDays !== undefined ? { expiringWithinDays } : {}),
  };
  const reportResult =
    view === 'low-stock'
      ? await loadLowStockInventory(query)
      : view === 'expiring'
        ? await loadExpiringInventory(query)
        : await loadInventoryAgeing(query);
  const items = reportResult.ok ? reportResult.data.items : [];
  const total = reportResult.ok ? reportResult.data.total : 0;
  const lowStockCount = items.filter((item) => item.isLowStock).length;
  const expiringCount = items.filter((item) => item.isExpiringSoon).length;
  const blockedOrExpiredCount = items.filter((item) => item.isBlocked || item.isExpired).length;
  const statuses = [
    {
      label: reportResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: reportResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: reportResult.ok ? `${items.length} report rows` : 'API not connected',
      tone: reportResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Read-only inventory reports', tone: 'ok' as const },
  ];

  return (
    <BusinessShell
      active="inventory"
      eyebrow="Inventory reports"
      statuses={statuses}
      title="Inventory Ageing"
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/inventory">
          Back to inventory
        </Link>
      </div>

      <section className="metricStrip" aria-label="Inventory ageing metrics">
        <article className="metricCard">
          <p className="metricValue">{lowStockCount}</p>
          <p className="metricLabel">Low-stock rows</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{expiringCount}</p>
          <p className="metricLabel">Expiring soon</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{blockedOrExpiredCount}</p>
          <p className="metricLabel">Blocked or expired</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Inventory ageing filters">
        <div className="segmentedControl">
          {ageingViews.map((ageingView) => (
            <FilterLink
              active={view === ageingView.value}
              href={buildAgeingHref(ageingView.value, lowStockThreshold, expiringWithinDays, 1)}
              key={ageingView.value}
              label={ageingView.label}
            />
          ))}
        </div>
        <form className="searchForm" method="get">
          <input name="view" type="hidden" value={view} />
          <input
            defaultValue={lowStockThreshold ?? ''}
            min={0}
            name="lowStockThreshold"
            placeholder="Low stock threshold"
            type="number"
          />
          <input
            defaultValue={expiringWithinDays ?? ''}
            min={0}
            name="expiringWithinDays"
            placeholder="Expiring within days"
            type="number"
          />
          <button className="primaryButton" type="submit">
            Apply
          </button>
        </form>
      </section>

      {!reportResult.ok ? (
        <EmptyState
          description={reportResult.error}
          title="Inventory Report API Connection Blocked"
        />
      ) : (
        <section className="panel" aria-label="Inventory ageing report">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">
                Thresholds: {reportResult.data.lowStockThreshold} units /{' '}
                {reportResult.data.expiringWithinDays} days
              </p>
              <h3>Batch Risk Rows</h3>
            </div>
          </div>
          <InventoryAgeingTable items={items} />
          <Pagination
            buildHref={(targetPage) =>
              buildAgeingHref(view, lowStockThreshold, expiringWithinDays, targetPage)
            }
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function InventoryAgeingTable({ items }: { items: InventoryAgeingReportItem[] }) {
  const columns: DataTableColumn<InventoryAgeingReportItem>[] = [
    {
      key: 'batch',
      header: 'Batch',
      render: (item) => (
        <>
          {item.batch.batchNumber}
          <br />
          <span className="mutedText">
            {item.distributorOrganisation?.displayName ?? 'Distributor'}
          </span>
        </>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (item) => (
        <>
          {item.product.name}
          <br />
          <span className="mutedText">{item.variant.variantName}</span>
        </>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (item) => item.warehouse?.name ?? 'Not recorded',
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (item) => (
        <>
          {item.sellableQuantity} sellable
          <br />
          <span className="mutedText">{item.onHandQuantity} on hand</span>
        </>
      ),
    },
    {
      key: 'expiry',
      header: 'Expiry',
      render: (item) => (
        <>
          {formatDateTime(item.batch.expiryDate)}
          <br />
          <span className="mutedText">{formatDaysUntilExpiry(item.daysUntilExpiry)}</span>
        </>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      render: (item) => (
        <>
          {item.ageInDays} days
          <br />
          <span className="mutedText">{labelFromCode(item.stockAgeBucket)}</span>
        </>
      ),
    },
    {
      key: 'alert',
      header: 'Alert',
      render: (item) => (
        <StatusBadge
          label={labelFromCode(item.ageingBucket)}
          tone={ageingTone(item.ageingBucket)}
        />
      ),
    },
  ];

  return (
    <DataTable
      caption="Inventory ageing report"
      columns={columns}
      emptyDescription="Inventory rows matching the current report filters will appear here."
      emptyTitle="No inventory rows"
      rowKey={(item) => item.batch.id}
      rows={items}
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

function buildAgeingHref(
  view: AgeingView,
  lowStockThreshold: number | undefined,
  expiringWithinDays: number | undefined,
  page: number,
): string {
  const params = new URLSearchParams({ view });
  if (lowStockThreshold !== undefined) {
    params.set('lowStockThreshold', String(lowStockThreshold));
  }
  if (expiringWithinDays !== undefined) {
    params.set('expiringWithinDays', String(expiringWithinDays));
  }
  if (page > 1) {
    params.set('page', String(page));
  }

  return `/inventory/ageing?${params.toString()}`;
}

function ageingTone(bucket: InventoryAgeingBucket): 'ok' | 'warn' | 'danger' {
  if (bucket === 'HEALTHY') {
    return 'ok';
  }
  if (bucket === 'EXPIRED' || bucket === 'BLOCKED') {
    return 'danger';
  }
  return 'warn';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function formatDaysUntilExpiry(value?: number | null): string {
  if (value === undefined || value === null) {
    return 'No expiry date';
  }
  if (value < 0) {
    return `${Math.abs(value)} days expired`;
  }
  return value === 1 ? '1 day left' : `${value} days left`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseAgeingView(value: string | undefined): AgeingView | undefined {
  return ageingViews.some((view) => view.value === value) ? (value as AgeingView) : undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
