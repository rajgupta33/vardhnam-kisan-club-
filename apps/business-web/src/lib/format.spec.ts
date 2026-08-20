import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPaise } from './format';

describe('portal formatters', () => {
  it('formats backend-provided paise as locale-safe INR', () => {
    assert.equal(formatPaise(123456), '₹1,234.56');
    assert.equal(formatPaise(0), '₹0.00');
    assert.equal(formatPaise(-5000), '-₹50.00');
  });
});
