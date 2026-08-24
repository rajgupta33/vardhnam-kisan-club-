import { cookies } from 'next/headers';
import type { ProductOrder } from '@vardhnam/api-client';

/**
 * The pickup code and the farmer delivery OTP are returned by the API exactly
 * once and are persisted only as hashes, so the portal has one chance to put
 * them in front of the operator running a handoff.
 *
 * They are carried in a short-lived httpOnly cookie rather than in the redirect
 * query string: a credential in a URL is copied into browser history, into the
 * `Referer` header of every asset the page loads, and into the access log of
 * whatever proxy fronts the deployment. The cookie keeps it to the response
 * body, and the short TTL means a shared screen does not keep showing it.
 */
export const orderHandoffCookieName = 'vardhnam_order_handoff';

export const orderHandoffTtlSeconds = 180;

export interface OrderHandoffCredentials {
  pickupCode?: string;
  deliveryOtp?: string;
}

export async function writeOrderHandoffCredentials(
  orderId: string,
  credentials: OrderHandoffCredentials,
): Promise<void> {
  if (!credentials.pickupCode && !credentials.deliveryOtp) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(orderHandoffCookieName, JSON.stringify({ orderId, ...credentials }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/orders',
    maxAge: orderHandoffTtlSeconds,
  });
}

export async function readOrderHandoffCredentials(
  orderId: string,
): Promise<OrderHandoffCredentials> {
  const cookieStore = await cookies();
  return parseOrderHandoffCookie(cookieStore.get(orderHandoffCookieName)?.value, orderId);
}

/**
 * Returns the credentials only when they belong to the order being rendered, so
 * navigating to a different order never shows a code left over from the last
 * one. Anything malformed yields no credentials rather than throwing -- a stale
 * or hand-edited cookie must not break the order page.
 */
export function parseOrderHandoffCookie(
  raw: string | undefined,
  orderId: string,
): OrderHandoffCredentials {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  if (record.orderId !== orderId) {
    return {};
  }

  return {
    ...(typeof record.pickupCode === 'string' ? { pickupCode: record.pickupCode } : {}),
    ...(typeof record.deliveryOtp === 'string' ? { deliveryOtp: record.deliveryOtp } : {}),
  };
}

/**
 * Mirrors `ensureDispatchLabelCanBeIssued` in the API's checkout service, so the
 * portal only offers the button when the call would actually succeed.
 *
 * The API refuses a label unless both the order and its dispatch are ready for
 * pickup, and refuses to reissue one after pickup has been verified -- at that
 * point the code has done its job and a new one would only invalidate a
 * completed handoff.
 */
export function canIssuePickupCode(order: ProductOrder): boolean {
  if (!order.dispatch) {
    return false;
  }

  return (
    order.status === 'READY_FOR_PICKUP' &&
    order.dispatch.status === 'READY_FOR_PICKUP' &&
    !order.deliveryAssignment?.pickupVerifiedAt
  );
}
