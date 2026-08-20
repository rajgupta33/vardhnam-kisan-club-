'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createMembership,
  formatApiError,
  updateMembership,
  updateOrganisation,
} from '../../lib/marketplace-api';

export async function updateOrganisationAction(formData: FormData): Promise<void> {
  const organisationId = requireFormValue(formData, 'organisationId');
  const slug = optionalFormValue(formData, 'slug');
  const legalName = optionalFormValue(formData, 'legalName');
  const displayName = optionalFormValue(formData, 'displayName');
  const gstin = optionalFormValue(formData, 'gstin');
  const reason = optionalFormValue(formData, 'reason');

  try {
    await updateOrganisation(organisationId, {
      ...(slug ? { slug } : {}),
      ...(legalName ? { legalName } : {}),
      ...(displayName ? { displayName } : {}),
      ...(gstin ? { gstin } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    redirectWithMessage(organisationId, 'error', formatApiError(error));
  }
  revalidatePath(`/organisations/${organisationId}`);
  revalidatePath('/organisations');
  redirectWithMessage(organisationId, 'notice', 'Organisation profile updated.');
}

export async function createMembershipAction(formData: FormData): Promise<void> {
  const organisationId = requireFormValue(formData, 'organisationId');
  const userId = requireFormValue(formData, 'userId');
  const role = requireFormValue(formData, 'role');

  try {
    await createMembership(organisationId, { userId, role });
  } catch (error) {
    redirectWithMessage(organisationId, 'error', formatApiError(error));
  }
  revalidatePath(`/organisations/${organisationId}`);
  redirectWithMessage(organisationId, 'notice', 'Membership created.');
}

export async function updateMembershipAction(formData: FormData): Promise<void> {
  const organisationId = requireFormValue(formData, 'organisationId');
  const membershipId = requireFormValue(formData, 'membershipId');
  const status = requireFormValue(formData, 'status');
  const reason = requireFormValue(formData, 'reason');

  try {
    await updateMembership(organisationId, membershipId, { status, reason });
  } catch (error) {
    redirectWithMessage(organisationId, 'error', formatApiError(error));
  }
  revalidatePath(`/organisations/${organisationId}`);
  redirectWithMessage(
    organisationId,
    'notice',
    status === 'SUSPENDED' ? 'Membership suspended.' : 'Membership updated.',
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

function redirectWithMessage(organisationId: string, type: 'notice' | 'error', message: string): never {
  redirect(`/organisations/${organisationId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
