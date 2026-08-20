import Link from 'next/link';
import type { AuditLog } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadAuditLogs } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface AuditPageProps {
  searchParams?: Promise<SearchParams>;
}

const commonActions = [
  'ORGANISATION_APPROVED',
  'ORGANISATION_REJECTED',
  'KYC_DOCUMENT_REVIEWED',
  'KYC_DOCUMENT_RESUBMITTED',
  'COMPANY_PROFILE_UPDATED',
  'DISTRIBUTOR_PROFILE_UPDATED',
] as const;
const limit = 50;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const action = readParam(resolvedSearchParams.action);
  const resourceType = readParam(resolvedSearchParams.resourceType);
  const organisationId = readParam(resolvedSearchParams.organisationId);
  const page = parsePage(readParam(resolvedSearchParams.page));
  const auditQuery = {
    page,
    limit,
    ...(action ? { action } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(organisationId ? { organisationId } : {}),
  };
  const result = await loadAuditLogs(auditQuery);
  const entries = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;
  const columns: DataTableColumn<AuditLog>[] = [
    { key: 'time', header: 'Time', render: (entry) => formatDateTime(entry.createdAt) },
    { key: 'action', header: 'Action', render: (entry) => labelFromCode(entry.action) },
    {
      key: 'actorRole',
      header: 'Actor role',
      render: (entry) => (entry.actorRole ? labelFromCode(entry.actorRole) : 'System'),
    },
    {
      key: 'organisation',
      header: 'Organisation',
      render: (entry) =>
        entry.organisationId ? (
          <Link className="textLink" href={`/onboarding/${entry.organisationId}`}>
            {entry.organisationId}
          </Link>
        ) : (
          'Not recorded'
        ),
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (entry) => `${entry.resourceType}${entry.resourceId ? ` / ${entry.resourceId}` : ''}`,
    },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
    { key: 'request', header: 'Request', render: (entry) => entry.requestId ?? 'Not recorded' },
  ];
  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? `${result.data.total} matching events` : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Append-only view', tone: 'ok' as const },
  ];

  return (
    <BusinessShell active="audit" eyebrow="Audit" statuses={statuses} title="Audit Log View">
      <section className="panel">
        <form className="filterForm" method="get">
          <label>
            Action
            <select defaultValue={action ?? ''} name="action">
              <option value="">All actions</option>
              {commonActions.map((value) => (
                <option key={value} value={value}>
                  {labelFromCode(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resource
            <select defaultValue={resourceType ?? ''} name="resourceType">
              <option value="">All resources</option>
              <option value="Organisation">Organisation</option>
              <option value="KycDocument">KYC document</option>
              <option value="CompanyProfile">Company profile</option>
              <option value="DistributorProfile">Distributor profile</option>
            </select>
          </label>
          <label>
            Organisation ID
            <input
              defaultValue={organisationId ?? ''}
              name="organisationId"
              placeholder="Organisation UUID"
              type="search"
            />
          </label>
          <div className="formActions">
            <button className="primaryButton" type="submit">
              Apply Filters
            </button>
            <Link className="textLink" href="/audit">
              Clear
            </Link>
          </div>
        </form>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Audit Log Unavailable" />
      ) : (
        <section className="auditPreview" aria-label="Audit log entries">
          <DataTable
            caption="Audit log entries"
            columns={columns}
            emptyDescription="Audit events matching the selected filters will appear here."
            emptyTitle="No audit entries"
            rowKey={(entry) => entry.id}
            rows={entries}
          />
          <Pagination
            buildHref={(targetPage) =>
              buildAuditHref(action, resourceType, organisationId, targetPage)
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

function buildAuditHref(
  action: string | undefined,
  resourceType: string | undefined,
  organisationId: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (action) params.set('action', action);
  if (resourceType) params.set('resourceType', resourceType);
  if (organisationId) params.set('organisationId', organisationId);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/audit?${query}` : '/audit';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
