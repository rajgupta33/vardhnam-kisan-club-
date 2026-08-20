import {
  PromoterMatchingService,
  type PromoterMatchCandidate,
} from '../src/kisan-club/assignment/promoter-matching.service';

describe('PromoterMatchingService', () => {
  const service = new PromoterMatchingService();

  it('prioritises village, then pincode, then territory, then capacity', () => {
    const result = service.match(
      { village: 'Rampur', pincode: '207001' },
      [
        candidate({ promoterUserId: 'b', homePincode: '207001', activeFarmerCount: 1 }),
        candidate({
          promoterUserId: 'a',
          homeVillage: 'rampur',
          homePincode: '207999',
          activeFarmerCount: 99,
        }),
      ],
    );

    expect(result.selectedPromoterUserId).toBe('a');
  });

  it('excludes every candidate that fails an eligibility condition and explains why', () => {
    const result = service.match(
      { village: null, pincode: '207001' },
      [
        candidate({
          promoterUserId: 'disabled',
          clubEnabled: false,
          kycApproved: false,
          activeFarmerCount: 150,
        }),
      ],
    );

    expect(result.selectedPromoterUserId).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({
      eligible: false,
      excludedReasons: expect.arrayContaining(['CLUB_DISABLED', 'KYC_NOT_APPROVED', 'AT_CAPACITY']),
    });
  });

  it('uses capacity headroom before stable promoter ID for otherwise equal candidates', () => {
    const result = service.match(
      { village: 'Other', pincode: '207001' },
      [
        candidate({ promoterUserId: 'a', activeFarmerCount: 80 }),
        candidate({ promoterUserId: 'z', activeFarmerCount: 20 }),
      ],
    );
    expect(result.selectedPromoterUserId).toBe('z');
  });

  it('uses promoter ID as the deterministic final tie-break', () => {
    const result = service.match(
      { village: null, pincode: '207001' },
      [candidate({ promoterUserId: 'z' }), candidate({ promoterUserId: 'a' })],
    );
    expect(result.selectedPromoterUserId).toBe('a');
  });
});

function candidate(overrides: Partial<PromoterMatchCandidate>): PromoterMatchCandidate {
  return {
    promoterUserId: 'promoter',
    territoryId: 'territory',
    homeVillage: null,
    homePincode: null,
    territoryPincodes: ['207001'],
    userActive: true,
    membershipActive: true,
    clubEnabled: true,
    acceptingNewFarmers: true,
    territoryActive: true,
    kycApproved: true,
    payoutEligible: true,
    activeFarmerCount: 0,
    maxActiveFarmers: 150,
    ...overrides,
  };
}
