'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  formatApiError,
  upsertMyPayoutAccount,
  verifyPayoutAccount,
  type PayoutAccountStatus,
} from '../../lib/marketplace-api';
import { payoutAccountDetailPath } from '../../lib/payout-account-route';

export async function upsertMyPayoutAccountAction(formData: FormData): Promise<void> {
  const accountHolderName = requireFormValue(formData, 'accountHolderName');
  const bankName = requireFormValue(formData, 'bankName');
  const accountNumber = requireFormValue(formData, 'accountNumber');
  const ifscCode = requireFormValue(formData, 'ifscCode');
  const upiId = optionalFormValue(formData, 'upiId');

  try {
    await upsertMyPayoutAccount({
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      ...(upiId ? { upiId } : {}),
    });
  } catch (error) {
    redirectWithMessage('/payouts/statements', 'error', formatApiError(error));
  }
  revalidatePath('/payouts/statements');
  revalidatePath('/');
  redirectWithMessage(
    '/payouts/statements',
    'notice',
    'Payout account submitted for verification.',
  );
}

export async function verifyPayoutAccountAction(formData: FormData): Promise<void> {
  const accountId = requireFormValue(formData, 'accountId');
  const userId = requireFormValue(formData, 'userId');
  const detailPath = payoutAccountDetailPath(userId);
  const status = requireFormValue(formData, 'status') as PayoutAccountStatus;
  if (status !== 'VERIFIED' && status !== 'REJECTED') {
    redirectWithMessage(detailPath, 'error', 'Invalid decision.');
  }
  const reason = optionalFormValue(formData, 'reason');
  if (status === 'REJECTED' && !reason) {
    redirectWithMessage(
      detailPath,
      'error',
      'A reason is required to reject a payout account.',
    );
  }

  try {
    await verifyPayoutAccount(accountId, { status, ...(reason ? { reason } : {}) });
  } catch (error) {
    redirectWithMessage(detailPath, 'error', formatApiError(error));
  }
  revalidatePath('/payouts/accounts');
  revalidatePath(detailPath);
  revalidatePath('/');
  redirectWithMessage(
    '/payouts/accounts',
    'notice',
    status === 'VERIFIED' ? 'Payout account verified.' : 'Payout account rejected.',
  );
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
  redirect(`${path}?${new URLSearchParams({ [type]: message }).toString()}`);
}
