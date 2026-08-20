import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../lib/format';
import { loadSupportTickets, type SupportTicket } from '../../lib/marketplace-api';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

interface SupportPageProps {
  searchParams?: Promise<SearchParams>;
}

const ticketStatuses: SupportTicket['status'][] = [
  'OPEN',
  'ASSIGNED',
  'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_SELLER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];
const limit = 50;

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = parseTicketStatus(readParam(resolvedSearchParams.status));
  const page = parsePage(readParam(resolvedSearchParams.page));

  const ticketsResult = await loadSupportTickets({
    ...(status ? { status } : {}),
    page: String(page),
    limit: String(limit),
  });

  const tickets = ticketsResult.ok ? ticketsResult.data.items : [];
  const total = ticketsResult.ok ? ticketsResult.data.total : 0;
  const columns: DataTableColumn<SupportTicket>[] = [
    {
      key: 'ticket',
      header: 'Ticket',
      render: (ticket) => (
        <>
          <Link className="textLink" href={`/support/${ticket.id}`}>
            {ticket.subject}
          </Link>
          <br />
          <span className="mutedText">{ticket.id}</span>
        </>
      ),
    },
    { key: 'category', header: 'Category', render: (ticket) => labelFromCode(ticket.category) },
    {
      key: 'priority',
      header: 'Priority',
      render: (ticket) => (
        <StatusBadge label={labelFromCode(ticket.priority)} tone={priorityTone(ticket.priority)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ticket) => (
        <StatusBadge label={labelFromCode(ticket.status)} tone={statusTone(ticket.status)} />
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (ticket) => ticket.assignedToUserId || 'Unassigned',
    },
    {
      key: 'createdAt',
      header: 'Created At',
      render: (ticket) => formatDateTime(ticket.createdAt),
    },
  ];

  const statuses = [
    {
      label: ticketsResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: ticketsResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: ticketsResult.ok ? 'Support API connected' : 'API not connected',
      tone: ticketsResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  return (
    <BusinessShell
      active="support"
      eyebrow="Marketplace support"
      statuses={statuses}
      title="Support Tickets"
    >
      <section className="toolbar" aria-label="Filters">
        <div className="segmentedControl">
          <FilterLink active={!status} href={buildSupportHref(undefined, 1)} label="All" />
          {ticketStatuses.map((statusValue) => (
            <FilterLink
              active={status === statusValue}
              href={buildSupportHref(statusValue, 1)}
              key={statusValue}
              label={labelFromCode(statusValue)}
            />
          ))}
        </div>
      </section>

      {!ticketsResult.ok ? (
        <EmptyState description={ticketsResult.error} title="API Connection Blocked" />
      ) : (
        <section className="queueList" aria-label="Support tickets list">
          <DataTable
            caption="Support tickets"
            columns={columns}
            emptyDescription="Support tickets matching the selected status will appear here."
            emptyTitle="No tickets found"
            rowKey={(ticket) => ticket.id}
            rows={tickets}
          />
          <Pagination
            buildHref={(targetPage) => buildSupportHref(status, targetPage)}
            limit={limit}
            page={page}
            total={total}
          />
        </section>
      )}
    </BusinessShell>
  );
}

function buildSupportHref(status: SupportTicket['status'] | undefined, page: number): string {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/support?${query}` : '/support';
}

function parseTicketStatus(value: string | undefined): SupportTicket['status'] | undefined {
  return ticketStatuses.find((status) => status === value);
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={active ? 'selected' : undefined}
      href={href}
    >
      {label}
    </Link>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: SupportTicket['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'RESOLVED' || status === 'CLOSED') return 'ok';
  if (status === 'ESCALATED' || status === 'REOPENED') return 'danger';
  return 'warn';
}

function priorityTone(priority: SupportTicket['priority']): 'ok' | 'warn' | 'danger' {
  if (priority === 'URGENT' || priority === 'HIGH') return 'danger';
  if (priority === 'MEDIUM') return 'warn';
  return 'ok';
}
