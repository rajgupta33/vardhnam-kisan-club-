import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { financeAccess } from './finance-access';

describe('finance portal access', () => {
  it('does not widen a ledger-only session into other finance datasets', () => {
    assert.deepEqual(financeAccess(['finance-ledger:read']), {
      canReadCommissionRules: false,
      canReadCommissionEntries: false,
      canReadLedger: true,
      canReadSettlements: false,
    });
  });

  it('keeps commission rules and entries independently readable', () => {
    assert.deepEqual(financeAccess(['finance-commission-entries:read']), {
      canReadCommissionRules: false,
      canReadCommissionEntries: true,
      canReadLedger: false,
      canReadSettlements: false,
    });
  });
});
