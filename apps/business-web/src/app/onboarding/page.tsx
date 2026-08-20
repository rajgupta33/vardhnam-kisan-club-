import Link from 'next/link';
import type {
  AuditLog,
  OnboardingQueueItem,
  OrganisationStatus,
  OrganisationType,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadApprovalQueue, loadAuditLogs } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type OnboardingTypeFilter = Extract<OrganisationType, 'COMPANY' | 'DISTRIBUTOR'>;

interface OnboardingQueuePageProps {
  searchParams?: Promise<SearchParams>;
}

const statusFilterValues: OrganisationStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
];
const limit = 25;

export default async function OnboardingQueuePage({ searchParams }: OnboardingQueuePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const type = parseOnboardingType(readParam(resolvedSearchParams.type));
  const status = parseStatus(readParam(resolvedSearchParams.status)) ?? 'PENDING_VERIFICATION';
  const page = parsePage(readParam(resolvedSearchParams.page));
  const approvalQueueQuery = {
    status,
    page,
    limit,
    ...(type ? { type } : {}),
  };
  const queueResult = await loadApprovalQueue(approvalQueueQuery);
  const auditResult = await loadAuditLogs({ page: 1, limit: 6 });
  const queueItems = queueResult.ok ? queueResult.data.items : [];
  const queueTotal = queueResult.ok ? queueResult.data.total : 0;
  const readyCount = queueItems.filter((item) => item.missingRequirements.length === 0).length;
  const blockedCount = queueItems.length - readyCount;
  const auditColumns: DataTableColumn<AuditLog>[] = [
    { key: 'time', header: 'Time', render: (entry) => formatDateTime(entry.createdAt) },
    { key: 'action', header: 'Action', render: (entry) => labelFromCode(entry.action) },
    { key: 'resource', header: 'Resource', render: (entry) => entry.resourceType },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
  ];
  const statuses = [
    {
      label: queueResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: queueResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: queueResult.ok ? `${queueItems.length} queue items` : 'API not connected',
      tone: queueResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Provider mocks only', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="onboarding"
      eyebrow="Operations manager"
      statuses={statuses}
      title="Onboarding Approval Queue"
    >
      <section className="metricStrip" aria-label="Onboarding queue metrics">
        <article className="metricCard">
          <p className="metricValue">{queueItems.length}</p>
          <p className="metricLabel">Filtered organisations</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{readyCount}</p>
          <p className="metricLabel">Ready for organisation approval</p>
        </article>
        <article className="metricCard">
          <p className="metricValue">{blockedCount}</p>
          <p className="metricLabel">Missing profile or approved KYC</p>
        </article>
      </section>

      <section className="toolbar" aria-label="Onboarding filters">
        <div className="segmentedControl">
          <FilterLink active={!type} href={buildQueueHref(undefined, status, 1)} label="All" />
          <FilterLink
            active={type === 'COMPANY'}
            href={buildQueueHref('COMPANY', status, 1)}
            label="Companies"
          />
          <FilterLink
            active={type === 'DISTRIBUTOR'}
            href={buildQueueHref('DISTRIBUTOR', status, 1)}
            label="Distributors"
          />
        </div>
        <div className="segmentedControl">
          {statusFilterValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildQueueHref(type, statusValue, 1)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
      </section>

      {!queueResult.ok ? (
        <ConnectionPanel
          error={queueResult.error}
          missingVariables={queueResult.config.missingVariables}
        />
      ) : (
        <section className="queueList" aria-label="Onboarding organisations">
          {queueItems.length === 0 ? (
            <EmptyState
              description="Company and distributor onboarding records matching this filter will appear here."
              title="No organisations in this filter"
            />
          ) : (
            queueItems.map((item) => <QueueItemCard item={item} key={item.organisation.id} />)
          )}
          <Pagination
            buildHref={(targetPage) => buildQueueHref(type, status, targetPage)}
            limit={limit}
            page={page}
            total={queueTotal}
          />
        </section>
      )}

      <section className="auditPreview" aria-label="Recent audit activity">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Audit</p>
            <h3>Recent Review Activity</h3>
          </div>
          <Link className="textLink" href="/audit">
            Open audit view
          </Link>
        </div>
        {!auditResult.ok ? (
          <EmptyState
            description={auditResult.error}
            title="Recent audit activity is unavailable"
          />
        ) : (
          <DataTable
            caption="Recent onboarding audit activity"
            columns={auditColumns}
            emptyDescription="Onboarding review events will appear here."
            emptyTitle="No recent review activity"
            rowKey={(entry) => entry.id}
            rows={auditResult.data.items}
          />
        )}
      </section>
    </BusinessShell>
  );
}

function QueueItemCard({ item }: { item: OnboardingQueueItem }) {
  const profile =
    item.organisation.type === 'COMPANY'
      ? item.organisation.companyProfile
      : item.organisation.distributorProfile;
  const location = [profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ');

  return (
    <article className="queueCard reviewCard">
      <div className="queueCardMain">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{labelFromCode(item.organisation.type)}</p>
            <h3>{item.organisation.displayName}</h3>
          </div>
          <StatusBadge
            label={labelFromCode(item.organisation.status)}
            tone={organisationStatusTone(item.organisation.status)}
          />
        </div>
        <dl className="definitionGrid">
          <div>
            <dt>Legal name</dt>
            <dd>{item.organisation.legalName}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{location || 'Not recorded'}</dd>
          </div>
          <div>
            <dt>KYC metadata</dt>
            <dd>
              {item.approvedDocumentCount} approved / {item.submittedDocumentCount} submitted
            </dd>
          </div>
        </dl>
        <div className="requirementList">
          {item.missingRequirements.length === 0 ? (
            <StatusBadge label="Ready" tone="ok" />
          ) : (
            item.missingRequirements.map((requirement) => (
              <StatusBadge
                key={requirement}
                label={`Missing ${labelFromCode(requirement)}`}
                tone="warn"
              />
            ))
          )}
        </div>
      </div>
      <Link className="queueAction" href={`/onboarding/${item.organisation.id}`}>
        Review
      </Link>
    </article>
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

function ConnectionPanel({
  error,
  missingVariables,
}: {
  error: string;
  missingVariables: string[];
}) {
  return (
    <section className="emptyState" aria-label="API connection status">
      <h3>Business API Connection Blocked</h3>
      <p className="mutedText">{error}</p>
      {missingVariables.length > 0 ? (
        <ul className="compactList">
          {missingVariables.map((variable) => (
            <li key={variable}>{variable}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function buildQueueHref(
  type: OnboardingTypeFilter | undefined,
  status: OrganisationStatus,
  page: number,
): string {
  const params = new URLSearchParams({ status });
  if (type) {
    params.set('type', type);
  }
  if (page > 1) {
    params.set('page', String(page));
  }

  return `/onboarding?${params.toString()}`;
}

function organisationStatusTone(status: OrganisationStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  return 'warn';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOnboardingType(value: string | undefined): OnboardingTypeFilter | undefined {
  return value === 'COMPANY' || value === 'DISTRIBUTOR' ? value : undefined;
}

function parseStatus(value: string | undefined): OrganisationStatus | undefined {
  return statusFilterValues.includes(value as OrganisationStatus)
    ? (value as OrganisationStatus)
    : undefined;
}
