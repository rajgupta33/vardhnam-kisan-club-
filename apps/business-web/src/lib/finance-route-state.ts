import type { CommissionEntryStatus } from './marketplace-api';

export const commissionEntryStatusValues = ['PROVISIONAL', 'FINAL', 'REVERSED'] as const satisfies readonly CommissionEntryStatus[];

export function parseCommissionEntryStatus(value: string | undefined): CommissionEntryStatus | undefined {
  return commissionEntryStatusValues.includes(value as CommissionEntryStatus)
    ? (value as CommissionEntryStatus)
    : undefined;
}

export function parseFinancePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseCommissionBasisPoints(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const basisPoints = Number(value);
  return Number.isSafeInteger(basisPoints) && basisPoints <= 10_000 ? basisPoints : undefined;
}

export function commissionsListPath(
  entryStatus: CommissionEntryStatus | undefined,
  rulePage: number,
  entryPage: number,
): string {
  const params = new URLSearchParams();
  if (entryStatus) params.set('entryStatus', entryStatus);
  const safeRulePage = parseFinancePage(String(rulePage));
  const safeEntryPage = parseFinancePage(String(entryPage));
  if (safeRulePage > 1) params.set('rulePage', String(safeRulePage));
  if (safeEntryPage > 1) params.set('entryPage', String(safeEntryPage));
  const query = params.toString();
  return query ? `/finance/commissions?${query}` : '/finance/commissions';
}

export function settlementsListPath(
  sellerOrganisationId: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (sellerOrganisationId) params.set('sellerOrganisationId', sellerOrganisationId);
  const safePage = parseFinancePage(String(page));
  if (safePage > 1) params.set('page', String(safePage));
  const query = params.toString();
  return query ? `/finance/settlements?${query}` : '/finance/settlements';
}
