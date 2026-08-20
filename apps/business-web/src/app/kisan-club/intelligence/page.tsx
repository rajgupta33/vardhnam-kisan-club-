import type {
  CropCycleStatus,
  KisanClubCropSummary,
  KisanClubPromoterPerformance,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadKisanClubCropSummary,
  loadKisanClubPromoterPerformance,
} from '../../../lib/marketplace-api';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;
const promoterLimit = 25;
const cycleStatuses: CropCycleStatus[] = ['PLANNED', 'ACTIVE', 'HARVESTED', 'ABANDONED'];

export default async function KisanClubIntelligencePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const state = textFilter(params.state);
  const district = textFilter(params.district);
  const cropId = textFilter(params.cropId);
  const season = textFilter(params.season);
  const status = parseAllowed(readParam(params.status), cycleStatuses);
  const territoryId = textFilter(params.territoryId);
  const promoterUserId = textFilter(params.promoterUserId);
  const clubEnabled = parseBoolean(readParam(params.clubEnabled));
  const promoterPage = positiveInteger(readParam(params.promoterPage), 1);
  const [cropResult, promoterResult] = await Promise.all([
    loadKisanClubCropSummary({
      ...(state ? { state } : {}),
      ...(district ? { district } : {}),
      ...(cropId ? { cropId } : {}),
      ...(season ? { season } : {}),
      ...(status ? { status } : {}),
    }),
    loadKisanClubPromoterPerformance({
      ...(territoryId ? { territoryId } : {}),
      ...(promoterUserId ? { promoterUserId } : {}),
      ...(clubEnabled !== undefined ? { clubEnabled } : {}),
      page: promoterPage,
      limit: promoterLimit,
    }),
  ]);

  return (
    <BusinessShell
      active="kisanIntelligence"
      eyebrow="Aggregate pilot intelligence"
      statuses={[
        {
          label: cropResult.ok
            ? `${cropResult.data.totals.areaAcres} acres reported`
            : 'Crop data unavailable',
          tone: cropResult.ok ? 'ok' : 'danger',
        },
        {
          label: promoterResult.ok
            ? `${promoterResult.data.total} promoter profiles`
            : 'Promoter data unavailable',
          tone: promoterResult.ok ? 'ok' : 'danger',
        },
      ]}
      title="Club Intelligence"
    >
      <section className="panel">
        <p className="eyebrow">Pilot boundary</p>
        <p className="mutedText">
          These are current operational aggregates from registered Club farms and assignments.
          Demand forecasting is deliberately deferred until completed-season conversion history
          exists. No farmer identity or precise location is exposed here.
        </p>
      </section>

      <CropWorkspace
        cropId={cropId}
        district={district}
        error={cropResult.ok ? undefined : cropResult.error}
        season={season}
        state={state}
        status={status}
        summary={cropResult.ok ? cropResult.data : undefined}
      />
      <PromoterWorkspace
        clubEnabled={clubEnabled}
        error={promoterResult.ok ? undefined : promoterResult.error}
        performance={promoterResult.ok ? promoterResult.data : undefined}
        promoterPage={promoterPage}
        promoterUserId={promoterUserId}
        searchParams={params}
        territoryId={territoryId}
      />
    </BusinessShell>
  );
}

