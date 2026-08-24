import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, formatPaise, labelFromCode } from '../../../lib/format';
import {
  loadMyPayoutAccount,
  loadMyPayoutStatement,
  type CommissionEntry,
  type CommissionEntryStatus,
} from '../../../lib/marketplace-api';
import { upsertMyPayoutAccountAction } from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 25;

/**
 * The self-service page for whoever is logged in -- their own bank details
 * and their own commission statement. There is no admin-scoped "view any
 * partner's statement" endpoint on the backend (only `GET
 * /payouts/statements/me`), so unlike `/payouts/accounts` this page cannot
 * take a `userId` and never will without a corresponding API change.
 */
export default async function MyPayoutStatementPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const [accountResult, statementResult] = await Promise.all([
    loadMyPayoutAccount(),
    loadMyPayoutStatement({ page, limit }),
  ]);

  const statuses = [
    {
      label: accountResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: accountResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: accountResult.ok ? 'Payouts API connected' : 'API not connected',
      tone: accountResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<CommissionEntry>[] = [
    { key: 'type', header: 'Type', render: (row) => labelFromCode(row.entryType) },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => formatPaise(row.amountPaise),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={labelFromCode(row.status)} tone={entryStatusTone(row.status)} />
      ),
    },
    { key: 'eligible', header: 'Eligible', render: (row) => formatDateTime(row.eligibleAt) },
    { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <BusinessShell active="payouts" eyebrow="My payouts" statuses={statuses} title="My Payout Statement">
      {readParam(resolved.notice) ? <div className="noticeBanner ok">{readParam(resolved.notice)}</div> : null}
      {readParam(resolved.error) ? <div className="noticeBanner danger">{readParam(resolved.error)}</div> : null}

      <section className="panel">
        <p className="eyebrow">Bank details</p>
        <h3>My Payout Account</h3>
        {!accountResult.ok ? (
          <p className="mutedText">{accountResult.error}</p>
        ) : accountResult.data ? (
          <>
            <dl className="definitionGrid threeColumn">
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge
                    label={labelFromCode(accountResult.data.status)}
                    tone={accountStatusTone(accountResult.data.status)}
                  />
                </dd>
              </div>
              <div>
                <dt>Bank</dt>
                <dd>{accountResult.data.bankName}</dd>
              </div>
              <div>
                <dt>Account number</dt>
                <dd>{accountResult.data.accountNumber}</dd>
              </div>
            </dl>
            {accountResult.data.status === 'REJECTED' && accountResult.data.rejectionReason ? (
              <p className="mutedText">Rejected: {accountResult.data.rejectionReason}</p>
            ) : null}
            <p className="mutedText">Resubmitting replaces the details below and returns to pending review.</p>
          </>
        ) : (
          <p className="mutedText">No payout account on file yet. Submit your details below.</p>
        )}
        <form action={upsertMyPayoutAccountAction} className="decisionForm">
          <label>
            Account holder name
            <input
              defaultValue={accountResult.ok ? (accountResult.data?.accountHolderName ?? '') : ''}
              minLength={2}
              name="accountHolderName"
              required
              type="text"
            />
          </label>
          <label>
            Bank name
            <input
              defaultValue={accountResult.ok ? (accountResult.data?.bankName ?? '') : ''}
              minLength={2}
              name="bankName"
              required
              type="text"
            />
          </label>
          <label>
            Account number
            <input name="accountNumber" pattern="[0-9]{6,20}" placeholder="000123456789" required type="text" />
          </label>
          <label>
            IFSC code
            <input name="ifscCode" pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" placeholder="SBIN0001234" required type="text" />
          </label>
          <label>
            UPI ID (optional)
            <input name="upiId" type="text" />
          </label>
          <ConfirmSubmitButton
            confirmMessage={
              accountResult.ok && accountResult.data
                ? 'Resubmit these bank details? The account will return to pending verification.'
                : 'Submit these bank details for payout verification?'
            }
          >
            {accountResult.ok && accountResult.data ? 'Update account' : 'Submit account'}
          </ConfirmSubmitButton>
        </form>
      </section>

      <section className="panel">
        <p className="eyebrow">Commission statement</p>
        <h3>Statement</h3>
        {!statementResult.ok ? (
          <EmptyState description={statementResult.error} title="Statement is unavailable" />
        ) : (
          <>
            {statementResult.data.totalsByStatus.length > 0 ? (
              <section className="metricStrip">
                {statementResult.data.totalsByStatus.map((total) => (
                  <article className="metricCard" key={total.status}>
                    <p className="metricValue">{formatPaise(total.amountPaise)}</p>
                    <p className="metricLabel">{labelFromCode(total.status)}</p>
                  </article>
                ))}
              </section>
            ) : null}
            <DataTable
              caption="My commission entries"
              columns={columns}
              emptyDescription="No commission entries yet."
              emptyTitle="No entries"
              rowKey={(row) => row.id}
              rows={statementResult.data.items}
            />
            <Pagination
              buildHref={(target) => `/payouts/statements?page=${target}`}
              limit={limit}
              page={statementResult.data.page}
              total={statementResult.data.total}
            />
          </>
        )}
      </section>
    </BusinessShell>
  );
}

function accountStatusTone(status: string): 'ok' | 'warn' | 'danger' {
  if (status === 'VERIFIED') return 'ok';
  if (status === 'REJECTED') return 'danger';
  return 'warn';
}

function entryStatusTone(status: CommissionEntryStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'FINAL') return 'ok';
  if (status === 'REVERSED') return 'danger';
  return 'warn';
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
