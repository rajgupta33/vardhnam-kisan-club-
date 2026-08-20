import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BusinessShell } from '../../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../../components/confirm-submit-button';
import { EmptyState } from '../../../../components/empty-state';
import { StatusBadge } from '../../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../../lib/format';
import { readPortalSession } from '../../../../lib/auth-session';
import { loadPayoutAccountByUserId, type PayoutAccountStatus } from '../../../../lib/marketplace-api';
import { verifyPayoutAccountAction } from '../../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PayoutAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { userId } = await params;
  const resolved = (await searchParams) ?? {};
  const [result, session] = await Promise.all([loadPayoutAccountByUserId(userId), readPortalSession()]);
  if (!result.ok && result.error.toLowerCase().includes('not found')) {
    notFound();
  }
  const account = result.ok ? result.data : undefined;
  const canVerify = session?.permissions.includes('payout-accounts:verify') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Payouts API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell active="payouts" eyebrow="Partner payouts" statuses={statuses} title="Payout Account">
      {readParam(resolved.notice) ? <div className="noticeBanner ok">{readParam(resolved.notice)}</div> : null}
      {readParam(resolved.error) ? <div className="noticeBanner danger">{readParam(resolved.error)}</div> : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/payouts/accounts">
          Back to payout accounts
        </Link>
      </div>

      {!result.ok || !account ? (
        <EmptyState description={result.ok ? 'Unknown error' : result.error} title="Account could not be loaded" />
      ) : (
        <section className="detailGrid">
          <article className="panel spanTwo">
            <div className="rowHeader">
              <div>
                <p className="eyebrow">User {account.userId}</p>
                <h3>{account.accountHolderName}</h3>
              </div>
              <StatusBadge label={labelFromCode(account.status)} tone={statusTone(account.status)} />
            </div>
            <dl className="definitionGrid threeColumn">
              <DetailField label="Bank" value={account.bankName} />
              <DetailField label="Account number" value={account.accountNumber} />
              <DetailField label="IFSC" value={account.ifscCode} />
              <DetailField label="UPI" value={account.upiId ?? 'Not provided'} />
              <DetailField label="Submitted" value={formatDateTime(account.createdAt)} />
              <DetailField label="Reviewed" value={formatDateTime(account.verifiedAt)} />
              {account.rejectionReason ? (
                <DetailField label="Rejection reason" value={account.rejectionReason} />
              ) : null}
            </dl>
          </article>

          {canVerify && account.status === 'PENDING_VERIFICATION' ? (
            <article className="panel">
              <p className="eyebrow">Decision</p>
              <h3>Verify Account</h3>
              <div className="actionCluster">
                <form action={verifyPayoutAccountAction} className="inlineForm">
                  <input name="accountId" type="hidden" value={account.id} />
                  <input name="userId" type="hidden" value={account.userId} />
                  <input name="status" type="hidden" value="VERIFIED" />
                  <ConfirmSubmitButton confirmMessage="Verify this payout account? It will become eligible to receive payouts.">
                    Verify
                  </ConfirmSubmitButton>
                </form>
                <form action={verifyPayoutAccountAction} className="inlineForm">
                  <input name="accountId" type="hidden" value={account.id} />
                  <input name="userId" type="hidden" value={account.userId} />
                  <input name="status" type="hidden" value="REJECTED" />
                  <label>
                    Rejection reason
                    <input name="reason" required type="text" />
                  </label>
                  <ConfirmSubmitButton
                    className="dangerButton"
                    confirmMessage="Reject this payout account? The partner will need to resubmit."
                  >
                    Reject
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ) : null}
        </section>
      )}
    </BusinessShell>
  );
}

function statusTone(status: PayoutAccountStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'VERIFIED') return 'ok';
  if (status === 'REJECTED') return 'danger';
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
