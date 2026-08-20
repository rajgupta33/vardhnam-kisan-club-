'use client';

import { RouteErrorState } from '../../components/route-error-state';

export default function DisputesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      backHref="/disputes"
      backLabel="Back to disputes"
      error={error}
      reset={reset}
      title="Disputes could not be loaded"
    />
  );
}
