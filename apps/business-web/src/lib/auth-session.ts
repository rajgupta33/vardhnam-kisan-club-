import 'server-only';

import { cookies } from 'next/headers';
import { decodePortalAccessToken, type PortalAccessClaims } from './portal-access';

export { portalLandingPath } from './portal-access';

export const portalCookieNames = {
  accessToken: 'vardhnam_portal_access',
  refreshToken: 'vardhnam_portal_refresh',
  selectionToken: 'vardhnam_portal_selection',
  selectionCandidates: 'vardhnam_portal_candidates',
} as const;

export interface PortalTokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  membershipId: string;
  organisationId: string;
  role: string;
}

export interface PortalSelectionCandidate {
  organisationId: string;
  organisationName: string;
  role: string;
}

export interface PortalSelectionRequired {
  membershipSelectionRequired: true;
  selectionToken: string;
  candidates: PortalSelectionCandidate[];
}

export type PortalLoginResponse = PortalTokenPair | PortalSelectionRequired;

interface ApiSuccessEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

export class PortalAuthError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PortalAuthError';
  }
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<PortalLoginResponse> {
  return authRequest<PortalLoginResponse>('auth/login', { identifier, password });
}

export async function selectPortalOrganisation(
  selectionToken: string,
  organisationId: string,
): Promise<PortalTokenPair> {
  return authRequest<PortalTokenPair>('auth/select-organisation', {
    selectionToken,
    organisationId,
  });
}

export async function revokePortalRefreshToken(refreshToken: string): Promise<void> {
  await authRequest<{ loggedOut: boolean }>(
    'auth/logout',
    { refreshToken },
    { Authorization: `Bearer ${refreshToken}` },
  );
}

export async function setPortalSession(tokens: PortalTokenPair): Promise<void> {
  const cookieStore = await cookies();
  const baseOptions = portalCookieOptions();
  const claims = decodePortalAccessToken(tokens.accessToken);
  const accessMaxAge = claims?.exp
    ? Math.max(1, claims.exp - Math.floor(Date.now() / 1000))
    : 15 * 60;

  cookieStore.set(portalCookieNames.accessToken, tokens.accessToken, {
    ...baseOptions,
    maxAge: accessMaxAge,
  });
  cookieStore.set(portalCookieNames.refreshToken, tokens.refreshToken, {
    ...baseOptions,
    maxAge: readRefreshCookieMaxAge(),
  });
  clearPortalSelection(cookieStore);
}

export async function setPortalSelection(
  selectionToken: string,
  candidates: PortalSelectionCandidate[],
): Promise<void> {
  const cookieStore = await cookies();
  const options = { ...portalCookieOptions(), maxAge: 5 * 60 };
  cookieStore.set(portalCookieNames.selectionToken, selectionToken, options);
  cookieStore.set(
    portalCookieNames.selectionCandidates,
    Buffer.from(JSON.stringify(candidates), 'utf8').toString('base64url'),
    options,
  );
}

export async function readPortalSelection(): Promise<{
  selectionToken: string;
  candidates: PortalSelectionCandidate[];
} | null> {
  const cookieStore = await cookies();
  const selectionToken = cookieStore.get(portalCookieNames.selectionToken)?.value;
  const encodedCandidates = cookieStore.get(portalCookieNames.selectionCandidates)?.value;
  if (!selectionToken || !encodedCandidates) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encodedCandidates, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(parsed) || !parsed.every(isSelectionCandidate)) {
      return null;
    }
    return { selectionToken, candidates: parsed };
  } catch {
    return null;
  }
}

export async function readPortalSession(): Promise<PortalAccessClaims | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(portalCookieNames.accessToken)?.value;
  return accessToken ? decodePortalAccessToken(accessToken) : null;
}

export async function readPortalAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(portalCookieNames.accessToken)?.value;
}

export async function readPortalRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(portalCookieNames.refreshToken)?.value;
}

export async function clearPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  for (const name of Object.values(portalCookieNames)) {
    cookieStore.delete(name);
  }
}

function isSelectionCandidate(value: unknown): value is PortalSelectionCandidate {
  return (
    isRecord(value) &&
    typeof value.organisationId === 'string' &&
    typeof value.organisationName === 'string' &&
    typeof value.role === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clearPortalSelection(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  cookieStore.delete(portalCookieNames.selectionToken);
  cookieStore.delete(portalCookieNames.selectionCandidates);
}

function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

function readRefreshCookieMaxAge(): number {
  const configured = Number(process.env.BUSINESS_WEB_REFRESH_COOKIE_MAX_AGE_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : 30 * 86_400;
}

async function authRequest<T>(
  path: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new PortalAuthError('The authentication service is unavailable');
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(payload) ? (payload as ApiErrorEnvelope).error : undefined;
    throw new PortalAuthError(error?.message ?? 'Authentication failed', error?.code);
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new PortalAuthError('The authentication service returned an invalid response');
  }
  return (payload as unknown as ApiSuccessEnvelope<T>).data;
}

function apiBaseUrl(): string {
  return (
    process.env.BUSINESS_WEB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}
