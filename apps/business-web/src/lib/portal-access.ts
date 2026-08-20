export interface PortalAccessClaims {
  sub: string;
  membershipId: string;
  organisationId: string;
  role: string;
  permissions: string[];
  exp?: number;
}

const routePermissions: Array<{ prefix: string; any: string[] }> = [
  // Granted to every role (permission-codes.ts), so `/` is reachable to every
  // authenticated session and is always the first landing candidate below.
  { prefix: '/', any: ['dashboards:read'] },
  { prefix: '/onboarding', any: ['onboarding:queue:read'] },
  { prefix: '/catalogue', any: ['catalogue:read:any', 'catalogue:read:own'] },
  { prefix: '/inventory', any: ['inventory:read:any', 'inventory:read:own'] },
  { prefix: '/offers', any: ['offers:read:any', 'offers:read:own'] },
  {
    prefix: '/orders',
    any: ['fulfilment-orders:read:any', 'fulfilment-orders:read:own'],
  },
  { prefix: '/returns', any: ['returns:read:any', 'returns:read:seller-own'] },
  { prefix: '/advisory', any: ['advisory-rules:manage', 'advisory-rules:review'] },
  {
    prefix: '/kisan-club/network',
    any: ['kisan-club-territories:manage', 'kisan-club-promoter-profiles:manage'],
  },
  {
    prefix: '/kisan-club/commercial',
    any: ['kisan-club-programmes:manage', 'kisan-club-benefits:manage'],
  },
  {
    prefix: '/kisan-club/fulfilment',
    any: ['kisan-club-fulfilment:read:own', 'kisan-club-fulfilment:read:any'],
  },
  {
    prefix: '/kisan-club/intelligence',
    any: ['kisan-club-intelligence:read'],
  },
  { prefix: '/kisan-club', any: ['kisan-club-memberships:read:any'] },
  { prefix: '/finance/ledger', any: ['finance-ledger:read'] },
  { prefix: '/finance/settlements', any: ['finance-settlements:read'] },
  {
    prefix: '/finance/commissions',
    any: ['finance-commission-rules:read', 'finance-commission-entries:read'],
  },
  {
    prefix: '/finance',
    any: [
      'finance-commission-rules:read',
      'finance-ledger:read',
      'finance-commission-entries:read',
      'finance-settlements:read',
    ],
  },
  { prefix: '/support', any: ['support-tickets:read:any'] },
  { prefix: '/disputes', any: ['disputes:read:any'] },
  // Most specific payouts prefixes first: an account reviewer and a
  // recipient reading their own statement need different permissions even
  // though both routes share the `/payouts` parent.
  { prefix: '/payouts/accounts', any: ['payout-accounts:read:any'] },
  { prefix: '/payouts/statements', any: ['payout-statements:read:own', 'payout-accounts:read:own'] },
  { prefix: '/notifications', any: ['notifications:read:any'] },
  { prefix: '/tally', any: ['tally-sync:read'] },
  { prefix: '/organisations', any: ['organisations:read:any'] },
  { prefix: '/users', any: ['users:read:any'] },
  { prefix: '/admin/jobs', any: ['jobs:read'] },
  { prefix: '/audit', any: ['audit:read'] },
];

const landingCandidates = [
  '/',
  '/onboarding',
  '/catalogue',
  '/inventory',
  '/offers',
  '/orders',
  '/returns',
  '/disputes',
  '/advisory',
  '/kisan-club',
  '/kisan-club/network',
  '/kisan-club/commercial',
  '/kisan-club/fulfilment',
  '/kisan-club/intelligence',
  '/finance',
  '/payouts/accounts',
  '/payouts/statements',
  '/support',
  '/notifications',
  '/tally',
  '/organisations',
  '/users',
  '/admin/jobs',
  '/audit',
];

export function canAccessPortalPath(pathname: string, permissions: string[]): boolean {
  const rule = routePermissions.find(({ prefix }) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return !rule || rule.any.some((permission) => permissions.includes(permission));
}

export function portalLandingPath(permissions: string[]): string {
  return landingCandidates.find((path) => canAccessPortalPath(path, permissions)) ?? '/forbidden';
}

export function decodePortalAccessToken(token: string): PortalAccessClaims | null {
  const parts = token.split('.');
  const encodedPayload = parts[1];
  if (parts.length !== 3 || !encodedPayload) {
    return null;
  }

  try {
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return isPortalAccessClaims(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPortalAccessClaims(value: unknown): value is PortalAccessClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'sub' in value &&
    typeof value.sub === 'string' &&
    'membershipId' in value &&
    typeof value.membershipId === 'string' &&
    'organisationId' in value &&
    typeof value.organisationId === 'string' &&
    'role' in value &&
    typeof value.role === 'string' &&
    'permissions' in value &&
    Array.isArray(value.permissions) &&
    value.permissions.every((permission) => typeof permission === 'string') &&
    (!('exp' in value) || value.exp === undefined || typeof value.exp === 'number')
  );
}
