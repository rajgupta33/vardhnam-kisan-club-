import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadOrganisation, type PortalMembership } from '../../../lib/marketplace-api';
import {
  createMembershipAction,
  updateMembershipAction,
  updateOrganisationAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const platformRoles = [
  'FARMER',
  'PROMOTER',
  'SALES_PARTNER',
  'DISTRIBUTOR_OWNER',
  'DISTRIBUTOR_STAFF',
  'COMPANY_OWNER',
  'COMPANY_STAFF',
  'SERVICE_PROVIDER',
  'DELIVERY_PARTNER',
  'SUPPORT_AGENT',
  'OPERATIONS_MANAGER',
  'FINANCE_MANAGER',
  'CATALOGUE_REVIEWER',
  'AGRONOMIST',
  'ADMIN',
  'SUPER_ADMIN',
];

export default async function OrganisationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { organisationId } = await params;
  const resolved = (await searchParams) ?? {};
  const [result, session] = await Promise.all([
    loadOrganisation(organisationId),
    readPortalSession(),
  ]);
  if (!result.ok && result.error.toLowerCase().includes('not found')) {
    notFound();
  }
  const organisation = result.ok ? result.data : undefined;
  const canUpdate = session?.permissions.includes('organisations:update:any') ?? false;
  const canCreateMembership = session?.permissions.includes('memberships:create') ?? false;
  const canUpdateMemberships = session?.permissions.includes('memberships:update:any') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Organisations API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="organisations"
      eyebrow="Organisation directory"
      statuses={statuses}
      title="Organisation"
    >
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/organisations">
          Back to organisations
        </Link>
      </div>

      {!result.ok || !organisation ? (
        <EmptyState
          description={result.ok ? 'Unknown error' : result.error}
          title="Organisation could not be loaded"
        />
      ) : (
        <>
          <section className="detailGrid">
            <article className="panel spanTwo">
              <div className="rowHeader">
                <div>
                  <p className="eyebrow">{labelFromCode(organisation.type)}</p>
                  <h3>{organisation.displayName}</h3>
                </div>
                <StatusBadge
                  label={labelFromCode(organisation.status)}
                  tone={orgStatusTone(organisation.status)}
                />
              </div>
              <dl className="definitionGrid threeColumn">
                <DetailField label="Legal name" value={organisation.legalName} />
                <DetailField label="Slug" value={organisation.slug} />
                <DetailField label="GSTIN" value={organisation.gstin ?? 'Not recorded'} />
                <DetailField
                  label="Registered state"
                  value={organisation.registeredStateCode ?? 'Not recorded'}
                />
                <DetailField label="Created" value={formatDateTime(organisation.createdAt)} />
                <DetailField
                  label="Last reviewed"
                  value={formatDateTime(organisation.reviewedAt)}
                />
                {organisation.reviewReason ? (
                  <DetailField label="Review reason" value={organisation.reviewReason} />
                ) : null}
              </dl>
              {organisation.status === 'PENDING_VERIFICATION' ? (
                <p className="mutedText">
                  This organisation is awaiting KYC approval in the{' '}
                  <Link className="textLink" href={`/onboarding/${organisation.id}`}>
                    onboarding queue
                  </Link>
                  . Approve or reject it there; this page edits its profile after approval.
                </p>
              ) : null}
            </article>

            {canUpdate ? (
              <article className="panel">
                <p className="eyebrow">Profile</p>
                <h3>Update Organisation</h3>
                <form action={updateOrganisationAction} className="decisionForm">
                  <input name="organisationId" type="hidden" value={organisation.id} />
                  <label>
                    Legal name
                    <input
                      defaultValue={organisation.legalName}
                      minLength={2}
                      name="legalName"
                      type="text"
                    />
                  </label>
                  <label>
                    Display name
                    <input
                      defaultValue={organisation.displayName}
                      minLength={2}
                      name="displayName"
                      type="text"
                    />
                  </label>
                  <label>
                    Slug
                    <input
                      defaultValue={organisation.slug}
                      name="slug"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      type="text"
                    />
                  </label>
                  <label>
                    GSTIN
                    <input defaultValue={organisation.gstin ?? ''} name="gstin" type="text" />
                  </label>
                  <label>
                    Reason
                    <input name="reason" placeholder="Why this change is being made" type="text" />
                  </label>
                  <ConfirmSubmitButton confirmMessage="Save these organisation profile changes?">
                    Save changes
                  </ConfirmSubmitButton>
                </form>
              </article>
            ) : null}
          </section>

          <section className="panel">
            <div className="rowHeader compact">
              <h3>Memberships</h3>
            </div>
            <DataTable<PortalMembership>
              caption={`Memberships for ${organisation.displayName}`}
              columns={membershipColumns(organisation.id, canUpdateMemberships)}
              emptyDescription="No users belong to this organisation yet."
              emptyTitle="No memberships"
              rowKey={(membership) => membership.id}
              rows={organisation.memberships}
            />

            {canCreateMembership ? (
              <form action={createMembershipAction} className="inlineForm">
                <input name="organisationId" type="hidden" value={organisation.id} />
                <label>
                  User ID
                  <input name="userId" required type="text" />
                </label>
                <label>
                  Role
                  <select defaultValue="DISTRIBUTOR_STAFF" name="role" required>
                    {platformRoles.map((role) => (
                      <option key={role} value={role}>
                        {labelFromCode(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <ConfirmSubmitButton confirmMessage="Add this user to the organisation with the selected role?">
                  Add membership
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function membershipColumns(
  organisationId: string,
  canManage: boolean,
): DataTableColumn<PortalMembership>[] {
  const columns: DataTableColumn<PortalMembership>[] = [
    {
      key: 'user',
      header: 'User',
      render: (membership) => membership.user?.profile?.displayName ?? membership.userId,
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
          tone={membershipStatusTone(membership.status)}
        />
      ),
    },
    {
      key: 'since',
      header: 'Since',
      render: (membership) => formatDateTime(membership.createdAt),
    },
  ];
  if (canManage) {
    columns.push({
      key: 'action',
      header: '',
      render: (membership) => (
        <MembershipAction membership={membership} organisationId={organisationId} />
      ),
    });
  }
  return columns;
}

function MembershipAction({
  membership,
  organisationId,
}: {
  membership: PortalMembership;
  organisationId: string;
}) {
  if (membership.status === 'REMOVED') return null;
  const nextStatus = membership.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
  return (
    <form action={updateMembershipAction} className="inlineForm">
      <input name="organisationId" type="hidden" value={organisationId} />
      <input name="membershipId" type="hidden" value={membership.id} />
      <input name="status" type="hidden" value={nextStatus} />
      <input name="reason" placeholder="Reason" required type="text" />
      <ConfirmSubmitButton
        className={nextStatus === 'SUSPENDED' ? 'dangerButton' : 'primaryButton'}
        confirmMessage={
          nextStatus === 'SUSPENDED'
            ? 'Suspend this membership? The user will lose access through this organisation.'
            : 'Reactivate this membership?'
        }
      >
        {nextStatus === 'SUSPENDED' ? 'Suspend' : 'Reactivate'}
      </ConfirmSubmitButton>
    </form>
  );
}

function orgStatusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  return 'warn';
}

function membershipStatusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'SUSPENDED' || status === 'REMOVED') return 'danger';
  return 'warn';
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
