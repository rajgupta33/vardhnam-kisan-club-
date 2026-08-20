'use client';

import { RouteErrorState } from '../../components/route-error-state';

export default function ReturnsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      backHref="/returns"
      backLabel="Back to returns"
      error={error}
      reset={reset}
      title="Returns could not be loaded"
    />
  );
}
