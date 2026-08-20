/**
 * Root-level loading UI. Next.js wraps every page segment in a `<Suspense>`
 * boundary keyed to the nearest `loading.tsx`; since every page here is an
 * async Server Component that awaits its data directly, this renders for the
 * duration of that await instead of a blank white screen.
 *
 * Deliberately outside `BusinessShell` -- the shell itself is part of what
 * each page renders after its data resolves, so showing it here would need a
 * second, unauthenticated fetch of the session just to draw a sidebar that is
 * about to be replaced.
 */
export default function Loading() {
  return (
    <div className="loadingShell">
      <div className="loadingPanel" role="status">
        <span className="loadingSpinner" />
        <p>Loading…</p>
      </div>
    </div>
  );
}
