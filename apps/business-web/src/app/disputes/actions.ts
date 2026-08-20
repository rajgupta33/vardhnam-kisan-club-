'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addDisputeNote,
  assignDispute,
  closeDispute,
  formatApiError,
  requestDisputeInfo,
  resolveDispute,
  type DisputeResolutionOutcome,
} from '../../lib/marketplace-api';

export async function assignDisputeAction(formData: FormData): Promise<void> {
  const disputeId = requireFormValue(formData, 'disputeId');
  const assignedToUserId = requireFormValue(formData, 'assignedToUserId');
  const note = optionalFormValue(formData, 'note');

  try {
    await assignDispute(disputeId, { assignedToUserId, ...(note ? { note } : {}) });
  } catch (error) {
    redirectWithMessage(disputeId, 'error', formatApiError(error));
  }
  revalidate(disputeId);
  redirectWithMessage(disputeId, 'notice', 'Dispute assigned.');
}

export async function addDisputeNoteAction(formData: FormData): Promise<void> {
  const disputeId = requireFormValue(formData, 'disputeId');
  const note = requireFormValue(formData, 'note');

  try {
    await addDisputeNote(disputeId, note);
  } catch (error) {
    redirectWithMessage(disputeId, 'error', formatApiError(error));
  }
  revalidate(disputeId);
  redirectWithMessage(disputeId, 'notice', 'Note added.');
}

export async function requestDisputeInfoAction(formData: FormData): Promise<void> {
  const disputeId = requireFormValue(formData, 'disputeId');
  const target = requireFormValue(formData, 'target') as 'FARMER' | 'DISTRIBUTOR';
  const note = requireFormValue(formData, 'note');

  try {
    await requestDisputeInfo(disputeId, { target, note });
  } catch (error) {
    redirectWithMessage(disputeId, 'error', formatApiError(error));
  }
  revalidate(disputeId);
  redirectWithMessage(disputeId, 'notice', 'Information requested.');
}

export async function resolveDisputeAction(formData: FormData): Promise<void> {
  const disputeId = requireFormValue(formData, 'disputeId');
  const outcome = requireFormValue(formData, 'outcome') as DisputeResolutionOutcome;
  const resolutionAmountPaiseRaw = requireFormValue(formData, 'resolutionAmountPaise');
  const resolutionNote = requireFormValue(formData, 'resolutionNote');
  const resolutionAmountPaise = Number(resolutionAmountPaiseRaw);
  if (!Number.isSafeInteger(resolutionAmountPaise) || resolutionAmountPaise < 0) {
    redirectWithMessage(
      disputeId,
      'error',
      'Resolution amount must be zero or a positive whole number of paise.',
    );
  }

  try {
    await resolveDispute(disputeId, { outcome, resolutionAmountPaise, resolutionNote });
  } catch (error) {
    redirectWithMessage(disputeId, 'error', formatApiError(error));
  }
  revalidate(disputeId);
  redirectWithMessage(disputeId, 'notice', 'Dispute resolved.');
}

export async function closeDisputeAction(formData: FormData): Promise<void> {
  const disputeId = requireFormValue(formData, 'disputeId');
  const note = requireFormValue(formData, 'note');

  try {
    await closeDispute(disputeId, note);
  } catch (error) {
    redirectWithMessage(disputeId, 'error', formatApiError(error));
  }
  revalidate(disputeId);
  redirectWithMessage(disputeId, 'notice', 'Dispute closed.');
}

function revalidate(disputeId: string): void {
  revalidatePath(`/disputes/${disputeId}`);
  revalidatePath('/disputes');
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

function redirectWithMessage(disputeId: string, type: 'notice' | 'error', message: string): never {
  redirect(`/disputes/${disputeId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
