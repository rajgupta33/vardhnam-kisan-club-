'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createCommissionRule,
  createSettlement,
  finalizeCommissions,
  formatApiError,
  reverseCommission,
} from '../../lib/marketplace-api';
import {
  commissionsListPath,
  parseCommissionBasisPoints,
  parseCommissionEntryStatus,
  parseFinancePage,
  settlementsListPath,
} from '../../lib/finance-route-state';

export async function createCommissionRuleAction(formData: FormData): Promise<void> {
  const returnPath = commissionReturnPath(formData);
  const marketplaceCommissionBps = parseCommissionBasisPoints(
    optionalFormValue(formData, 'marketplaceCommissionBps'),
  );
  const sellerOrganisationId = optionalFormValue(formData, 'sellerOrganisationId');
  const reason = requireFormValue(formData, 'reason');
  if (
    marketplaceCommissionBps === undefined
  ) {
    redirectWithFinanceMessage(returnPath, 'error', 'Commission must be a whole number from 0 to 10,000 BPS.');
  }

  try {
    await createCommissionRule({
      marketplaceCommissionBps,
      reason,
      ...(sellerOrganisationId ? { sellerOrganisationId } : {}),
    });
  } catch (error) {
    redirectWithFinanceMessage(returnPath, 'error', formatApiError(error));
  }
  revalidatePath('/finance');
  revalidatePath('/finance/commissions');
  redirectWithFinanceMessage(returnPath, 'notice', 'Commission rule created.');
}

export async function finalizeCommissionsAction(formData: FormData): Promise<void> {
  const returnPath = commissionReturnPath(formData);
  let finalizedCount = 0;
  try {
    finalizedCount = (await finalizeCommissions()).finalizedCount;
  } catch (error) {
    redirectWithFinanceMessage(returnPath, 'error', formatApiError(error));
  }
  revalidatePath('/finance');
  revalidatePath('/finance/commissions');
  redirectWithFinanceMessage(
    returnPath,
    'notice',
    `${finalizedCount} eligible commission entries finalised.`,
  );
}

export async function reverseCommissionAction(formData: FormData): Promise<void> {
  const returnPath = commissionReturnPath(formData);
  const entryId = requireFormValue(formData, 'entryId');
  const reason = requireFormValue(formData, 'reason');
  try {
    await reverseCommission(entryId, reason);
  } catch (error) {
    redirectWithFinanceMessage(returnPath, 'error', formatApiError(error));
  }
  revalidatePath('/finance');
  revalidatePath('/finance/commissions');
  revalidatePath('/finance/ledger');
  redirectWithFinanceMessage(returnPath, 'notice', 'Order commission entries reversed.');
}

export async function createSettlementAction(formData: FormData): Promise<void> {
  const returnPath = settlementsListPath(
    optionalFormValue(formData, 'returnSellerOrganisationId'),
    parseFinancePage(optionalFormValue(formData, 'page')),
  );
  const sellerOrganisationId = requireFormValue(formData, 'sellerOrganisationId');
  try {
    await createSettlement(sellerOrganisationId);
  } catch (error) {
    redirectWithFinanceMessage(returnPath, 'error', formatApiError(error));
  }
  revalidatePath('/finance');
  revalidatePath('/finance/settlements');
  redirectWithFinanceMessage(returnPath, 'notice', 'Settlement created.');
}

function commissionReturnPath(formData: FormData): string {
  return commissionsListPath(
    parseCommissionEntryStatus(optionalFormValue(formData, 'entryStatus')),
    parseFinancePage(optionalFormValue(formData, 'rulePage')),
    parseFinancePage(optionalFormValue(formData, 'entryPage')),
  );
}

function requireFormValue(formData: FormData, key: string): string {
  const value = optionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function redirectWithFinanceMessage(
  path: string,
  type: 'notice' | 'error',
  message: string,
): never {
  const separator = path.includes('?') ? '&' : '?';
  redirect(`${path}${separator}${new URLSearchParams({ [type]: message }).toString()}`);
}
