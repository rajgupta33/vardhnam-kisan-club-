import Link from 'next/link';

/**
 * Root-level 404. Several detail pages already call `notFound()` when a
 * record doesn't exist (e.g. `app/support/[id]/page.tsx` for an unknown
 * ticket) -- without this file that call rendered Next's default unstyled
 * "404" page rather than anything matching the portal.
 */
export default function NotFound() {
  return (
    <div className="loadingShell">
      <section className="panel errorPanel">
        <p className="eyebrow">Not found</p>
        <h1>This page or record doesn&apos;t exist</h1>
        <p className="mutedText">
          It may have been removed, or the link may be out of date.
        </p>
        <Link className="primaryButton" href="/">
          Back to dashboard
        </Link>
      </section>
    </div>
  );
}
