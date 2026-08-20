'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createPortalUser,
  formatApiError,
  updatePortalUser,
  type PortalUserStatus,
} from '../../lib/marketplace-api';

export async function createUserAction(formData: FormData): Promise<void> {
  const displayName = requireFormValue(formData, 'displayName');
  const email = optionalFormValue(formData, 'email');
  const phone = optionalFormValue(formData, 'phone');
  if (!email && !phone) {
    redirectListWithMessage('error', 'Provide an email or a phone number.');
  }

  let userId: string;
  try {
    const user = await createPortalUser({
      displayName,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
    userId = user.id;
  } catch (error) {
    redirectListWithMessage('error', formatApiError(error));
  }
  revalidatePath('/users');
  redirect(`/users/${userId}?${new URLSearchParams({ notice: 'User created.' }).toString()}`);
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const userId = requireFormValue(formData, 'userId');
  const displayName = optionalFormValue(formData, 'displayName');
  const email = optionalFormValue(formData, 'email');
  const phone = optionalFormValue(formData, 'phone');
  const status = optionalFormValue(formData, 'status') as PortalUserStatus | undefined;
  const reason = optionalFormValue(formData, 'reason');

  try {
    await updatePortalUser(userId, {
      ...(displayName ? { displayName } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    redirectDetailWithMessage(userId, 'error', formatApiError(error));
  }
  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  redirectDetailWithMessage(userId, 'notice', 'User updated.');
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

function redirectListWithMessage(type: 'notice' | 'error', message: string): never {
  redirect(`/users?${new URLSearchParams({ [type]: message }).toString()}`);
}

function redirectDetailWithMessage(userId: string, type: 'notice' | 'error', message: string): never {
  redirect(`/users/${userId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
