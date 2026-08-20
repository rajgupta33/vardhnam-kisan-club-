export function RouteLoadingState({ label }: { label: string }) {
  return (
    <div className="loadingShell">
      <div aria-live="polite" className="loadingPanel" role="status">
        <span aria-hidden="true" className="loadingSpinner" />
        <p>{label}</p>
      </div>
    </div>
  );
}
