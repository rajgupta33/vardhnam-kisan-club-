import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseReturnInspectionDispositions } from './return-inspection-input';

describe('return inspection form input', () => {
  it('includes positive whole quantities and omits zero or blank outcomes', () => {
    const entries: Array<[string, FormDataEntryValue]> = [
      ['disposition:item-1:reservation-1:RESTOCKABLE', '2'],
      ['disposition:item-1:reservation-1:QUARANTINED', '0'],
      ['disposition:item-1:reservation-1:DAMAGED_WRITE_OFF', '   '],
      ['inspectionNote', 'Labels checked'],
    ];

    assert.deepEqual(parseReturnInspectionDispositions(entries), [
      {
        returnRequestItemId: 'item-1',
        reservationId: 'reservation-1',
        outcome: 'RESTOCKABLE',
        quantity: 2,
      },
    ]);
  });

  it('rejects malformed, fractional, exponent, negative and unsafe quantities', () => {
    for (const value of ['2units', '1.5', '1e2', '-1', '9007199254740992']) {
      assert.throws(() =>
        parseReturnInspectionDispositions([
          ['disposition:item-1:reservation-1:RESTOCKABLE', value],
        ]),
      );
    }
  });

  it('ignores fields that are not valid disposition controls', () => {
    assert.deepEqual(
      parseReturnInspectionDispositions([
        ['disposition:item-1:reservation-1:UNKNOWN', '1'],
        ['disposition:item-1:reservation-1:RESTOCKABLE:extra', '1'],
        ['unrelated', '1'],
      ]),
      [],
    );
  });
});
