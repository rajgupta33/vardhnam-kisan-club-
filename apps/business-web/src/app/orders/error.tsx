'use client';

import { RouteErrorState } from '../../components/route-error-state';

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      backHref="/orders"
      backLabel="Back to orders"
      error={error}
      reset={reset}
      title="Orders could not be loaded"
    />
  );
}
