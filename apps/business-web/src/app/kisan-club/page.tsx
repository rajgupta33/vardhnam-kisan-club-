import Link from 'next/link';
import type { KisanClubMembershipStatus } from '@vardhnam/api-client';
import { BusinessShell } from '../../components/business-shell';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadKisanClubMemberships } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 25;
const statuses: KisanClubMembershipStatus[] = [
  'PENDING_PROFILE',
  'AWAITING_PROMOTER',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
];

export default async function KisanClubMembersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const status = parseAllowed(readParam(params.status), statuses);
  const q = readParam(params.q)?.trim() || undefined;
  const page = positiveInteger(readParam(params.page), 1);
  const result = await loadKisanClubMemberships({
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    page,
    limit,
  });
  const members = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;

  return (
    <BusinessShell
      active="kisanClub"
      eyebrow="Kisan Club operations"
      statuses={[
        {
          label: result.ok ? `${total} members found` : 'Member API unavailable',
          tone: result.ok ? 'ok' : 'danger',
        },
      ]}
      title="Club Members"
    >
      <section className="toolbar" aria-label="Member filters">
        <form className="filterForm" method="get">
          <label>
            Search
            <input
              defaultValue={q ?? ''}
              maxLength={120}
              name="q"
              placeholder="Name or member number"
            />
          </label>
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
          <button className="queueAction" type="submit">
            Apply filters
          </button>
        </form>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Unable to load members" />
      ) : members.length === 0 ? (
        <EmptyState description="Change the search or status filter." title="No members match" />
      ) : (
        <section className="queueList" aria-label="Kisan Club member queue">
          {members.map((member) => (
            <article className="queueCard" key={member.id}>
              <div className="queueCardMain">
                <div className="rowHeader">
                  <div>
                    <p className="eyebrow">{member.memberNumber}</p>
                    <h3>{member.farmerProfile.fullName}</h3>
                    <p className="mutedText">{locationLabel(member)}</p>
                  </div>
                  <StatusBadge
                    label={labelFromCode(member.status)}
                    tone={statusTone(member.status)}
                  />
                </div>
                <dl className="definitionGrid threeColumn">
                  <Detail label="Pincode" value={member.homePincode} />
                  <Detail label="Locale" value={member.farmerProfile.preferredLocale} />
                  <Detail label="Joined" value={formatDateTime(member.joinedAt)} />
                </dl>
              </div>
              <Link className="queueAction" href={`/kisan-club/${member.id}`}>
                Open
              </Link>
            </article>
          ))}
        </section>
      )}

      {result.ok ? (
        <Pagination
          buildHref={(targetPage) => pageHref(params, targetPage)}
          limit={limit}
          page={page}
          total={total}
        />
      ) : null}
    </BusinessShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function locationLabel(member: {
  homeVillage?: string | null;
  homeDistrict?: string | null;
  homeState?: string | null;
}) {
  return (
    [member.homeVillage, member.homeDistrict, member.homeState].filter(Boolean).join(', ') ||
    'Location not completed'
  );
}

function statusTone(status: KisanClubMembershipStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'SUSPENDED' || status === 'CLOSED') return 'danger';
  return 'warn';
}

function pageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  const q = readParam(params.q);
  const status = readParam(params.status);
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  query.set('page', String(page));
  return `/kisan-club?${query.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
