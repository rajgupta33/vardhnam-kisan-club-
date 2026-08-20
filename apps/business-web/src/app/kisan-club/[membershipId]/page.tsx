import Link from 'next/link';
import type { KisanClubMembership } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadKisanClubMembership } from '../../../lib/marketplace-api';
import { suspendKisanClubMembershipAction } from '../actions';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;

export default async function KisanClubMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ membershipId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { membershipId } = await params;
  const query = (await searchParams) ?? {};
  const [result, session] = await Promise.all([
    loadKisanClubMembership(membershipId),
    readPortalSession(),
  ]);
  const canManage = session?.permissions.includes('kisan-club-memberships:manage') ?? false;

  return (
    <BusinessShell
      active="kisanClub"
      eyebrow="Kisan Club member operations"
      statuses={[
        {
          label: result.ok ? labelFromCode(result.data.status) : 'Member unavailable',
          tone: result.ok ? statusTone(result.data.status) : 'danger',
        },
      ]}
      title={result.ok ? result.data.farmerProfile.fullName : 'Club Member'}
    >
      {readParam(query.notice) ? (
        <p className="noticeBanner ok">{readParam(query.notice)}</p>
      ) : null}
      {readParam(query.error) ? (
        <p className="noticeBanner danger">{readParam(query.error)}</p>
      ) : null}
      {!result.ok ? (
        <EmptyState description={result.error} title="Unable to load member" />
      ) : (
        <MemberDetail member={result.data} canManage={canManage} />
      )}
    </BusinessShell>
  );
}

function MemberDetail({ member, canManage }: { member: KisanClubMembership; canManage: boolean }) {
  const canSuspend = canManage && member.status !== 'SUSPENDED' && member.status !== 'CLOSED';
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{member.memberNumber}</p>
            <h3>{member.farmerProfile.fullName}</h3>
          </div>
          <StatusBadge label={labelFromCode(member.status)} tone={statusTone(member.status)} />
        </div>
        <dl className="definitionGrid threeColumn">
          <Detail
            label="Home"
            value={
              [member.homeVillage, member.homeDistrict, member.homeState]
                .filter(Boolean)
                .join(', ') || 'Not completed'
            }
          />
          <Detail label="Pincode" value={member.homePincode} />
          <Detail label="Preferred locale" value={member.farmerProfile.preferredLocale} />
          <Detail label="Joined" value={formatDateTime(member.joinedAt)} />
          <Detail label="Terms version" value={member.termsVersion} />
          <Detail label="Terms accepted" value={formatDateTime(member.termsAcceptedAt)} />
          <Detail
            label="Advisory consent"
            value={consentLabel(member.advisoryConsent, member.advisoryConsentAt)}
          />
          <Detail
            label="Marketing consent"
            value={consentLabel(member.marketingConsent, member.marketingConsentAt)}
          />
          <Detail
            label="Precise location consent"
            value={consentLabel(member.preciseLocationConsent, member.preciseLocationConsentAt)}
          />
          {member.suspendedReason ? (
            <Detail label="Suspension reason" value={member.suspendedReason} />
          ) : null}
          {member.closedAt ? (
            <Detail label="Closed" value={formatDateTime(member.closedAt)} />
          ) : null}
        </dl>
      </section>

      {canSuspend ? (
        <form action={suspendKisanClubMembershipAction} className="panel rejectForm">
          <div>
            <p className="eyebrow">Restricted operation</p>
            <h3>Suspend membership</h3>
          </div>
          <p className="mutedText">
            Suspension makes the Club profile read-only and ends its active promoter assignment. The
            reason is written to the append-only audit log.
          </p>
          <input name="membershipId" type="hidden" value={member.id} />
          <label>
            Operational reason
            <input maxLength={500} minLength={3} name="reason" required />
          </label>
          <label>
            <input name="confirmation" required type="checkbox" value="SUSPEND" /> I confirm this
            membership should be suspended.
          </label>
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Suspend this Kisan Club membership and end its active promoter assignment?"
          >
            Suspend membership
          </ConfirmSubmitButton>
        </form>
      ) : null}

      <Link className="textLink" href="/kisan-club">
        Back to members
      </Link>
    </>
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

function consentLabel(granted: boolean, grantedAt?: string | null): string {
  return granted ? `Granted ${formatDateTime(grantedAt)}` : 'Not granted';
}

function statusTone(status: KisanClubMembership['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'SUSPENDED' || status === 'CLOSED') return 'danger';
  return 'warn';
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
