import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessPortalPath, decodePortalAccessToken, portalLandingPath } from './portal-access';

describe('portal access policy', () => {
  it('keeps finance routes unavailable to a distributor permission set', () => {
    const permissions = ['inventory:read:own', 'offers:read:own'];
    assert.equal(canAccessPortalPath('/inventory', permissions), true);
    assert.equal(canAccessPortalPath('/finance', permissions), false);
    assert.equal(canAccessPortalPath('/finance/settlements', permissions), false);
    assert.equal(portalLandingPath(permissions), '/inventory');
  });

  it('allows a finance reader only into the finance surfaces they can read', () => {
    const permissions = ['finance-ledger:read'];
    assert.equal(canAccessPortalPath('/finance', permissions), true);
    assert.equal(canAccessPortalPath('/finance/ledger', permissions), true);
    assert.equal(canAccessPortalPath('/finance/settlements', permissions), false);
    assert.equal(portalLandingPath(permissions), '/finance');
  });

  it('allows seller-scoped returns without exposing unrelated portal areas', () => {
    const permissions = ['returns:read:seller-own'];
    assert.equal(canAccessPortalPath('/returns', permissions), true);
    assert.equal(canAccessPortalPath('/returns/return-id', permissions), true);
    assert.equal(canAccessPortalPath('/finance', permissions), false);
    assert.equal(portalLandingPath(permissions), '/returns');
  });

  it('routes advisory staff to the advisory workspace', () => {
    const permissions = ['advisory-rules:manage', 'advisory-rules:review'];
    assert.equal(canAccessPortalPath('/advisory', permissions), true);
    assert.equal(canAccessPortalPath('/advisory/rule-id', permissions), true);
    assert.equal(canAccessPortalPath('/catalogue', permissions), false);
    assert.equal(portalLandingPath(permissions), '/advisory');
  });

  it('keeps Kisan Club member operations behind the staff read permission', () => {
    const permissions = ['kisan-club-memberships:read:any'];
    assert.equal(canAccessPortalPath('/kisan-club', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club/member-id', permissions), true);
    assert.equal(canAccessPortalPath('/advisory', permissions), false);
    assert.equal(portalLandingPath(permissions), '/kisan-club');
  });

  it('allows Club network managers without granting member-record access', () => {
    const permissions = ['kisan-club-territories:manage'];
    assert.equal(canAccessPortalPath('/kisan-club/network', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club', permissions), false);
    assert.equal(canAccessPortalPath('/kisan-club/member-id', permissions), false);
    assert.equal(portalLandingPath(permissions), '/kisan-club/network');
  });

  it('isolates Club commercial administration from member and network records', () => {
    const permissions = ['kisan-club-benefits:manage'];
    assert.equal(canAccessPortalPath('/kisan-club/commercial', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club/network', permissions), false);
    assert.equal(canAccessPortalPath('/kisan-club', permissions), false);
    assert.equal(portalLandingPath(permissions), '/kisan-club/commercial');
  });

  it('allows a promoter into only the own-scoped Club fulfilment workspace', () => {
    const permissions = ['kisan-club-fulfilment:read:own', 'kisan-club-fulfilment:manage:own'];
    assert.equal(canAccessPortalPath('/kisan-club/fulfilment', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club/fulfilment/assignment-id', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club/network', permissions), false);
    assert.equal(portalLandingPath(permissions), '/kisan-club/fulfilment');
  });

  it('isolates aggregate Club intelligence from member and fulfilment records', () => {
    const permissions = ['kisan-club-intelligence:read'];
    assert.equal(canAccessPortalPath('/kisan-club/intelligence', permissions), true);
    assert.equal(canAccessPortalPath('/kisan-club', permissions), false);
    assert.equal(canAccessPortalPath('/kisan-club/fulfilment', permissions), false);
    assert.equal(portalLandingPath(permissions), '/kisan-club/intelligence');
  });

  it('lands every authenticated session on the dashboard, since every role has dashboards:read', () => {
    const permissions = ['dashboards:read'];
    assert.equal(canAccessPortalPath('/', permissions), true);
    assert.equal(portalLandingPath(permissions), '/');
  });

  it('still lands a session without dashboards:read on its first reachable area', () => {
    const permissions = ['inventory:read:own', 'offers:read:own'];
    assert.equal(canAccessPortalPath('/', permissions), false);
    assert.equal(portalLandingPath(permissions), '/inventory');
  });

  it('separates the onboarding queue from the dashboard now that they are different routes', () => {
    const permissions = ['onboarding:queue:read'];
    assert.equal(canAccessPortalPath('/onboarding', permissions), true);
    assert.equal(canAccessPortalPath('/', permissions), false);
    assert.equal(portalLandingPath(permissions), '/onboarding');
  });

  it('keeps disputes behind their own read permission', () => {
    const permissions = ['disputes:read:any'];
    assert.equal(canAccessPortalPath('/disputes', permissions), true);
    assert.equal(canAccessPortalPath('/disputes/dispute-id', permissions), true);
    assert.equal(canAccessPortalPath('/support', permissions), false);
  });

  it('gives payout account reviewers only the accounts queue, not the recipient statement page', () => {
    const permissions = ['payout-accounts:read:any'];
    assert.equal(canAccessPortalPath('/payouts/accounts', permissions), true);
    assert.equal(canAccessPortalPath('/payouts/statements', permissions), false);
  });

  it('gives a payout recipient only their own statement page, not the accounts queue', () => {
    const permissions = ['payout-statements:read:own'];
    assert.equal(canAccessPortalPath('/payouts/statements', permissions), true);
    assert.equal(canAccessPortalPath('/payouts/accounts', permissions), false);
  });

  it('keeps notifications, Tally, organisations, users and admin jobs behind their own read permissions', () => {
    assert.equal(canAccessPortalPath('/notifications', ['notifications:read:any']), true);
    assert.equal(canAccessPortalPath('/notifications', ['notifications:read:own']), false);
    assert.equal(canAccessPortalPath('/tally', ['tally-sync:read']), true);
    assert.equal(canAccessPortalPath('/organisations', ['organisations:read:any']), true);
    assert.equal(canAccessPortalPath('/users', ['users:read:any']), true);
    assert.equal(canAccessPortalPath('/admin/jobs', ['jobs:read']), true);
    assert.equal(canAccessPortalPath('/admin/jobs', ['tally-sync:read']), false);
  });

  it('decodes valid access claims and rejects malformed tokens', () => {
    const payload = {
      sub: 'user-id',
      membershipId: 'membership-id',
      organisationId: 'organisation-id',
      role: 'FINANCE_MANAGER',
      permissions: ['finance-ledger:read'],
      exp: 2_000_000_000,
    };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    assert.deepEqual(decodePortalAccessToken(token), payload);
    assert.equal(decodePortalAccessToken('not-a-jwt'), null);
  });
});
