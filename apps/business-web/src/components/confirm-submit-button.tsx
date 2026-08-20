'use client';

/**
 * The portal's first (and only intended) client component. Every destructive
 * action here so far -- verify/reject a payout account, resolve a dispute,
 * retry a dead-lettered job, suspend a membership -- submits a plain server
 * action form with no confirmation step. This wraps the submit button with a
 * native `confirm()` so a misclick doesn't fire the mutation; it does not hold
 * any state and the form still works identically without JavaScript (the
 * button just submits immediately), so it degrades safely rather than
 * breaking the action.
 */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
  disabled,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={className ?? 'primaryButton'}
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {children}
    </button>
  );
}
