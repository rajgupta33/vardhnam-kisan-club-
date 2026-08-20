'use client';

import Link from 'next/link';

export function RouteErrorState({
  backHref,
  backLabel,
  error,
  title,
  reset,
}: {
  backHref: string;
  backLabel: string;
  error: Error & { digest?: string };
  title: string;
  reset: () => void;
}) {
  return (
    <div className="loadingShell">
      <section aria-labelledby="route-error-title" className="panel errorPanel">
        <p className="eyebrow">Unexpected portal error</p>
        <h1 id="route-error-title">{title}</h1>
        <p className="mutedText">
          The operation did not complete. No action is assumed to have succeeded; retry after
          checking the current record state.
        </p>
        {error.digest ? <p className="mutedText">Reference: {error.digest}</p> : null}
        <div className="actionCluster">
          <button className="primaryButton" onClick={reset} type="button">
            Try again
          </button>
          <Link className="secondaryButton" href={backHref}>
            {backLabel}
          </Link>
        </div>
      </section>
    </div>
  );
}
