import { KisanClubMembershipStatus, PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { KisanClubCatalogueService } from '../src/kisan-club/catalogue/kisan-club-catalogue.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000009101',
  role: PlatformRole.FARMER,
  membershipId: '00000000-0000-4000-8000-000000009102',
  organisationId: '00000000-0000-4000-8000-000000009103',
  permissions: [],
};

describe('KisanClubCatalogueService', () => {
  it('passes only region-eligible active programme mappings into marketplace discovery', async () => {
    const prisma = {
      kisanClubMembership: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'membership',
          status: KisanClubMembershipStatus.ACTIVE,
          homePincode: '207001',
          homeDistrict: 'Etah',
        }),
      },
      kisanClubProductProgramme: {
        findMany: jest.fn().mockResolvedValue([
          programme({ id: 'eligible', eligiblePincodes: ['207001'] }),
          programme({ id: 'wrong-region', eligiblePincodes: ['302001'] }),
        ]),
      },
    };
    const marketplace = {
      listProducts: jest.fn().mockResolvedValue({
        items: [{ id: 'product-1', lowestPricePaise: 10000 }],
        page: 1,
        limit: 25,
        total: 1,
      }),
    };
    const service = new KisanClubCatalogueService(prisma as never, marketplace as never);

    const result = await service.listProducts({ pincode: '207001' }, actor);

    expect(marketplace.listProducts).toHaveBeenCalledWith(
      { pincode: '207001' },
      {
        programmeEligibility: [
          {
            productId: 'product-1',
            variantId: null,
            displayPriority: 10,
            programmeId: 'eligible',
          },
        ],
      },
    );
    expect(result.items[0]?.clubProgrammes).toEqual([
      { id: 'eligible', variantId: null, displayPriority: 10 },
    ]);
  });
});

function programme(overrides: Record<string, unknown>) {
  return {
    id: 'programme',
    productId: 'product-1',
    variantId: null,
    displayPriority: 10,
    eligiblePincodes: [],
    eligibleDistricts: [],
    variant: null,
    ...overrides,
  };
}
