import Link from 'next/link';

/**
 * Prev/next pagination driven entirely by the URL, matching how filters
 * already work on every page in this portal (`?status=...`, `?page=...`) --
 * no client component, no local state, so a slow or missing API still leaves
 * the page server-renderable and linkable.
 *
 * `buildHref` receives the target 1-indexed page number; the caller owns
 * which other query params survive the navigation.
 */
export function Pagination({
  page,
  limit,
  total,
  buildHref,
}: {
  page: number;
  limit: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) {
    return null;
  }

  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastItem = Math.min(total, page * limit);

  return (
    <nav aria-label="Pagination" className="paginationBar">
      <p className="paginationSummary">
        {firstItem}–{lastItem} of {total}
      </p>
      <div className="paginationLinks">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span aria-disabled="true">Previous</span>
        )}
        <span aria-current="page">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span aria-disabled="true">Next</span>
        )}
      </div>
    </nav>
  );
}
