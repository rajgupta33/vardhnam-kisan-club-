'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { attemptTallySync, formatApiError, type TallySyncStatus } from '../../lib/marketplace-api';

export async function attemptTallySyncAction(formData: FormData): Promise<void> {
  const id = requireFormValue(formData, 'recordId');
  const outcome = requireFormValue(formData, 'outcome') as TallySyncStatus;
  if (outcome !== 'SYNCED' && outcome !== 'FAILED') {
    redirectWithMessage(id, 'error', 'Invalid outcome.');
  }
  const tallyReferenceId = optionalFormValue(formData, 'tallyReferenceId');
  const errorCode = optionalFormValue(formData, 'errorCode');
  const errorMessage = optionalFormValue(formData, 'errorMessage');
  const reason = optionalFormValue(formData, 'reason');

  try {
    await attemptTallySync(id, {
      outcome,
      ...(tallyReferenceId ? { tallyReferenceId } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    redirectWithMessage(id, 'error', formatApiError(error));
  }
  revalidatePath('/tally');
  revalidatePath(`/tally/${id}`);
  redirectWithMessage(id, 'notice', 'Sync attempt recorded.');
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

function redirectWithMessage(recordId: string, type: 'notice' | 'error', message: string): never {
  redirect(`/tally/${recordId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
