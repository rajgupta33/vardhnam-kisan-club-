import Link from 'next/link';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { financeAccess } from '../../../lib/finance-access';
import { formatDateTime, formatPaise, labelFromCode } from '../../../lib/format';
import {
  commissionEntryStatusValues,
  commissionsListPath,
  parseCommissionEntryStatus,
  parseFinancePage,
} from '../../../lib/finance-route-state';
import {
  loadCommissionEntries,
  loadCommissionRules,
  type CommissionEntry,
  type CommissionEntryStatus,
  type CommissionRule,
} from '../../../lib/marketplace-api';
import {
  createCommissionRuleAction,
  finalizeCommissionsAction,
  reverseCommissionAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 50;

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const entryStatus = parseCommissionEntryStatus(readParam(resolvedSearchParams.entryStatus));
  const rulePage = parseFinancePage(readParam(resolvedSearchParams.rulePage));
  const entryPage = parseFinancePage(readParam(resolvedSearchParams.entryPage));
  const session = await readPortalSession();
  const access = financeAccess(session?.permissions ?? []);
  const [rulesResult, entriesResult] = await Promise.all([
    access.canReadCommissionRules
      ? loadCommissionRules({ page: String(rulePage), limit: String(limit) })
      : undefined,
    access.canReadCommissionEntries
      ? loadCommissionEntries({
          page: String(entryPage),
          limit: String(limit),
          ...(entryStatus ? { status: entryStatus } : {}),
        })
      : undefined,
  ]);
  const rules = rulesResult?.ok ? rulesResult.data.items : [];
  const ruleTotal = rulesResult?.ok ? rulesResult.data.total : 0;
  const entries = entriesResult?.ok ? entriesResult.data.items : [];
  const entryTotal = entriesResult?.ok ? entriesResult.data.total : 0;
  const canWriteRules =
    access.canReadCommissionRules &&
    (session?.permissions.includes('finance-commission-rules:write') ?? false);
  const canManageEntries =
    access.canReadCommissionEntries &&
    (session?.permissions.includes('finance-commission-entries:manage') ?? false);
  const ruleColumns: DataTableColumn<CommissionRule>[] = [
    {
      key: 'scope',
      header: 'Scope',
      render: (rule) => rule.sellerOrganisationId ?? 'Global default',
    },
    {
      key: 'marketplaceRate',
      header: 'Marketplace rate',
      render: (rule) => formatBps(rule.marketplaceCommissionBps),
    },
    {
      key: 'promoterRate',
      header: 'Promoter rate',
      render: (rule) => formatBps(rule.promoterCommissionBps),
    },
    {
      key: 'deliveryFee',
      header: 'Delivery fee',
      render: (rule) => formatPaise(rule.deliveryFeePaise),
    },
    {
      key: 'status',
      header: 'Status',
      render: (rule) => (
        <StatusBadge
          label={labelFromCode(rule.status)}
          tone={rule.status === 'ACTIVE' ? 'ok' : 'warn'}
        />
      ),
    },
    {
      key: 'effective',
      header: 'Effective',
      render: (rule) => formatDateTime(rule.effectiveFrom),
    },
  ];
  const entryColumns: DataTableColumn<CommissionEntry>[] = [
    { key: 'order', header: 'Order', render: (entry) => entry.productOrderId },
    { key: 'type', header: 'Type', render: (entry) => labelFromCode(entry.entryType) },
    { key: 'amount', header: 'Amount', render: (entry) => formatPaise(entry.amountPaise) },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => (
        <StatusBadge label={labelFromCode(entry.status)} tone={entryStatusTone(entry.status)} />
      ),
    },
    { key: 'eligible', header: 'Eligible', render: (entry) => formatDateTime(entry.eligibleAt) },
    {
      key: 'action',
      header: 'Action',
      render: (entry) =>
        canManageEntries && entry.status !== 'REVERSED' ? (
          <form action={reverseCommissionAction} className="inlineForm">
            <input name="entryId" type="hidden" value={entry.id} />
            <CommissionReturnState entryPage={entryPage} entryStatus={entryStatus} rulePage={rulePage} />
            <input
              aria-label="Reversal reason"
              maxLength={500}
              minLength={3}
              name="reason"
              placeholder="Reason"
              required
              type="text"
            />
            <ConfirmSubmitButton
              className="dangerButton"
              confirmMessage="Reverse all commission entries for this order?"
            >
              Reverse order entries
            </ConfirmSubmitButton>
          </form>
        ) : (
          'Not available'
        ),
    },
  ];

  const statuses = [
    {
      label: session ? 'Authenticated session' : 'Session missing',
      tone: session ? ('ok' as const) : ('danger' as const),
    },
    {
      label:
        (!rulesResult || rulesResult.ok) && (!entriesResult || entriesResult.ok)
          ? 'Authorised finance APIs connected'
          : 'Finance API unavailable',
      tone:
        (!rulesResult || rulesResult.ok) && (!entriesResult || entriesResult.ok)
          ? ('ok' as const)
          : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="finance"
      eyebrow="Marketplace finance"
      statuses={statuses}
      title="Commissions"
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/finance">
          Back to finance
        </Link>
      </div>
      {notice ? <div className="noticeBanner ok">{notice}</div> : null}
      {error ? <div className="noticeBanner danger">{error}</div> : null}

      {canWriteRules ? (
        <section className="panel" aria-label="Create commission rule">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">New rule</p>
              <h3>Create Commission Rule</h3>
            </div>
          </div>
          <form action={createCommissionRuleAction} className="inlineForm">
            <CommissionReturnState entryPage={entryPage} entryStatus={entryStatus} rulePage={rulePage} />
            <label>
              Marketplace commission (BPS)
              <input
                max="10000"
                min="0"
                name="marketplaceCommissionBps"
                required
                step="1"
                type="number"
              />
            </label>
            <label>
              Distributor organisation ID (optional)
              <input
                name="sellerOrganisationId"
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
                placeholder="Global when blank"
                type="text"
              />
            </label>
            <label>
              Reason
              <input maxLength={500} minLength={3} name="reason" required type="text" />
            </label>
            <ConfirmSubmitButton
              confirmMessage="Create and activate this commission rule? It will replace the current active rule for the same scope."
            >
              Create rule
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      {rulesResult ? (
        <section className="panel" aria-label="Commission rules">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Configuration</p>
              <h3>Commission Rules</h3>
            </div>
          </div>
          {!rulesResult.ok ? (
            <EmptyState description={rulesResult.error} title="Commission rules are unavailable" />
          ) : (
            <>
              <DataTable
                caption="Commission rules"
                columns={ruleColumns}
                emptyDescription="Configured commission rules will appear here."
                emptyTitle="No commission rules found"
                rowKey={(rule) => rule.id}
                rows={rules}
              />
              <Pagination
                buildHref={(targetPage) => buildCommissionsHref(entryStatus, targetPage, entryPage)}
                limit={limit}
                page={rulePage}
                total={ruleTotal}
              />
            </>
          )}
        </section>
      ) : null}

      {entriesResult ? (
        <section className="panel" aria-label="Commission entries">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Order earnings</p>
              <h3>Commission Entries</h3>
            </div>
            {canManageEntries ? (
              <form action={finalizeCommissionsAction}>
                <CommissionReturnState entryPage={entryPage} entryStatus={entryStatus} rulePage={rulePage} />
                <ConfirmSubmitButton confirmMessage="Finalise every currently eligible commission entry?">
                  Finalise eligible
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
          <div className="segmentedControl">
            {[undefined, ...commissionEntryStatusValues].map((value) => (
              <Link
                aria-current={entryStatus === value ? 'page' : undefined}
                className={entryStatus === value ? 'selected' : undefined}
                href={buildCommissionsHref(value, rulePage, 1)}
                key={value || 'all'}
              >
                {value ? labelFromCode(value) : 'All'}
              </Link>
            ))}
          </div>
          {!entriesResult.ok ? (
            <EmptyState
              description={entriesResult.error}
              title="Commission entries are unavailable"
            />
          ) : (
            <>
              <DataTable
                caption="Commission entries"
                columns={entryColumns}
                emptyDescription="Commission entries matching the selected status will appear here."
                emptyTitle="No commission entries found"
                rowKey={(entry) => entry.id}
                rows={entries}
              />
              <Pagination
                buildHref={(targetPage) => buildCommissionsHref(entryStatus, rulePage, targetPage)}
                limit={limit}
                page={entryPage}
                total={entryTotal}
              />
            </>
          )}
        </section>
      ) : null}
    </BusinessShell>
  );
}

function buildCommissionsHref(
  entryStatus: CommissionEntryStatus | undefined,
  rulePage: number,
  entryPage: number,
): string {
  return commissionsListPath(entryStatus, rulePage, entryPage);
}

function CommissionReturnState({
  entryStatus,
  rulePage,
  entryPage,
}: {
  entryStatus: CommissionEntryStatus | undefined;
  rulePage: number;
  entryPage: number;
}) {
  return (
    <>
      {entryStatus ? <input name="entryStatus" type="hidden" value={entryStatus} /> : null}
      <input name="rulePage" type="hidden" value={rulePage} />
      <input name="entryPage" type="hidden" value={entryPage} />
    </>
  );
}

function entryStatusTone(status: CommissionEntryStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'FINAL') return 'ok';
  if (status === 'REVERSED') return 'danger';
  return 'warn';
}

function formatBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
