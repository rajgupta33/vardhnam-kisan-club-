import Link from 'next/link';
import { BusinessShell } from '../components/business-shell';
import { EmptyState } from '../components/empty-state';
import { readPortalSession } from '../lib/auth-session';
import { loadDashboardSummary, type DashboardItem, type DashboardScope } from '../lib/marketplace-api';

export const dynamic = 'force-dynamic';

/**
 * The true portal home. Every role gets `dashboards:read` (checked in
 * `apps/marketplace-api/src/access/permission-codes.ts`), so this is the one
 * page every authenticated session can reach -- `portalLandingPath` in
 * `lib/portal-access.ts` puts `/` first in its candidate list for exactly
 * that reason.
 *
 * Replaces the previous portal home, which rendered the onboarding queue
 * (now at `/onboarding`) regardless of role, and the dead `RoleDashboard`
 * component, which rendered hardcoded copy from `portal-copy.ts` that never
 * reflected real data.
 *
 * Each item the backend returns is scoped (`PLATFORM` / `ORGANISATION` /
 * `SELF`) and permission-filtered server-side -- this only decides where a
 * given item code links to. A code only gets a link when every role that can
 * see it (per `dashboards.service.ts`'s `buildItemDefinitions`) can also
 * reach the target route; several `SELF`-scope items (promoter attributions,
 * delivery assignments) have no portal surface at all yet and stay
 * unlinked rather than pointing at a route that would 403.
 */
export default async function DashboardPage() {
  const [result, session] = await Promise.all([loadDashboardSummary(), readPortalSession()]);
  const items = result.ok ? result.data.items : [];
  const canExport = session?.permissions.includes('dashboards:export') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Dashboards API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const grouped = groupByScope(items);

  return (
    <BusinessShell active="dashboard" eyebrow="Operational summary" statuses={statuses} title="Dashboard">
      <div className="breadcrumbRow">
        <p className="mutedText">
          Counts are scoped to your permissions and refresh on every visit.
        </p>
        {canExport ? (
          <a className="secondaryButton" href="/dashboard-export">
            Export CSV
          </a>
        ) : null}
      </div>

      {!result.ok ? (
        <EmptyState description={result.error} title="Dashboard data is unavailable" />
      ) : items.length === 0 ? (
        <EmptyState
          description="Your role has no dashboard items configured yet."
          title="Nothing to show"
        />
      ) : (
        <>
          <ScopeSection
            description="Counts across the whole marketplace."
            items={grouped.PLATFORM}
            title="Platform"
          />
          <ScopeSection
            description="Counts for your organisation."
            items={grouped.ORGANISATION}
            title="Your organisation"
          />
          <ScopeSection description="Counts assigned to you personally." items={grouped.SELF} title="Your work" />
        </>
      )}
    </BusinessShell>
  );
}

function ScopeSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: DashboardItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label={title} className="auditPreview">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">{description}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <section className="metricStrip">
        {items.map((item) => (
          <DashboardCard item={item} key={item.code} />
        ))}
      </section>
    </section>
  );
}

function DashboardCard({ item }: { item: DashboardItem }) {
  const href = dashboardItemHref(item.code);
  const card = (
    <article className="metricCard">
      <p className="metricValue">{item.count}</p>
      <p className="metricLabel">{item.label}</p>
    </article>
  );

  return href ? (
    <Link aria-label={`${item.label}: ${item.count}. Open work queue.`} href={href}>
      {card}
    </Link>
  ) : (
    card
  );
}

function groupByScope(items: DashboardItem[]): Record<DashboardScope, DashboardItem[]> {
  return {
    PLATFORM: items.filter((item) => item.scope === 'PLATFORM'),
    ORGANISATION: items.filter((item) => item.scope === 'ORGANISATION'),
    SELF: items.filter((item) => item.scope === 'SELF'),
  };
}

/**
 * Maps a dashboard item code to its filtered work queue. Every route named
 * here is reachable by every role that can see the corresponding item --
 * see `dashboards.service.ts` for exactly which permission gates each code,
 * and `lib/portal-access.ts` for the route's own permission gate. Codes with
 * no portal surface yet (own-scope promoter attributions, delivery
 * assignments) intentionally return `undefined`.
 */
function dashboardItemHref(code: string): string | undefined {
  switch (code) {
    case 'onboarding_pending':
      return '/onboarding?status=PENDING_VERIFICATION';
    case 'catalogue_pending_review':
    case 'catalogue_pending_review_own':
      return '/catalogue';
    case 'offers_pending_review':
    case 'offers_pending_review_own':
      return '/offers';
    case 'support_tickets_open_any':
      return '/support';
    case 'tally_sync_pending':
      return '/tally';
    case 'notifications_failed':
      return '/notifications?status=FAILED';
    case 'settlements_eligible':
      return '/finance/settlements';
    case 'commission_entries_provisional':
      return '/finance/commissions?entryStatus=PROVISIONAL';
    case 'payout_accounts_pending_verification':
      return '/payouts/accounts?status=PENDING_VERIFICATION';
    case 'fulfilment_orders_pending_own':
    case 'fulfilment_orders_pending_any':
      return '/orders';
    case 'my_payout_account_action_needed':
      return '/payouts/statements';
    default:
      return undefined;
  }
}
