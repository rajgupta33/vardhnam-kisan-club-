import Link from 'next/link';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { parseFinancePage, settlementsListPath } from '../../../lib/finance-route-state';
import { formatDateTime, formatPaise, labelFromCode } from '../../../lib/format';
import { loadSettlements } from '../../../lib/marketplace-api';
import { createSettlementAction } from '../actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 50;

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const sellerOrganisationId = readParam(resolvedSearchParams.sellerOrganisationId);
  const page = parseFinancePage(readParam(resolvedSearchParams.page));
  const [settlementsResult, session] = await Promise.all([
    loadSettlements({
      ...(sellerOrganisationId ? { sellerOrganisationId } : {}),
      page: String(page),
      limit: String(limit),
    }),
    readPortalSession(),
  ]);
  const settlements = settlementsResult.ok ? settlementsResult.data.items : [];
  const total = settlementsResult.ok ? settlementsResult.data.total : 0;
  const canManage = session?.permissions.includes('finance-settlements:manage') ?? false;
  const statuses = [
    {
      label: settlementsResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: settlementsResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: settlementsResult.ok ? 'Finance API connected' : 'API not connected',
      tone: settlementsResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="finance"
      eyebrow="Marketplace finance"
      statuses={statuses}
      title="Settlements"
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/finance">
          Back to finance
        </Link>
      </div>
      {notice ? <div className="noticeBanner ok">{notice}</div> : null}
      {error ? <div className="noticeBanner danger">{error}</div> : null}
      {canManage ? (
        <section className="panel" aria-label="Create settlement">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Distributor payable</p>
              <h3>Create Settlement</h3>
            </div>
          </div>
          <p className="mutedText">
            The backend includes all final, unsettled distributor-payable entries and calculates the
            total.
          </p>
          <form action={createSettlementAction} className="inlineForm">
            {sellerOrganisationId ? (
              <input name="returnSellerOrganisationId" type="hidden" value={sellerOrganisationId} />
            ) : null}
            <input name="page" type="hidden" value={page} />
            <label>
              Seller organisation ID
              <input
                name="sellerOrganisationId"
                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
                required
                type="text"
              />
            </label>
            <ConfirmSubmitButton confirmMessage="Create this settlement from every currently eligible distributor-payable entry for the entered seller?">
              Create settlement
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}
      <section className="toolbar" aria-label="Settlement filters">
        <form className="inlineForm">
          <label>
            Seller organisation ID
            <input defaultValue={sellerOrganisationId} name="sellerOrganisationId" type="text" />
          </label>
          <button className="primaryButton" type="submit">
            Filter
          </button>
          <Link className="textLink" href="/finance/settlements">
            Clear
          </Link>
        </form>
      </section>
      {!settlementsResult.ok ? (
        <EmptyState description={settlementsResult.error} title="API Connection Blocked" />
      ) : (
        <section className="queueList" aria-label="Settlements">
          {settlements.length === 0 ? (
            <EmptyState
              description="Settlements matching the selected seller will appear here."
              title="No settlements found"
            />
          ) : (
            settlements.map((settlement) => (
              <article className="queueCard reviewCard" key={settlement.id}>
                <div className="queueCardMain">
                  <div className="rowHeader">
                    <div>
                      <p className="eyebrow">{settlement.sellerOrganisationId}</p>
                      <h3>{settlement.settlementNumber}</h3>
                    </div>
                    <StatusBadge label={labelFromCode(settlement.status)} tone="warn" />
                  </div>
                  <dl className="definitionGrid threeColumn">
                    <DetailField
                      label="Payable"
                      value={formatPaise(settlement.totalPayablePaise)}
                    />
                    <DetailField label="Entries" value={settlement.entryCount} />
                    <DetailField label="Created" value={formatDateTime(settlement.createdAt)} />
                  </dl>
                </div>
                <Link className="queueAction" href={`/finance/settlements/${settlement.id}`}>
                  View
                </Link>
              </article>
            ))
          )}
          <Pagination
            buildHref={(targetPage) => buildSettlementsHref(sellerOrganisationId, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function buildSettlementsHref(sellerOrganisationId: string | undefined, page: number): string {
  return settlementsListPath(sellerOrganisationId, page);
}

function DetailField({ label, value }: { label: string; value: string | number }) {
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
