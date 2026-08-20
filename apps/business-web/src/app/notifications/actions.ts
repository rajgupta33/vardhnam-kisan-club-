'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dispatchNotification, formatApiError } from '../../lib/marketplace-api';
import {
  notificationListPath,
  parseNotificationChannel,
  parseNotificationPage,
  parseNotificationStatus,
} from '../../lib/notification-list-route';

export async function retryNotificationAction(formData: FormData): Promise<void> {
  const id = requireFormValue(formData, 'notificationId');
  const returnPath = notificationListPath(
    parseNotificationStatus(optionalFormValue(formData, 'status')),
    parseNotificationChannel(optionalFormValue(formData, 'channel')),
    parseNotificationPage(optionalFormValue(formData, 'page')),
  );
  try {
    await dispatchNotification(id);
  } catch (error) {
    redirectWithMessage(returnPath, 'error', formatApiError(error));
  }
  revalidatePath('/notifications');
  redirectWithMessage(returnPath, 'notice', 'Notification re-queued for delivery.');
}

function requireFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function redirectWithMessage(path: string, type: 'notice' | 'error', message: string): never {
  redirect(`${path}&${new URLSearchParams({ [type]: message }).toString()}`);
}
