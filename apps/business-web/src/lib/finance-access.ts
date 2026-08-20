export interface FinanceAccess {
  canReadCommissionRules: boolean;
  canReadCommissionEntries: boolean;
  canReadLedger: boolean;
  canReadSettlements: boolean;
}

export function financeAccess(permissions: readonly string[]): FinanceAccess {
  return {
    canReadCommissionRules: permissions.includes('finance-commission-rules:read'),
    canReadCommissionEntries: permissions.includes('finance-commission-entries:read'),
    canReadLedger: permissions.includes('finance-ledger:read'),
    canReadSettlements: permissions.includes('finance-settlements:read'),
  };
}
