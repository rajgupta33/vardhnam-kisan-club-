import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadUser,
  type PortalUserDetail,
  type PortalUserStatus,
} from '../../../lib/marketplace-api';
import { updateUserAction } from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { userId } = await params;
  const resolved = (await searchParams) ?? {};
  const [result, session] = await Promise.all([loadUser(userId), readPortalSession()]);
  if (!result.ok && result.error.toLowerCase().includes('not found')) {
    notFound();
  }
  const user = result.ok ? result.data : undefined;
  const canUpdate = session?.permissions.includes('users:update:any') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Users API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell active="users" eyebrow="User administration" statuses={statuses} title="User">
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/users">
          Back to users
        </Link>
      </div>

      {!result.ok || !user ? (
        <EmptyState
          description={result.ok ? 'Unknown error' : result.error}
          title="User could not be loaded"
        />
      ) : (
        <section className="detailGrid">
          <article className="panel spanTwo">
            <div className="rowHeader">
              <div>
                <p className="eyebrow">{user.id}</p>
                <h3>{user.profile?.displayName ?? 'Unnamed user'}</h3>
              </div>
              <StatusBadge label={labelFromCode(user.status)} tone={statusTone(user.status)} />
            </div>
            <dl className="definitionGrid threeColumn">
              <DetailField label="Email" value={user.email ?? 'Not recorded'} />
              <DetailField label="Phone" value={user.phone ?? 'Not recorded'} />
              <DetailField label="Locale" value={user.profile?.preferredLocale ?? 'Not recorded'} />
              <DetailField label="Timezone" value={user.profile?.timezone ?? 'Not recorded'} />
              <DetailField label="Created" value={formatDateTime(user.createdAt)} />
            </dl>

            <div className="rowHeader compact">
              <h3>Memberships</h3>
            </div>
            <DataTable<PortalUserDetail['memberships'][number]>
              caption="Organisation memberships for this user"
              columns={[
                {
                  key: 'organisation',
                  header: 'Organisation',
                  render: (membership) => (
                    <Link className="textLink" href={`/organisations/${membership.organisationId}`}>
                      {membership.organisation.displayName}
                    </Link>
                  ),
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (membership) => labelFromCode(membership.role),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (membership) => (
                    <StatusBadge
                      label={labelFromCode(membership.status)}
                      tone={membership.status === 'ACTIVE' ? 'ok' : 'danger'}
                    />
                  ),
                },
              ]}
              emptyDescription="This user does not belong to an organisation."
              emptyTitle="No organisation memberships"
              rowKey={(membership) => membership.id}
              rows={user.memberships}
            />
            <p className="mutedText">
              Manage a specific membership from its{' '}
              <Link className="textLink" href="/organisations">
                organisation page
              </Link>
              .
            </p>
          </article>

          {canUpdate ? (
            <article className="panel">
              <p className="eyebrow">Administration</p>
              <h3>Update User</h3>
              <form action={updateUserAction} className="decisionForm">
                <input name="userId" type="hidden" value={user.id} />
                <label>
                  Display name
                  <input
                    defaultValue={user.profile?.displayName ?? ''}
                    minLength={2}
                    name="displayName"
                    type="text"
                  />
                </label>
                <label>
                  Email
                  <input defaultValue={user.email ?? ''} name="email" type="email" />
                </label>
                <label>
                  Phone
                  <input defaultValue={user.phone ?? ''} name="phone" type="text" />
                </label>
                <label>
                  Status
                  <select defaultValue={user.status} name="status">
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </select>
                </label>
                <label>
                  Reason
                  <input name="reason" placeholder="Required when changing status" type="text" />
                </label>
                <ConfirmSubmitButton confirmMessage="Save these changes to the user account?">
                  Save changes
                </ConfirmSubmitButton>
              </form>
            </article>
          ) : null}
        </section>
      )}
    </BusinessShell>
  );
}

function statusTone(status: PortalUserStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  return 'danger';
}

function DetailField({ label, value }: { label: string; value: string }) {
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
