import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { EmptyState } from '../../components/empty-state';
import { readPortalSession } from '../../lib/auth-session';
import { financeAccess } from '../../lib/finance-access';
import {
  loadCommissionEntries,
  loadCommissionRules,
  loadLedgerEntries,
  loadSettlements,
} from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const session = await readPortalSession();
  const access = financeAccess(session?.permissions ?? []);
  const [rulesResult, entriesResult, ledgerResult, settlementsResult] = await Promise.all([
    access.canReadCommissionRules ? loadCommissionRules({ limit: '1' }) : undefined,
    access.canReadCommissionEntries ? loadCommissionEntries({ limit: '1' }) : undefined,
    access.canReadLedger ? loadLedgerEntries({ limit: '1' }) : undefined,
    access.canReadSettlements ? loadSettlements({ limit: '1' }) : undefined,
  ]);

  const permittedResults = [rulesResult, entriesResult, ledgerResult, settlementsResult].filter(
    (result) => result !== undefined,
  );
  const apiConnected = permittedResults.length > 0 && permittedResults.every((result) => result.ok);
  const sections = [
    rulesResult
      ? {
          eyebrow: 'Rules',
          title: 'Commission Rules',
          description: 'Review marketplace commission rules.',
          href: '/finance/commissions',
          count: rulesResult.ok ? rulesResult.data.total : 'Unavailable',
        }
      : undefined,
    entriesResult
      ? {
          eyebrow: 'Earnings',
          title: 'Commission Entries',
          description: 'Review order-linked commission entries.',
          href: '/finance/commissions',
          count: entriesResult.ok ? entriesResult.data.total : 'Unavailable',
        }
      : undefined,
    ledgerResult
      ? {
          eyebrow: 'Records',
          title: 'Ledger',
          description: 'View immutable financial ledger entries.',
          href: '/finance/ledger',
          count: ledgerResult.ok ? ledgerResult.data.total : 'Unavailable',
        }
      : undefined,
    settlementsResult
      ? {
          eyebrow: 'Payouts',
          title: 'Settlements',
          description: 'Review distributor settlement records.',
          href: '/finance/settlements',
          count: settlementsResult.ok ? settlementsResult.data.total : 'Unavailable',
        }
      : undefined,
  ].filter((section) => section !== undefined);

  const statuses = [
    {
      label: session ? 'Authenticated session' : 'Session missing',
      tone: session ? ('ok' as const) : ('danger' as const),
    },
    {
      label: apiConnected ? 'Authorised finance APIs connected' : 'Finance API unavailable',
      tone: apiConnected ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="finance"
      eyebrow="Marketplace finance"
      statuses={statuses}
      title="Finance Overview"
    >
      {sections.length === 0 ? (
        <EmptyState
          description="Your session does not include a readable finance dataset."
          title="No finance sections available"
        />
      ) : (
        <>
          <section className="metricStrip" aria-label="Authorised finance metrics">
            {sections.map((section) => (
              <article className="metricCard" key={section.title}>
                <p className="metricValue">{section.count}</p>
                <p className="metricLabel">{section.title}</p>
              </article>
            ))}
          </section>

          <section className="queueList" aria-label="Authorised finance sections">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Finance Operations</p>
                <h3>Sub-sections</h3>
              </div>
            </div>

            {sections.map((section) => (
              <article className="queueCard reviewCard" key={section.title}>
                <div className="queueCardMain">
                  <div className="rowHeader">
                    <div>
                      <p className="eyebrow">{section.eyebrow}</p>
                      <h3>{section.title}</h3>
                    </div>
                  </div>
                  <p className="mutedText">{section.description}</p>
                </div>
                <Link className="queueAction" href={section.href}>
                  Open
                </Link>
              </article>
            ))}
          </section>
        </>
      )}
    </BusinessShell>
  );
}
