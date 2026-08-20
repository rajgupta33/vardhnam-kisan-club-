/**
 * Which notifications a recipient is allowed to switch off.
 *
 * `TRANSACTIONAL` messages are the record of something the recipient is party to
 * — an order they placed, money that moved, a security code they asked for.
 * Suppressing those would leave someone unable to log in, or unaware that their
 * refund completed, so they are not opt-out-able and the preferences endpoint
 * rejects an attempt to disable them.
 *
 * `OPTIONAL` covers advisories and anything promotional, which a recipient may
 * silence per channel.
 */
export type CategoryClass = 'TRANSACTIONAL' | 'OPTIONAL';

/**
 * Categories are free-text on `Notification.category` because they grew with the
 * domain events that produce them. Anything not listed here is treated as
 * TRANSACTIONAL — the safe default, because a category nobody classified is more
 * likely a new order or payment event than a marketing one, and failing to
 * deliver it is worse than failing to suppress it.
 */
const optionalCategories = new Set<string>([
  'ADVISORY',
  'ADVISORY_PUBLISHED',
  'MARKETING',
  'PRODUCT_RECOMMENDATION',
  'KISAN_CLUB_PROMOTION',
]);

export function categoryClassOf(category: string): CategoryClass {
  return optionalCategories.has(category.toUpperCase()) ? 'OPTIONAL' : 'TRANSACTIONAL';
}

export function isOptOutable(category: string): boolean {
  return categoryClassOf(category) === 'OPTIONAL';
}

/** Exposed so the preferences endpoint can tell a client what is adjustable. */
export const optOutableCategories: ReadonlyArray<string> = [...optionalCategories].sort();
