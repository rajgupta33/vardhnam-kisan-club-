import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
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

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const action = readParam(resolvedSearchParams.action);
  const resourceType = readParam(resolvedSearchParams.resourceType);
  const organisationId = readParam(resolvedSearchParams.organisationId);
  const auditQuery = {
    page: 1,
    limit: 50,
    ...(action ? { action } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(organisationId ? { organisationId } : {}),
  };
  const result = await loadAuditLogs(auditQuery);
  const statuses = [
    {
      label: result.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
        <section className="emptyState">
          <h3>Audit Log Unavailable</h3>
          <p className="mutedText">{result.error}</p>
        </section>
      ) : (
        <section className="auditPreview" aria-label="Audit log entries">
          <div className="tableShell">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor role</th>
                  <th>Organisation</th>
                  <th>Resource</th>
                  <th>Reason</th>
                  <th>Request</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No audit entries match these filters.</td>
                  </tr>
                ) : (
                  result.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{labelFromCode(entry.action)}</td>
                      <td>{entry.actorRole ? labelFromCode(entry.actorRole) : 'Not recorded'}</td>
                      <td>
                        {entry.organisationId ? (
                          <Link className="textLink" href={`/onboarding/${entry.organisationId}`}>
                            {entry.organisationId}
                          </Link>
                        ) : (
                          'Not recorded'
                        )}
                      </td>
                      <td>
                        {entry.resourceType}
                        {entry.resourceId ? ` / ${entry.resourceId}` : ''}
                      </td>
                      <td>{entry.reason ?? 'Not recorded'}</td>
                      <td>{entry.requestId ?? 'Not recorded'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </BusinessShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
