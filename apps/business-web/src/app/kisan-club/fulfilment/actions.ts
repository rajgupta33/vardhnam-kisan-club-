'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { KisanClubFulfilmentAction } from '@vardhnam/api-client';
import {
  formatApiError,
  reassignKisanClubFulfilment,
  transitionKisanClubFulfilment,
} from '../../../lib/marketplace-api';

const allowedActions: readonly KisanClubFulfilmentAction[] = [
  'accept',
  'decline',
  'product-ready',
  'farmer-contacted',
  'ready-for-pickup',
  'out-for-delivery',
  'complete',
  'fail',
  'cancel',
];

export async function transitionClubFulfilmentAction(formData: FormData): Promise<void> {
  const assignmentId = requireValue(formData, 'assignmentId');
  const action = requireValue(formData, 'action');
  const reason = requireValue(formData, 'reason');
  if (!allowedActions.includes(action as KisanClubFulfilmentAction)) {
    redirectWithMessage(assignmentId, 'error', 'Unsupported Club fulfilment action');
  }
  try {
    await transitionKisanClubFulfilment(assignmentId, action as KisanClubFulfilmentAction, reason);
  } catch (error) {
    redirectWithMessage(assignmentId, 'error', formatApiError(error));
  }
  revalidateAssignment(assignmentId);
  redirectWithMessage(assignmentId, 'notice', 'Club coordination status updated');
}

export async function reassignClubFulfilmentAction(formData: FormData): Promise<void> {
  const assignmentId = requireValue(formData, 'assignmentId');
  try {
    await reassignKisanClubFulfilment(assignmentId, {
      promoterUserId: requireValue(formData, 'promoterUserId'),
      reason: requireValue(formData, 'reason'),
    });
  } catch (error) {
    redirectWithMessage(assignmentId, 'error', formatApiError(error));
  }
  revalidateAssignment(assignmentId);
  redirectWithMessage(assignmentId, 'notice', 'Club coordination reassigned');
}

function revalidateAssignment(assignmentId: string): void {
  revalidatePath('/kisan-club/fulfilment');
  revalidatePath(`/kisan-club/fulfilment/${assignmentId}`);
  revalidatePath('/audit');
}

function requireValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function redirectWithMessage(
  assignmentId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  redirect(
    `/kisan-club/fulfilment/${assignmentId}?${new URLSearchParams({ [type]: message }).toString()}`,
  );
}
