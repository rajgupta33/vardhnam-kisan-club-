/**
 * A `.statusBadge` span with an explicit tone. Every existing page already
 * writes this markup by hand with a locally defined status-to-tone mapping --
 * this doesn't try to guess a universal mapping (a "PENDING" order and a
 * "PENDING_VERIFICATION" organisation don't share a colour by coincidence),
 * it just removes the repeated JSX.
 */
export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'warn' | 'danger';
}) {
  return <span className={`statusBadge ${tone}`}>{label}</span>;
}
