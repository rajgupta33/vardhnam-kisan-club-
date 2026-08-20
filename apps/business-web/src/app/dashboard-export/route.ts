import { exportDashboardSummary } from '../../lib/marketplace-api';

/**
 * Downloads the dashboard summary as CSV.
 *
 * Deliberately calls the backend's `/dashboards/summary/export` rather than
 * re-shaping the plain `/dashboards/summary` response client-side: the export
 * endpoint writes a `DASHBOARD_EXPORTED` audit record naming exactly which
 * item codes left the system, gated by its own `dashboards:export`
 * permission (narrower than plain `dashboards:read`). Exporting through the
 * read endpoint instead would produce a file with no audit trail behind it.
 *
 * `directApiFetch` discards the backend's HTTP status on failure (it throws a
 * plain `Error` with just the message), so a rejection here always reports
 * 500 -- the message text still names the real reason (missing session,
 * missing permission, backend unreachable).
 */
export async function GET(): Promise<Response> {
  let summary: Awaited<ReturnType<typeof exportDashboardSummary>>;
  try {
    summary = await exportDashboardSummary();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return new Response(message, { status: 500 });
  }

  const rows = [
    ['code', 'label', 'scope', 'count'],
    ...summary.items.map((item) => [item.code, item.label, item.scope, String(item.count)]),
  ];
  const csv = rows.map((row) => row.map(csvField).join(',')).join('\r\n');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dashboard-summary-${timestamp}.csv"`,
    },
  });
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
