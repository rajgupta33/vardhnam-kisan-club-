import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWholeNumberInput } from './whole-number-input';

describe('whole-number form input', () => {
  it('accepts bounded positive and signed decimal integers', () => {
    assert.equal(parseWholeNumberInput('500', { fieldName: 'Rate', min: 1, max: 10_000 }), 500);
    assert.equal(parseWholeNumberInput('-25', { fieldName: 'Priority', min: -100, max: 100 }), -25);
    assert.equal(parseWholeNumberInput(undefined, { fieldName: 'Optional amount', min: 1 }), undefined);
  });

  it('rejects partial, fractional, exponent and unsafe values', () => {
    for (const value of ['500abc', '1.5', '5e2', '9007199254740992']) {
      assert.throws(() => parseWholeNumberInput(value, { fieldName: 'Amount', min: 1 }));
    }
  });

  it('rejects values outside the declared backend bounds', () => {
    assert.throws(() => parseWholeNumberInput('0', { fieldName: 'Rate', min: 1, max: 10_000 }));
    assert.throws(() => parseWholeNumberInput('10001', { fieldName: 'Rate', min: 1, max: 10_000 }));
  });
});
