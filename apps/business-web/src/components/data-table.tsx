import { EmptyState } from './empty-state';

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => React.ReactNode;
}

/**
 * Column-configured table wrapper. Every list page in this portal already
 * writes `.tableShell > table > thead/tbody` by hand with a hand-rolled empty
 * state, which is fine once but was repeated across every new route this
 * package adds. Rendering stays declarative -- `render` returns a node per
 * column per row, same as writing the `<td>` inline, so this doesn't hide
 * anything a page author would need to reach into.
 *
 * Deliberately does not paginate or filter -- those stay page-level concerns
 * driven by the URL (see `pagination.tsx`), because filter state here would
 * fight the server-rendered, no-client-state pattern the rest of the portal
 * relies on for permission safety.
 */
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  caption,
  emptyTitle,
  emptyDescription,
}: {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  caption: string;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState {...(emptyDescription ? { description: emptyDescription } : {})} title={emptyTitle} />
    );
  }

  return (
    <div className="tableShell">
      <table>
        <caption className="srOnly">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
