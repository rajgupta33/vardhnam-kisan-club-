import Link from 'next/link';
import { BusinessShell } from '../../components/business-shell';
import { ConfirmSubmitButton } from '../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../components/data-table';
import { EmptyState } from '../../components/empty-state';
import { Pagination } from '../../components/pagination';
import { StatusBadge } from '../../components/status-badge';
import { readPortalSession } from '../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../lib/format';
import {
  loadNotifications,
  type NotificationDeliveryStatus,
  type PortalNotification,
} from '../../lib/marketplace-api';
import {
  notificationChannelValues,
  notificationListPath,
  notificationStatusValues,
  parseNotificationChannel,
  parseNotificationPage,
  parseNotificationStatus,
} from '../../lib/notification-list-route';
import { retryNotificationAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 25;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const status = parseNotificationStatus(readParam(resolved.status));
  const channel = parseNotificationChannel(readParam(resolved.channel));
  const page = parseNotificationPage(readParam(resolved.page));

  const [result, session] = await Promise.all([
    loadNotifications({
      page,
      limit,
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
    }),
    readPortalSession(),
  ]);
  const canManage = session?.permissions.includes('notifications:manage') ?? false;

  const statuses = [
    {
      label: result.config.configured ? 'Authenticated session' : 'Session missing',
      tone: result.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: result.ok ? 'Notifications API connected' : 'API not connected',
      tone: result.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<PortalNotification>[] = [
    { key: 'title', header: 'Title', render: (row) => row.title },
    { key: 'channel', header: 'Channel', render: (row) => labelFromCode(row.channel) },
    { key: 'category', header: 'Category', render: (row) => labelFromCode(row.category) },
    { key: 'recipient', header: 'Recipient', render: (row) => row.recipientUserId },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusBadge label={labelFromCode(row.status)} tone={statusTone(row.status)} />
      ),
    },
    { key: 'attempts', header: 'Attempts', render: (row) => String(row.attemptCount) },
    { key: 'lastError', header: 'Last error', render: (row) => row.lastErrorMessage ?? '—' },
    { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'action',
      header: '',
      render: (row) =>
        canManage && row.status === 'FAILED' ? (
          <form action={retryNotificationAction} className="inlineForm">
            <input name="notificationId" type="hidden" value={row.id} />
            {status ? <input name="status" type="hidden" value={status} /> : null}
            {channel ? <input name="channel" type="hidden" value={channel} /> : null}
            <input name="page" type="hidden" value={page} />
            <ConfirmSubmitButton
              className="textLink"
              confirmMessage="Retry this failed notification? It will be queued for another delivery attempt."
            >
              Retry
            </ConfirmSubmitButton>
          </form>
        ) : null,
    },
  ];

  return (
    <BusinessShell
      active="notifications"
      eyebrow="Delivery log"
      statuses={statuses}
      title="Notifications"
    >
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}

      <section className="toolbar" aria-label="Notification filters">
        <div className="segmentedControl">
          <FilterLink
            active={!status}
            href={buildHref(undefined, channel, 1)}
            label="All statuses"
          />
          {notificationStatusValues.map((value) => (
            <FilterLink
              active={status === value}
              href={buildHref(value, channel, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
        <div className="segmentedControl">
          <FilterLink
            active={!channel}
            href={buildHref(status, undefined, 1)}
            label="All channels"
          />
          {notificationChannelValues.map((value) => (
            <FilterLink
              active={channel === value}
              href={buildHref(status, value, 1)}
              key={value}
              label={labelFromCode(value)}
            />
          ))}
        </div>
      </section>

      {!result.ok ? (
        <EmptyState description={result.error} title="Notifications are unavailable" />
      ) : (
        <>
          <DataTable
            caption="Notification delivery log"
            columns={columns}
            emptyDescription="No notifications match this filter."
            emptyTitle="No notifications"
            rowKey={(row) => row.id}
            rows={result.data.items}
          />
          <Pagination
            buildHref={(target) => buildHref(status, channel, target)}
            limit={limit}
            page={result.data.page}
            total={result.data.total}
          />
        </>
      )}
    </BusinessShell>
  );
}

function statusTone(status: NotificationDeliveryStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'SENT') return 'ok';
  if (status === 'FAILED') return 'danger';
  return 'warn';
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

function buildHref(
  status: NotificationDeliveryStatus | undefined,
  channel: (typeof notificationChannelValues)[number] | undefined,
  page: number,
): string {
  return notificationListPath(status, channel, page);
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
