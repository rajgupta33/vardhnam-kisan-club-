import type { NotificationChannel, NotificationDeliveryStatus } from './marketplace-api';

export const notificationStatusValues = ['PENDING', 'SENT', 'FAILED'] as const satisfies readonly NotificationDeliveryStatus[];
export const notificationChannelValues = ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH', 'IN_APP'] as const satisfies readonly NotificationChannel[];

export function parseNotificationStatus(value: string | undefined): NotificationDeliveryStatus | undefined {
  return notificationStatusValues.includes(value as NotificationDeliveryStatus)
    ? (value as NotificationDeliveryStatus)
    : undefined;
}

export function parseNotificationChannel(value: string | undefined): NotificationChannel | undefined {
  return notificationChannelValues.includes(value as NotificationChannel)
    ? (value as NotificationChannel)
    : undefined;
}

export function parseNotificationPage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function notificationListPath(
  status: NotificationDeliveryStatus | undefined,
  channel: NotificationChannel | undefined,
  page: number,
): string {
  const params = new URLSearchParams({ page: String(parseNotificationPage(String(page))) });
  if (status) params.set('status', status);
  if (channel) params.set('channel', channel);
  return `/notifications?${params.toString()}`;
}
