import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOrderPage, summarizeOrderQueue } from './order-queue-metrics';

describe('order queue metrics', () => {
  it('counts operational rows without deriving a financial total', () => {
    assert.deepEqual(
      summarizeOrderQueue([
        { itemCount: 2, status: 'CONFIRMED' },
        { itemCount: 3, status: 'READY_FOR_PICKUP' },
        { itemCount: 1, status: 'OUT_FOR_DELIVERY' },
      ]),
      { sellerActionCount: 1, itemCount: 6 },
    );
  });

  it('treats only whole positive page values as valid', () => {
    assert.equal(parseOrderPage('3'), 3);
    assert.equal(parseOrderPage('3abc'), 1);
    assert.equal(parseOrderPage('0'), 1);
    assert.equal(parseOrderPage('9007199254740992'), 1);
  });
});
