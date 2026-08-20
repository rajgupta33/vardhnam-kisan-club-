import { advisoryRuleMatches } from '../src/advisory/advisory-matching';

const rule = {
  cropName: 'Mustard',
  varietyName: null,
  minDaysAfterSowing: 20,
  maxDaysAfterSowing: 30,
  eligibleDistricts: ['Etah'],
  eligibleStates: ['Uttar Pradesh'],
  seasons: ['RABI_2026_27'],
};

describe('advisoryRuleMatches', () => {
  it.each([20, 25, 30])('includes the day-window boundary %i', (daysAfterSowing) => {
    expect(
      advisoryRuleMatches(rule, {
        cropName: 'mustard',
        varietyName: 'Pusa Bold',
        district: 'ETAH',
        state: 'uttar pradesh',
        season: 'rabi_2026_27',
        daysAfterSowing,
      }),
    ).toBe(true);
  });

  it.each([
    ['before the window', { daysAfterSowing: 19 }],
    ['after the window', { daysAfterSowing: 31 }],
    ['another district', { district: 'Agra' }],
    ['another season', { season: 'KHARIF_2026' }],
    ['another crop', { cropName: 'Wheat' }],
  ])('rejects %s', (_label, override) => {
    expect(
      advisoryRuleMatches(rule, {
        cropName: 'Mustard',
        varietyName: null,
        district: 'Etah',
        state: 'Uttar Pradesh',
        season: 'RABI_2026_27',
        daysAfterSowing: 25,
        ...override,
      }),
    ).toBe(false);
  });

  it('requires an exact variety only when the rule specifies one', () => {
    expect(
      advisoryRuleMatches(
        { ...rule, varietyName: 'Pusa Bold' },
        {
          cropName: 'Mustard',
          varietyName: 'Other',
          district: 'Etah',
          state: 'Uttar Pradesh',
          season: 'RABI_2026_27',
          daysAfterSowing: 25,
        },
      ),
    ).toBe(false);
  });
});
