'use client';

/**
 * Root-level error boundary. Next.js requires this to be a Client Component --
 * it needs `reset()`, a closure over the thrown error, to retry the failed
 * render. Before this file existed, an unhandled throw anywhere in a page
 * (a network failure that isn't wrapped in the `PortalResult` pattern, a bug)
 * produced Next's default unstyled error screen instead of anything the
 * portal's own users would recognise.
 *
 * This is a backstop, not the primary error path: pages that call
 * `loadX()` already catch failures into `PortalResult` and render their own
 * `ConnectionPanel`/`emptyState` inline. This only fires for what that
 * pattern doesn't cover -- a thrown `Error` (e.g. a mutation's `directApiFetch`
 * rejecting outside a server action) or a genuine bug.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="loadingShell">
      <section className="panel errorPanel">
        <p className="eyebrow">Something went wrong</p>
        <h1>The portal hit an unexpected error</h1>
        <p className="mutedText">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        {error.digest ? <p className="mutedText">Reference: {error.digest}</p> : null}
        <button className="primaryButton" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </div>
  );
}
