import Link from 'next/link';
import type { AdvisoryCategory, AdvisoryRuleStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadAdvisoryRules } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
interface AdvisoryPageProps {
  searchParams?: Promise<SearchParams>;
}

const statuses: AdvisoryRuleStatus[] = [
  'PENDING_REVIEW',
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
];
const categories: AdvisoryCategory[] = [
  'CROP_STAGE',
  'IRRIGATION',
  'NUTRITION',
  'PEST_MONITORING',
  'DISEASE_RISK',
  'HARVEST',
  'GENERAL_PRACTICE',
];
const limit = 50;

export default async function AdvisoryPage({ searchParams }: AdvisoryPageProps) {
  const params = (await searchParams) ?? {};
  const status = parseAllowed(readParam(params.status), statuses);
  const category = parseAllowed(readParam(params.category), categories);
  const page = parsePage(readParam(params.page));
  const result = await loadAdvisoryRules({
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    page,
    limit,
  });
  const rules = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;
  const pendingCount = rules.filter((rule) => rule.status === 'PENDING_REVIEW').length;

  return (
    <BusinessShell
      active="advisory"
      eyebrow="Kisan Club knowledge operations"
      statuses={[
        {
          label: result.config.configured ? 'Authenticated session' : 'Session missing',
          tone: result.config.configured ? 'ok' : 'danger',
        },
        {
          label: result.ok ? `${rules.length} rules loaded` : 'API not connected',
          tone: result.ok ? 'ok' : 'warn',
        },
      ]}
      title="Advisory Rules"
    >
      {readParam(params.notice) ? (
        <p className="noticeBanner ok">{readParam(params.notice)}</p>
      ) : null}
      {readParam(params.error) ? (
        <p className="noticeBanner danger">{readParam(params.error)}</p>
      ) : null}

      <section className="metricStrip" aria-label="Advisory metrics">
        <article className="metricCard">
          <p className="metricValue">{rules.length}</p>
          <p className="metricLabel">Filtered rules</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{pendingCount}</p>
          <p className="metricLabel">Awaiting review</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">2</p>
          <p className="metricLabel">Required languages</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Advisory filters">
        <form className="filterForm" method="get">
          <label>
            Status
            <select defaultValue={status ?? ''} name="status">
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {labelFromCode(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select defaultValue={category ?? ''} name="category">
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {labelFromCode(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="queueAction" type="submit">
            Apply filters
          </button>
        </form>
        <Link className="primaryButton" href="/advisory/new">
          Create advisory
        </Link>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Advisory API unavailable" />
      ) : (
        <section className="queueList" aria-label="Advisory rule queue">
          {rules.length === 0 ? (
            <EmptyState
              description="Create a bilingual rule or change the filters."
              title="No advisory rules"
            />
          ) : (
            rules.map((rule) => (
              <article className="queueCard" key={rule.id}>
                <div className="queueCardMain">
                  <div className="rowHeader">
                    <div>
                      <p className="eyebrow">
                        {rule.cropName}
                        {rule.varietyName ? ` / ${rule.varietyName}` : ''}
                      </p>
                      <h3>{rule.titleEn}</h3>
                      <p className="mutedText" lang="hi">
                        {rule.titleHi}
                      </p>
                    </div>
                    <StatusBadge
                      label={labelFromCode(rule.status)}
                      tone={statusTone(rule.status)}
                    />
                  </div>
                  <dl className="definitionGrid threeColumn">
                    <Detail label="Category" value={labelFromCode(rule.category)} />
                    <Detail
                      label="Crop window"
                      value={`${rule.minDaysAfterSowing}-${rule.maxDaysAfterSowing} days`}
                    />
                    <Detail label="Updated" value={formatDateTime(rule.updatedAt)} />
                  </dl>
                </div>
                <Link className="queueAction" href={`/advisory/${rule.id}`}>
                  {rule.status === 'PENDING_REVIEW' ? 'Review' : 'Open'}
                </Link>
              </article>
            ))
          )}
          <Pagination
            buildHref={(targetPage) => buildAdvisoryHref(status, category, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function buildAdvisoryHref(
  status: AdvisoryRuleStatus | undefined,
  category: AdvisoryCategory | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/advisory?${query}` : '/advisory';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function parseAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
function statusTone(status: AdvisoryRuleStatus): 'ok' | 'warn' | 'danger' {
  return status === 'APPROVED'
    ? 'ok'
    : status === 'REJECTED' || status === 'ARCHIVED'
      ? 'danger'
      : 'warn';
}
