import Link from 'next/link';
import type { InventoryAgeingQuery, InventoryAgeingReportItem } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
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

export default async function InventoryAgeingPage({ searchParams }: InventoryAgeingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const view = parseAgeingView(readParam(resolvedSearchParams.view)) ?? 'all';
  const lowStockThreshold = parsePositiveInt(readParam(resolvedSearchParams.lowStockThreshold));
  const expiringWithinDays = parsePositiveInt(readParam(resolvedSearchParams.expiringWithinDays));
  const query: InventoryAgeingQuery = {
    page: 1,
    limit: 50,
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
  const lowStockCount = items.filter((item) => item.isLowStock).length;
  const expiringCount = items.filter((item) => item.isExpiringSoon).length;
  const blockedOrExpiredCount = items.filter((item) => item.isBlocked || item.isExpired).length;
  const statuses = [
    {
      label: reportResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
              href={buildAgeingHref(ageingView.value, lowStockThreshold, expiringWithinDays)}
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
        <section className="emptyState">
          <h3>Inventory Report API Connection Blocked</h3>
          <p className="mutedText">{reportResult.error}</p>
        </section>
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
        </section>
      )}
    </BusinessShell>
  );
}

function InventoryAgeingTable({ items }: { items: InventoryAgeingReportItem[] }) {
  if (items.length === 0) {
    return <p className="mutedText">No inventory rows match the current report filters.</p>;
  }

  return (
    <div className="tableShell">
      <table>
        <thead>
          <tr>
            <th>Batch</th>
            <th>Product</th>
            <th>Warehouse</th>
            <th>Stock</th>
            <th>Expiry</th>
            <th>Age</th>
            <th>Alert</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.batch.id}>
              <td>
                {item.batch.batchNumber}
                <br />
                <span className="mutedText">
                  {item.distributorOrganisation?.displayName ?? 'Distributor'}
                </span>
              </td>
              <td>
                {item.product.name}
                <br />
                <span className="mutedText">{item.variant.variantName}</span>
              </td>
              <td>{item.warehouse?.name ?? 'Not recorded'}</td>
              <td>
                {item.sellableQuantity} sellable
                <br />
                <span className="mutedText">{item.onHandQuantity} on hand</span>
              </td>
              <td>
                {formatDateTime(item.batch.expiryDate)}
                <br />
                <span className="mutedText">{formatDaysUntilExpiry(item.daysUntilExpiry)}</span>
              </td>
              <td>
                {item.ageInDays} days
                <br />
                <span className="mutedText">{labelFromCode(item.stockAgeBucket)}</span>
              </td>
              <td>
                <span className={`statusBadge ${ageingTone(item.ageingBucket)}`}>
                  {labelFromCode(item.ageingBucket)}
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

function buildAgeingHref(
  view: AgeingView,
  lowStockThreshold: number | undefined,
  expiringWithinDays: number | undefined,
): string {
  const params = new URLSearchParams({ view });
  if (lowStockThreshold !== undefined) {
    params.set('lowStockThreshold', String(lowStockThreshold));
  }
  if (expiringWithinDays !== undefined) {
    params.set('expiringWithinDays', String(expiringWithinDays));
  }

  return `/inventory/ageing?${params.toString()}`;
}

function ageingTone(bucket: string) {
  if (bucket === 'HEALTHY') {
    return 'ok';
  }
  if (bucket === 'EXPIRED' || bucket === 'BLOCKED') {
    return 'danger';
  }
  return 'warn';
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
