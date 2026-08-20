import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  commissionsListPath,
  parseCommissionBasisPoints,
  parseCommissionEntryStatus,
  parseFinancePage,
  settlementsListPath,
} from './finance-route-state';

describe('finance route state', () => {
  it('preserves independent commission dataset positions', () => {
    assert.equal(
      commissionsListPath('PROVISIONAL', 2, 4),
      '/finance/commissions?entryStatus=PROVISIONAL&rulePage=2&entryPage=4',
    );
  });

  it('rejects malformed commission filters and pages', () => {
    assert.equal(parseCommissionEntryStatus('PENDING'), undefined);
    assert.equal(parseFinancePage('2abc'), 1);
    assert.equal(parseFinancePage('0'), 1);
  });

  it('accepts only whole decimal basis points inside the backend range', () => {
    assert.equal(parseCommissionBasisPoints('500'), 500);
    assert.equal(parseCommissionBasisPoints('0'), 0);
    assert.equal(parseCommissionBasisPoints('500abc'), undefined);
    assert.equal(parseCommissionBasisPoints('5e2'), undefined);
    assert.equal(parseCommissionBasisPoints('10001'), undefined);
  });

  it('encodes settlement filter state as query data', () => {
    assert.equal(
      settlementsListPath('../seller', 3),
      '/finance/settlements?sellerOrganisationId=..%2Fseller&page=3',
    );
  });
});
