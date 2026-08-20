export function payoutAccountDetailPath(userId: string): string {
  return `/payouts/accounts/${encodeURIComponent(userId)}`;
}