function CropWorkspace({
  summary,
  error,
  state,
  district,
  cropId,
  season,
  status,
}: {
  summary: KisanClubCropSummary | undefined;
  error: string | undefined;
  state: string | undefined;
  district: string | undefined;
  cropId: string | undefined;
  season: string | undefined;
  status: CropCycleStatus | undefined;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Farm and crop registry</p>
            <h3>Crop and acreage summary</h3>
          </div>
          {summary ? (
            <span className="mutedText">Generated {formatDateTime(summary.generatedAt)}</span>
          ) : null}
        </div>
        <form className="filterForm" method="get">
          <label>
            State
            <input defaultValue={state ?? ''} maxLength={120} name="state" />
          </label>
          <label>
            District
            <input defaultValue={district ?? ''} maxLength={120} name="district" />
          </label>
          <label>
            Crop UUID
            <input defaultValue={cropId ?? ''} name="cropId" />
          </label>
          <label>
            Season
            <input defaultValue={season ?? ''} maxLength={80} name="season" />
          </label>
          <label>
            Cycle status
            <select defaultValue={status ?? ''} name="status">
              <option value="">All statuses</option>
              {cycleStatuses.map((value) => (
                <option key={value} value={value}>
                  {labelFromCode(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter crop data
          </button>
        </form>
      </section>
      {error ? <ErrorPanel title="Unable to load crop intelligence" error={error} /> : null}
      {summary ? (
        <>
          <section className="metricStrip" aria-label="Crop intelligence totals">
            <Metric
              label="Registered acreage"
              value={`${formatNumber(summary.totals.areaAcres)} ac`}
            />
            <Metric label="Farms represented" value={formatNumber(summary.totals.farmCount)} />
            <Metric label="Crop cycles" value={formatNumber(summary.totals.cropCycleCount)} />
            <Metric label="Crops represented" value={formatNumber(summary.totals.cropCount)} />
          </section>
          <p className="mutedText">{summary.scopeNote}</p>
          <section className="panel">
            <h3>Acreage by crop and district</h3>
            <DataTable<KisanClubCropSummary['byCropDistrict'][number]>
              caption="Acreage grouped by crop and district"
              columns={[
                {
                  key: 'crop',
                  header: 'Crop',
                  render: (item) => `${item.cropNameEn} (${item.cropCode})`,
                },
                { key: 'district', header: 'District', render: (item) => item.district },
                { key: 'state', header: 'State', render: (item) => item.state },
                { key: 'cycles', header: 'Cycles', render: (item) => item.cycleCount },
                {
                  key: 'acreage',
                  header: 'Acreage',
                  render: (item) => `${formatNumber(item.areaAcres)} ac`,
                },
              ]}
              emptyDescription="No crop and district aggregates match the selected filters."
              emptyTitle="No acreage aggregates"
              rowKey={(item) => `${item.cropId}-${item.state}-${item.district}`}
              rows={summary.byCropDistrict}
            />
          </section>
          <div className="dashboardGrid">
            <AggregateTable
              title="Cycle status mix"
              rows={summary.byCycleStatus.map((item) => ({
                label: labelFromCode(item.status),
                count: item.cycleCount,
                area: item.areaAcres,
              }))}
            />
            <AggregateTable
              title="Sowing-window distribution"
              rows={summary.bySowingMonth.map((item) => ({
                label: item.month === 'NOT_RECORDED' ? 'Not recorded' : item.month,
                count: item.cycleCount,
                area: item.areaAcres,
              }))}
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function PromoterWorkspace({
  performance,
  error,
  territoryId,
  promoterUserId,
  clubEnabled,
  promoterPage,
  searchParams,
}: {
  performance: KisanClubPromoterPerformance | undefined;
  error: string | undefined;
  territoryId: string | undefined;
  promoterUserId: string | undefined;
  clubEnabled: boolean | undefined;
  promoterPage: number;
  searchParams: SearchParams;
}) {
  return (
    <>
      <section className="panel">
        <p className="eyebrow">Current-holder snapshot</p>
        <h3>Promoter operations</h3>
        <form className="filterForm" method="get">
          <label>
            Territory UUID
            <input defaultValue={territoryId ?? ''} name="territoryId" />
          </label>
          <label>
            Promoter user UUID
            <input defaultValue={promoterUserId ?? ''} name="promoterUserId" />
          </label>
          <label>
            Club status
            <select
              defaultValue={clubEnabled === undefined ? '' : String(clubEnabled)}
              name="clubEnabled"
            >
              <option value="">All profiles</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter promoters
          </button>
        </form>
      </section>
      {error ? <ErrorPanel title="Unable to load promoter intelligence" error={error} /> : null}
      {performance ? (
        <>
          <section className="metricStrip" aria-label="Visible promoter metrics">
            <Metric
              label="Profiles on this page"
              value={formatNumber(performance.pageSummary.profileCount)}
            />
            <Metric
              label="Active farmers"
              value={formatNumber(performance.pageSummary.activeFarmerCount)}
            />
            <Metric
              label="Visible capacity"
              value={formatNumber(performance.pageSummary.totalCapacity)}
            />
            <Metric
              label="Resolved completion"
              value={formatBps(performance.pageSummary.resolvedCompletionRateBps)}
            />
          </section>
          <p className="mutedText">{performance.scopeNote}</p>
          <section className="panel">
            <DataTable<KisanClubPromoterPerformance['items'][number]>
              caption="Paged Kisan Club promoter performance"
              columns={[
                {
                  key: 'promoter',
                  header: 'Promoter',
                  render: (item) => (
                    <>
                      {item.promoterName ?? item.promoterUserId}
                      <br />
                      <span className="mutedText">{item.promoterOrganisation.displayName}</span>
                    </>
                  ),
                },
                {
                  key: 'territory',
                  header: 'Territory',
                  render: (item) => item.territory?.name ?? 'Unassigned',
                },
                {
                  key: 'capacity',
                  header: 'Farmers / capacity',
                  render: (item) => (
                    <>
                      {item.activeFarmerCount} / {item.maxActiveFarmers}
                      <br />
                      <span className="mutedText">{item.remainingCapacity} remaining</span>
                    </>
                  ),
                },
                {
                  key: 'coordination',
                  header: 'Coordination',
                  render: (item) =>
                    `${item.fulfilment.completedCount} completed · ${item.fulfilment.failedCount} failed · ${item.fulfilment.activeCount} active`,
                },
                {
                  key: 'completion',
                  header: 'Resolved completion',
                  render: (item) => formatBps(item.fulfilment.resolvedCompletionRateBps),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (item) => (
                    <StatusBadge
                      label={item.clubEnabled ? 'Club enabled' : 'Disabled'}
                      tone={item.clubEnabled ? 'ok' : 'warn'}
                    />
                  ),
                },
              ]}
              emptyDescription="No promoter profiles match the selected filters."
              emptyTitle="No promoter performance"
              rowKey={(item) => item.promoterUserId}
              rows={performance.items}
            />
          </section>
          <Pagination
            buildHref={(targetPage) => pageHref(searchParams, targetPage)}
            limit={performance.limit}
            page={promoterPage}
            total={performance.total}
          />
        </>
      ) : null}
    </>
  );
}

function AggregateTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number; area: number }>;
}) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <DataTable<(typeof rows)[number]>
        caption={title}
        columns={[
          { key: 'group', header: 'Group', render: (row) => row.label },
          { key: 'cycles', header: 'Cycles', render: (row) => row.count },
          {
            key: 'acreage',
            header: 'Acreage',
            render: (row) => `${formatNumber(row.area)} ac`,
          },
        ]}
        emptyDescription="No aggregate rows match the selected crop filters."
        emptyTitle="No aggregate data"
        rowKey={(row) => row.label}
        rows={rows}
      />
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metricCard">
      <p className="metricValue">{value}</p>
      <p className="metricLabel">{label}</p>
    </article>
  );
}
function ErrorPanel({ title, error }: { title: string; error: string }) {
  return <EmptyState description={error} title={title} />;
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value);
}
function formatBps(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'Not enough resolved work'
    : `${(value / 100).toFixed(2)}%`;
}
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function textFilter(value: string | string[] | undefined): string | undefined {
  return readParam(value)?.trim() || undefined;
}
function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function parseAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
function parseBoolean(value: string | undefined): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}
function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const key of [
    'state',
    'district',
    'cropId',
    'season',
    'status',
    'territoryId',
    'promoterUserId',
    'clubEnabled',
  ]) {
    const value = readParam(params[key]);
    if (value) query.set(key, value);
  }
  query.set('promoterPage', String(page));
  return `/kisan-club/intelligence?${query.toString()}`;
}
