import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessPortalPath,
  decodePortalAccessToken,
  portalLandingPath,
  type PortalAccessClaims,
} from './lib/portal-access';

const cookieNames = {
  accessToken: 'vardhnam_portal_access',
  refreshToken: 'vardhnam_portal_refresh',
} as const;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/forbidden') {
    return NextResponse.next();
  }

  let accessToken = request.cookies.get(cookieNames.accessToken)?.value;
  const refreshToken = request.cookies.get(cookieNames.refreshToken)?.value;
  let claims = accessToken ? decodePortalAccessToken(accessToken) : null;
  let rotatedTokens: TokenPair | null = null;

  const accessTokenValid =
    Boolean(accessToken && claims && !isExpiring(claims)) &&
    (await validateAccessToken(accessToken as string));
  if (!accessTokenValid && refreshToken) {
    rotatedTokens = await rotateTokens(refreshToken);
    accessToken = rotatedTokens?.accessToken;
    claims = accessToken ? decodePortalAccessToken(accessToken) : null;
  } else if (!accessTokenValid) {
    claims = null;
  }

  const isLoginRoute = pathname === '/login' || pathname.startsWith('/login/');
  if (!claims) {
    if (isLoginRoute) {
      return clearInvalidSessionIfNeeded(NextResponse.next(), Boolean(refreshToken));
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`);
    return clearInvalidSessionIfNeeded(NextResponse.redirect(loginUrl), Boolean(refreshToken));
  }

  if (isLoginRoute) {
    const response = NextResponse.redirect(
      new URL(portalLandingPath(claims.permissions), request.url),
    );
    return rotatedTokens ? applyRotatedSession(response, rotatedTokens) : response;
  }

  if (!canAccessPortalPath(pathname, claims.permissions)) {
    const response = NextResponse.rewrite(new URL('/forbidden', request.url), { status: 403 });
    return rotatedTokens ? applyRotatedSession(response, rotatedTokens) : response;
  }

  if (!rotatedTokens) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const existingCookie = requestHeaders.get('cookie');
  requestHeaders.set(
    'cookie',
    [
      existingCookie,
      `${cookieNames.accessToken}=${rotatedTokens.accessToken}`,
      `${cookieNames.refreshToken}=${rotatedTokens.refreshToken}`,
    ]
      .filter(Boolean)
      .join('; '),
  );
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applyRotatedSession(response, rotatedTokens);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

function isExpiring(claims: PortalAccessClaims): boolean {
  return !claims.exp || claims.exp <= Math.floor(Date.now() / 1000) + 30;
}

async function rotateTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok || !isTokenEnvelope(payload)) {
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
}

async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isTokenEnvelope(value: unknown): value is { data: TokenPair } {
  if (typeof value !== 'object' || value === null || !('data' in value)) {
    return false;
  }
  const data = value.data;
  return (
    typeof data === 'object' &&
    data !== null &&
    'accessToken' in data &&
    typeof data.accessToken === 'string' &&
    'refreshToken' in data &&
    typeof data.refreshToken === 'string'
  );
}

function applyRotatedSession(response: NextResponse, tokens: TokenPair): NextResponse {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  const accessClaims = decodePortalAccessToken(tokens.accessToken);
  const accessMaxAge = accessClaims?.exp
    ? Math.max(1, accessClaims.exp - Math.floor(Date.now() / 1000))
    : 15 * 60;
  response.cookies.set(cookieNames.accessToken, tokens.accessToken, {
    ...options,
    maxAge: accessMaxAge,
  });
  response.cookies.set(cookieNames.refreshToken, tokens.refreshToken, {
    ...options,
    maxAge: refreshCookieMaxAge(),
  });
  return response;
}

function clearInvalidSessionIfNeeded(response: NextResponse, shouldClear: boolean): NextResponse {
  if (shouldClear) {
    response.cookies.delete(cookieNames.accessToken);
    response.cookies.delete(cookieNames.refreshToken);
  }
  return response;
}

function refreshCookieMaxAge(): number {
  const configured = Number(process.env.BUSINESS_WEB_REFRESH_COOKIE_MAX_AGE_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : 30 * 86_400;
}

function apiBaseUrl(): string {
  return (
    process.env.BUSINESS_WEB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}
