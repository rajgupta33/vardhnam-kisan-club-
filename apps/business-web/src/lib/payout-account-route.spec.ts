import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { payoutAccountDetailPath } from './payout-account-route';

describe('payout account routes', () => {
  it('builds the reviewer detail route from the payout owner user ID', () => {
    assert.equal(
      payoutAccountDetailPath('80fe455b-d92d-48b6-a039-ae15cf47ba00'),
      '/payouts/accounts/80fe455b-d92d-48b6-a039-ae15cf47ba00',
    );
  });

  it('keeps an untrusted form value inside one encoded path segment', () => {
    assert.equal(payoutAccountDetailPath('../statements'), '/payouts/accounts/..%2Fstatements');
  });
});
