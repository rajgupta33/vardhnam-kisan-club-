'use server';

import { redirect } from 'next/navigation';
import {
  clearPortalSession,
  loginWithPassword,
  portalLandingPath,
  readPortalRefreshToken,
  readPortalSelection,
  revokePortalRefreshToken,
  selectPortalOrganisation,
  setPortalSelection,
  setPortalSession,
} from '../../lib/auth-session';
import { decodePortalAccessToken } from '../../lib/portal-access';

export async function loginAction(formData: FormData): Promise<void> {
  const identifier = readRequiredFormValue(formData, 'identifier');
  const password = readRequiredFormValue(formData, 'password');
  if (!identifier || password.length < 8) {
    redirect(loginErrorUrl('Enter a valid email or phone number and password.'));
  }

  let result;
  try {
    result = await loginWithPassword(identifier, password);
  } catch (error) {
    redirect(loginErrorUrl(errorMessage(error)));
  }

  if ('membershipSelectionRequired' in result) {
    await setPortalSelection(result.selectionToken, result.candidates);
    redirect('/login/select');
  }

  await setPortalSession(result);
  const claims = decodePortalAccessToken(result.accessToken);
  redirect(portalLandingPath(claims?.permissions ?? []));
}

export async function selectOrganisationAction(formData: FormData): Promise<void> {
  const organisationId = readRequiredFormValue(formData, 'organisationId');
  const selection = await readPortalSelection();
  if (!selection || !organisationId) {
    redirect(loginErrorUrl('Your organisation selection expired. Please sign in again.'));
  }

  let result;
  try {
    result = await selectPortalOrganisation(selection.selectionToken, organisationId);
  } catch (error) {
    redirect(`/login/select?error=${encodeURIComponent(errorMessage(error))}`);
  }

  await setPortalSession(result);
  const claims = decodePortalAccessToken(result.accessToken);
  redirect(portalLandingPath(claims?.permissions ?? []));
}

export async function logoutAction(): Promise<void> {
  const refreshToken = await readPortalRefreshToken();
  await clearPortalSession();
  if (refreshToken) {
    try {
      await revokePortalRefreshToken(refreshToken);
    } catch {
      // Local cookies are already cleared; backend revocation is best effort.
    }
  }
  redirect('/login');
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Authentication failed';
}

function loginErrorUrl(message: string): string {
  return `/login?error=${encodeURIComponent(message)}`;
}
