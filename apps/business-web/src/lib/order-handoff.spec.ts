import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProductOrder } from '@vardhnam/api-client';
import {
  canIssuePickupCode,
  orderHandoffTtlSeconds,
  parseOrderHandoffCookie,
} from './order-handoff';

const orderId = '00000000-0000-4000-8000-000000000001';
const otherOrderId = '00000000-0000-4000-8000-000000000002';

function orderFixture(overrides: Partial<ProductOrder> = {}): ProductOrder {
  return {
    id: orderId,
    status: 'READY_FOR_PICKUP',
    dispatch: { status: 'READY_FOR_PICKUP' },
    ...overrides,
  } as unknown as ProductOrder;
}

describe('order handoff credentials', () => {
  it('returns the pickup code and delivery OTP recorded for this order', () => {
    const raw = JSON.stringify({
      orderId,
      pickupCode: 'VARDHNAM-PICKUP:dispatch:token',
      deliveryOtp: '123456',
    });

    assert.deepEqual(parseOrderHandoffCookie(raw, orderId), {
      pickupCode: 'VARDHNAM-PICKUP:dispatch:token',
      deliveryOtp: '123456',
    });
  });

  it('returns only the fields that were recorded', () => {
    const raw = JSON.stringify({ orderId, pickupCode: 'VARDHNAM-PICKUP:dispatch:token' });

    assert.deepEqual(parseOrderHandoffCookie(raw, orderId), {
      pickupCode: 'VARDHNAM-PICKUP:dispatch:token',
    });
  });

  it('withholds credentials issued for a different order', () => {
    const raw = JSON.stringify({ orderId: otherOrderId, deliveryOtp: '123456' });

    assert.deepEqual(parseOrderHandoffCookie(raw, orderId), {});
  });

  it('ignores a missing, malformed or non-object cookie', () => {
    assert.deepEqual(parseOrderHandoffCookie(undefined, orderId), {});
    assert.deepEqual(parseOrderHandoffCookie('', orderId), {});
    assert.deepEqual(parseOrderHandoffCookie('not-json', orderId), {});
    assert.deepEqual(parseOrderHandoffCookie('null', orderId), {});
    assert.deepEqual(parseOrderHandoffCookie('"a string"', orderId), {});
  });

  it('drops credential fields that are not strings', () => {
    const raw = JSON.stringify({ orderId, pickupCode: 42, deliveryOtp: { code: '123456' } });

    assert.deepEqual(parseOrderHandoffCookie(raw, orderId), {});
  });

  it('expires well inside a delivery OTP validity window', () => {
    assert.ok(orderHandoffTtlSeconds > 0);
    assert.ok(orderHandoffTtlSeconds <= 600);
  });
});

describe('pickup code issuing gate', () => {
  it('allows issuing once the order and its dispatch are ready for pickup', () => {
    assert.equal(canIssuePickupCode(orderFixture()), true);
  });

  it('allows reissuing while pickup is still unverified', () => {
    const order = orderFixture({
      deliveryAssignment: { pickupVerifiedAt: null },
    } as unknown as Partial<ProductOrder>);

    assert.equal(canIssuePickupCode(order), true);
  });

  it('refuses once pickup has been verified', () => {
    const order = orderFixture({
      deliveryAssignment: { pickupVerifiedAt: '2026-08-25T04:00:00.000Z' },
    } as unknown as Partial<ProductOrder>);

    assert.equal(canIssuePickupCode(order), false);
  });

  it('refuses before the order reaches ready for pickup', () => {
    assert.equal(canIssuePickupCode(orderFixture({ status: 'PACKED' })), false);
  });

  it('refuses when the dispatch itself has been cancelled', () => {
    const order = orderFixture({
      dispatch: { status: 'CANCELLED' },
    } as unknown as Partial<ProductOrder>);

    assert.equal(canIssuePickupCode(order), false);
  });

  it('refuses when no dispatch exists yet', () => {
    const order = { id: orderId, status: 'READY_FOR_PICKUP' } as unknown as ProductOrder;

    assert.equal(canIssuePickupCode(order), false);
  });
});
