'use client';

import { RouteErrorState } from '../../components/route-error-state';

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      backHref="/notifications"
      backLabel="Back to notifications"
      error={error}
      reset={reset}
      title="Notifications could not be loaded"
    />
  );
}
