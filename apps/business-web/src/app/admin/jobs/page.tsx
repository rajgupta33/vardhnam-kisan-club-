import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadDeadLetterJobs,
  loadQueues,
  type AdminJobQueue,
  type DeadLetterEntry,
  type QueueDepth,
  type ScheduledJobDefinition,
} from '../../../lib/marketplace-api';
import { retryDeadLetterJobAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const limit = 25;

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const [queuesResult, session] = await Promise.all([loadQueues(), readPortalSession()]);
  const canManage = session?.permissions.includes('jobs:manage') ?? false;

  const availableQueues = queuesResult.ok ? queuesResult.data.queues.map((q) => q.queue) : [];
  const requestedQueue = readParam(resolved.queue);
  const queue: AdminJobQueue | undefined =
    availableQueues.find((candidate) => candidate === requestedQueue) ?? availableQueues[0];
  const page = Math.max(1, Number.parseInt(readParam(resolved.page) ?? '1', 10) || 1);

  const deadLetterResult = queue ? await loadDeadLetterJobs({ queue, page, limit }) : undefined;

  const statuses = [
    {
      label: queuesResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: queuesResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: queuesResult.ok ? 'Jobs API connected' : 'API not connected',
      tone: queuesResult.ok ? ('ok' as const) : ('warn' as const),
    },
  ];

  const columns: DataTableColumn<DeadLetterEntry>[] = [
    { key: 'job', header: 'Job', render: (row) => row.originalJobName },
    { key: 'queue', header: 'Original queue', render: (row) => row.originalQueue },
    { key: 'reason', header: 'Failure reason', render: (row) => row.failedReason },
    { key: 'attempts', header: 'Attempts made', render: (row) => String(row.attemptsMade) },
    { key: 'failedAt', header: 'Failed at', render: (row) => formatDateTime(row.failedAt) },
    {
      key: 'action',
      header: '',
      render: (row) =>
        canManage ? (
          <form action={retryDeadLetterJobAction} className="inlineForm">
            <input name="jobId" type="hidden" value={row.id} />
            <input name="queue" type="hidden" value={row.originalQueue} />
            <ConfirmSubmitButton
              className="secondaryButton"
              confirmMessage="Replay this job onto its original queue? It will re-run the side effect that already failed."
            >
              Retry
            </ConfirmSubmitButton>
          </form>
        ) : null,
    },
  ];

  return (
    <BusinessShell active="jobs" eyebrow="Background jobs" statuses={statuses} title="Job Queues">
      {readParam(resolved.notice) ? (
        <div className="noticeBanner ok">{readParam(resolved.notice)}</div>
      ) : null}
      {readParam(resolved.error) ? (
        <div className="noticeBanner danger">{readParam(resolved.error)}</div>
      ) : null}

      {!queuesResult.ok ? (
        <EmptyState description={queuesResult.error} title="Queue metrics are unavailable" />
      ) : (
        <>
          <DataTable<QueueDepth>
            caption="Background job queue depths"
            columns={[
              { key: 'queue', header: 'Queue', render: (row) => row.queue },
              { key: 'waiting', header: 'Waiting', render: (row) => row.waiting },
              { key: 'active', header: 'Active', render: (row) => row.active },
              { key: 'completed', header: 'Completed', render: (row) => row.completed },
              { key: 'failed', header: 'Failed', render: (row) => row.failed },
              { key: 'delayed', header: 'Delayed', render: (row) => row.delayed },
              {
                key: 'dead-letter',
                header: 'Dead letter',
                render: (row) =>
                  row.deadLetter > 0 ? (
                    <StatusBadge label={String(row.deadLetter)} tone="danger" />
                  ) : (
                    row.deadLetter
                  ),
              },
            ]}
            emptyDescription="No background-job queues were returned by the API."
            emptyTitle="No queues registered"
            rowKey={(row) => row.queue}
            rows={queuesResult.data.queues}
          />

          <section className="panel">
            <p className="eyebrow">Scheduled maintenance</p>
            <h3>Repeatable Jobs</h3>
            <DataTable<ScheduledJobDefinition>
              caption="Scheduled repeatable background jobs"
              columns={[
                {
                  key: 'job',
                  header: 'Job',
                  render: (job) => labelFromCode(job.jobName),
                },
                { key: 'cron', header: 'Cron pattern', render: (job) => job.pattern },
                {
                  key: 'description',
                  header: 'Description',
                  render: (job) => job.description,
                },
              ]}
              emptyDescription="No repeatable maintenance jobs were returned by the API."
              emptyTitle="No scheduled jobs"
              rowKey={(job) => job.jobName}
              rows={queuesResult.data.scheduledJobs}
            />
          </section>

          <section className="panel">
            <div className="rowHeader compact">
              <h3>Dead Letter Jobs</h3>
            </div>
            <form className="searchForm" method="get">
              <label>
                Queue
                <select defaultValue={queue} name="queue">
                  {availableQueues.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondaryButton" type="submit">
                View
              </button>
            </form>

            {!deadLetterResult ? (
              <EmptyState title="No queues to inspect" />
            ) : !deadLetterResult.ok ? (
              <EmptyState
                description={deadLetterResult.error}
                title="Dead letter entries are unavailable"
              />
            ) : (
              <>
                <DataTable
                  caption={`Dead letter jobs for ${queue}`}
                  columns={columns}
                  emptyDescription="This queue has no dead-lettered jobs."
                  emptyTitle="Nothing dead-lettered"
                  rowKey={(row) => row.id}
                  rows={deadLetterResult.data.items}
                />
                <Pagination
                  buildHref={(target) =>
                    `/admin/jobs?${new URLSearchParams({ queue: queue ?? '', page: String(target) }).toString()}`
                  }
                  limit={limit}
                  page={deadLetterResult.data.page}
                  total={deadLetterResult.data.total}
                />
              </>
            )}
          </section>
        </>
      )}
    </BusinessShell>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
