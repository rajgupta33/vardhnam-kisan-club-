'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatApiError, retryDeadLetterJob } from '../../../lib/marketplace-api';

export async function retryDeadLetterJobAction(formData: FormData): Promise<void> {
  const jobId = requireFormValue(formData, 'jobId');
  const queue = requireFormValue(formData, 'queue');
  const reason = optionalFormValue(formData, 'reason');

  try {
    await retryDeadLetterJob(jobId, { queue, ...(reason ? { reason } : {}) });
  } catch (error) {
    redirectWithMessage(queue, 'error', formatApiError(error));
  }
  revalidatePath('/admin/jobs');
  redirectWithMessage(queue, 'notice', 'Job re-queued for replay.');
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

function redirectWithMessage(queue: string, type: 'notice' | 'error', message: string): never {
  redirect(`/admin/jobs?${new URLSearchParams({ queue, [type]: message }).toString()}`);
}
