'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatApiError, suspendKisanClubMembership } from '../../lib/marketplace-api';

export async function suspendKisanClubMembershipAction(formData: FormData): Promise<void> {
  const membershipId = requireValue(formData, 'membershipId');
  const reason = requireValue(formData, 'reason');
  if (requireValue(formData, 'confirmation') !== 'SUSPEND') {
    redirectWithMessage(membershipId, 'error', 'Explicit suspension confirmation is required');
  }

  try {
    await suspendKisanClubMembership(membershipId, reason);
  } catch (error) {
    redirectWithMessage(membershipId, 'error', formatApiError(error));
  }
  revalidatePath('/kisan-club');
  revalidatePath(`/kisan-club/${membershipId}`);
  revalidatePath('/audit');
  redirectWithMessage(membershipId, 'notice', 'Kisan Club membership suspended');
}

function requireValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`);
  return value.trim();
}

function redirectWithMessage(
  membershipId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  redirect(`/kisan-club/${membershipId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
