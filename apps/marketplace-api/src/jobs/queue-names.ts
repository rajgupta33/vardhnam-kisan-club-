/**
 * Every queue the platform uses. Queues are declared centrally so the admin
 * metrics endpoint can report on all of them, including ones whose producers
 * and handlers land in a later work package.
 *
 * `TALLY_SYNC` is declared but has no handler yet. Nothing enqueues to it, so it
 * sits empty; a worker is only started for a queue that has at least one
 * registered handler.
 */
export const QueueName = {
  NOTIFICATIONS: 'notifications',
  PAYMENT_WEBHOOKS: 'payment-webhooks',
  TALLY_SYNC: 'tally-sync',
  DOCUMENTS: 'documents',
  SCHEDULED_MAINTENANCE: 'scheduled-maintenance',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const allQueueNames: ReadonlyArray<QueueName> = Object.values(QueueName);

/**
 * Dead-letter queues are ordinary BullMQ queues with a derived name, so they get
 * the same inspection tooling as any other queue for free.
 *
 * The separator is a hyphen, not a colon: BullMQ rejects a colon in a queue name
 * because it builds its Redis keys as `prefix:queue:...` and a colon would make
 * the key structure ambiguous.
 */
export function deadLetterQueueName(queue: QueueName): string {
  return `${queue}-dead-letter`;
}

/**
 * Named jobs on the `scheduled-maintenance` queue. These are registered as
 * BullMQ repeatable jobs on boot; the job name selects the handler.
 */
export const MaintenanceJob = {
  FINALIZE_ELIGIBLE_COMMISSIONS: 'finalize-eligible-commissions',
  EXPIRE_BATCHES: 'expire-batches',
  EXPIRE_OTP_CHALLENGES: 'expire-otp-challenges',
  PRUNE_REFRESH_TOKENS: 'prune-refresh-tokens',
  DISPATCH_PENDING_NOTIFICATIONS: 'dispatch-pending-notifications',
  GENERATE_ADVISORIES: 'generate-advisories',
  RECONCILE_PAYMENT_INTENTS: 'reconcile-payment-intents',
  RECOVER_PROCESSING_REFUNDS: 'recover-processing-refunds',
  RECOVER_INVOICE_PDF_JOBS: 'recover-invoice-pdf-jobs',
  RECOVER_CREDIT_NOTE_PDF_JOBS: 'recover-credit-note-pdf-jobs',
} as const;

export type MaintenanceJob = (typeof MaintenanceJob)[keyof typeof MaintenanceJob];

/** Named jobs on the `documents` queue (WP-08). */
export const DocumentJob = {
  SCAN_STORED_FILE: 'scan-stored-file',
  GENERATE_INVOICE_PDF: 'generate-invoice-pdf',
  GENERATE_CREDIT_NOTE_PDF: 'generate-credit-note-pdf',
} as const;

export type DocumentJob = (typeof DocumentJob)[keyof typeof DocumentJob];

/**
 * Named jobs on the `payment-webhooks` queue (WP-07).
 *
 * The webhook row is already persisted by the time one of these is enqueued --
 * the job carries only its id, never the payload. A queue is not a durable
 * store, and a payment event must survive Redis being flushed.
 */
export const PaymentWebhookJob = {
  PROCESS_WEBHOOK: 'process-payment-webhook',
  EXECUTE_REFUND: 'execute-refund',
} as const;

export type PaymentWebhookJob = (typeof PaymentWebhookJob)[keyof typeof PaymentWebhookJob];

/** Named jobs on the `notifications` queue (WP-06). */
export const NotificationJob = {
  SEND_NOTIFICATION: 'send-notification',
} as const;

export type NotificationJob = (typeof NotificationJob)[keyof typeof NotificationJob];
