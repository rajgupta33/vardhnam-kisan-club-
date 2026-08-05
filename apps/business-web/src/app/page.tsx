import Link from 'next/link';
import type {
  OnboardingQueueItem,
  OrganisationStatus,
  OrganisationType,
} from '@vardhnam/api-client';
import { BusinessShell } from '../components/business-shell';
import { formatDateTime, labelFromCode } from '../lib/format';
import { loadApprovalQueue, loadAuditLogs } from '../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type OnboardingTypeFilter = Extract<OrganisationType, 'COMPANY' | 'DISTRIBUTOR'>;

interface HomePageProps {
  searchParams?: Promise<SearchParams>;
}

const statusFilterValues: OrganisationStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'REJECTED',
  'SUSPENDED',
];

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const type = parseOnboardingType(readParam(resolvedSearchParams.type));
  const status = parseStatus(readParam(resolvedSearchParams.status)) ?? 'PENDING_VERIFICATION';
  const approvalQueueQuery = {
    status,
    page: 1,
    limit: 25,
    ...(type ? { type } : {}),
  };
  const queueResult = await loadApprovalQueue(approvalQueueQuery);
  const auditResult = await loadAuditLogs({ page: 1, limit: 6 });
  const queueItems = queueResult.ok ? queueResult.data.items : [];
  const readyCount = queueItems.filter((item) => item.missingRequirements.length === 0).length;
  const blockedCount = queueItems.length - readyCount;
  const statuses = [
    {
      label: queueResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
          <FilterLink active={!type} href={buildQueueHref(undefined, status)} label="All" />
          <FilterLink
            active={type === 'COMPANY'}
            href={buildQueueHref('COMPANY', status)}
            label="Companies"
          />
          <FilterLink
            active={type === 'DISTRIBUTOR'}
            href={buildQueueHref('DISTRIBUTOR', status)}
            label="Distributors"
          />
        </div>
        <div className="segmentedControl">
          {statusFilterValues.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildQueueHref(type, statusValue)}
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
            <article className="emptyState">
              <h3>No organisations in this filter</h3>
              <p className="mutedText">
                Pending company and distributor onboarding records will appear here.
              </p>
            </article>
          ) : (
            queueItems.map((item) => <QueueItemCard item={item} key={item.organisation.id} />)
          )}
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
          <StatusBadge status={item.organisation.status} />
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
            <span className="statusBadge ok">Ready</span>
          ) : (
            item.missingRequirements.map((requirement) => (
              <span className="statusBadge warn" key={requirement}>
                Missing {labelFromCode(requirement)}
              </span>
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

function StatusBadge({ status }: { status: OrganisationStatus }) {
  const tone = status === 'ACTIVE' ? 'ok' : status === 'REJECTED' ? 'danger' : 'warn';
  return <span className={`statusBadge ${tone}`}>{labelFromCode(status)}</span>;
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
): string {
  const params = new URLSearchParams({ status });
  if (type) {
    params.set('type', type);
  }

  return `/?${params.toString()}`;
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
