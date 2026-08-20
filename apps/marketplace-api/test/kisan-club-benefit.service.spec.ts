import { ConflictException } from '@nestjs/common';
import { KisanClubBenefitStatus, KisanClubBenefitType } from '@prisma/client';
import {
  KisanClubBenefitService,
  calculateKisanClubBenefit,
} from '../src/kisan-club/benefits/kisan-club-benefit.service';

describe('Kisan Club benefit arithmetic', () => {
  it('uses integer basis-point arithmetic and caps the line benefit', () => {
    expect(
      calculateKisanClubBenefit({
        benefitType: KisanClubBenefitType.PERCENT_OFF,
        flatAmountPaise: null,
        percentBps: 1250,
        maxBenefitPaise: 300,
        minimumQuantity: 1,
        unitPricePaise: 999,
        quantity: 3,
      }),
    ).toEqual({ perUnitBenefitPaise: 124, totalBenefitPaise: 300 });
  });

  it('does not award a threshold benefit below minimum quantity', () => {
    expect(
      calculateKisanClubBenefit({
        benefitType: KisanClubBenefitType.QUANTITY_THRESHOLD,
        flatAmountPaise: 500,
        percentBps: null,
        maxBenefitPaise: null,
        minimumQuantity: 5,
        unitPricePaise: 2000,
        quantity: 4,
      }),
    ).toEqual({ perUnitBenefitPaise: 0, totalBenefitPaise: 0 });
  });

  it('never discounts beyond the gross line value', () => {
    expect(
      calculateKisanClubBenefit({
        benefitType: KisanClubBenefitType.FLAT_AMOUNT_OFF,
        flatAmountPaise: 2500,
        percentBps: null,
        maxBenefitPaise: null,
        minimumQuantity: 1,
        unitPricePaise: 1800,
        quantity: 2,
      }),
    ).toEqual({ perUnitBenefitPaise: 1800, totalBenefitPaise: 3600 });
  });
});

describe('KisanClubBenefitService checkout evaluation', () => {
  const now = new Date('2026-08-11T10:00:00.000Z');

  it('short-circuits ordinary checkout when the Club feature flag is disabled', async () => {
    const tx = {
      kisanClubMembership: { findFirst: jest.fn() },
      kisanClubBenefitRule: { findMany: jest.fn() },
    };
    const service = new KisanClubBenefitService(
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(false) } as never,
    );

    await expect(
      service.evaluateForCheckout(tx as never, {
        farmerProfileId: 'farmer-1',
        productId: 'product-1',
        variantId: 'variant-1',
        pincode: '302001',
        unitPricePaise: 2000,
        quantity: 2,
        at: now,
      }),
    ).resolves.toBeNull();
    expect(tx.kisanClubMembership.findFirst).not.toHaveBeenCalled();
  });

  it('recognises an eligible programme even when no benefit rule applies', async () => {
    const tx = {
      kisanClubMembership: {
        findFirst: jest.fn().mockResolvedValue({ homeDistrict: 'Jaipur' }),
      },
      kisanClubProductProgramme: {
        findFirst: jest.fn().mockResolvedValue({ id: 'programme-1' }),
      },
    };
    const service = new KisanClubBenefitService(
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(true) } as never,
    );

    await expect(
      service.isProgrammeEligibleForCheckout(tx as never, {
        farmerProfileId: 'farmer-1',
        productId: 'product-1',
        variantId: 'variant-1',
        pincode: '302001',
        at: now,
      }),
    ).resolves.toBe(true);
  });

  it('chooses the highest benefit, then the most specific rule deterministically', async () => {
    const general = ruleFixture({ id: 'rule-general', flatAmountPaise: 500 });
    const cropSpecific = ruleFixture({
      id: 'rule-crop',
      flatAmountPaise: 500,
      eligibleCropIds: ['crop-1'],
    });
    const tx = {
      kisanClubMembership: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'membership-1',
          homeDistrict: 'Jaipur',
          farms: [{ cropCycles: [{ cropId: 'crop-1' }] }],
        }),
      },
      kisanClubBenefitRule: { findMany: jest.fn().mockResolvedValue([general, cropSpecific]) },
    };
    const service = new KisanClubBenefitService(
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(true) } as never,
    );

    const result = await service.evaluateForCheckout(tx as never, {
      farmerProfileId: 'farmer-1',
      productId: 'product-1',
      variantId: 'variant-1',
      pincode: '302001',
      unitPricePaise: 2000,
      quantity: 2,
      at: now,
    });

    expect(result).toEqual({
      membershipId: 'membership-1',
      ruleId: 'rule-crop',
      perUnitBenefitPaise: 500,
      totalBenefitPaise: 1000,
    });
  });

  it('atomically rejects a redemption when the total usage limit is exhausted', async () => {
    const tx = {
      kisanClubBenefitRule: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(ruleFixture({ totalUsageLimit: 1, usageCount: 0 })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      kisanClubBenefitRedemption: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
    };
    const service = new KisanClubBenefitService(
      {} as never,
      {} as never,
      { get: jest.fn().mockReturnValue(true) } as never,
    );

    await expect(
      service.redeem(
        tx as never,
        {
          membershipId: 'membership-1',
          ruleId: 'rule-1',
          perUnitBenefitPaise: 500,
          totalBenefitPaise: 1000,
        },
        { productOrderId: 'order-1', productOrderItemId: 'item-1', quantity: 2 },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.kisanClubBenefitRedemption.create).not.toHaveBeenCalled();
  });
});

function ruleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    programmeId: 'programme-1',
    benefitType: KisanClubBenefitType.FLAT_AMOUNT_OFF,
    flatAmountPaise: 500,
    percentBps: null,
    maxBenefitPaise: null,
    minimumQuantity: 1,
    eligiblePincodes: [],
    eligibleCropIds: [],
    status: KisanClubBenefitStatus.ACTIVE,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: null,
    totalUsageLimit: null,
    perMemberUsageLimit: null,
    usageCount: 0,
    createdByUserId: null,
    createdByRole: null,
    reason: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    redemptions: [],
    ...overrides,
  };
}
