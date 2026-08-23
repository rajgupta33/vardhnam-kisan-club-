import { KisanClubProgrammeStatus, PlatformRole, PromoterTerritoryStatus } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { KisanClubPromoterAdminService } from '../src/kisan-club/assignment/kisan-club-promoter-admin.service';
import { KisanClubProgrammeService } from '../src/kisan-club/catalogue/kisan-club-programme.service';

function operator(permissions: string[]): CurrentUser {
  return {
    userId: '00000000-0000-4000-8000-000000009201',
    role: PlatformRole.OPERATIONS_MANAGER,
    membershipId: '00000000-0000-4000-8000-000000009202',
    organisationId: '00000000-0000-4000-8000-000000009203',
    permissions,
  };
}

describe('territory selector options', () => {
  function serviceWith(findMany: jest.Mock) {
    const prisma = { promoterTerritory: { findMany } };
    return new KisanClubPromoterAdminService(prisma as never, {} as never, {} as never);
  }

  it('returns every territory, unfiltered and unpaged', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'territory-active',
        name: 'Jaipur East',
        state: 'Rajasthan',
        district: 'Jaipur',
        status: PromoterTerritoryStatus.ACTIVE,
      },
      {
        id: 'territory-inactive',
        name: 'Jaipur West',
        state: 'Rajasthan',
        district: 'Jaipur',
        status: PromoterTerritoryStatus.INACTIVE,
      },
    ]);
    const service = serviceWith(findMany);

    const result = await service.listTerritoryOptions(
      operator([PermissionCode.KISAN_CLUB_TERRITORIES_MANAGE]),
    );

    // The inactive territory is the point: the management queue can be filtered
    // to ACTIVE, but a form must still be able to offer this one.
    expect(result.items.map((item) => item.id)).toEqual(['territory-active', 'territory-inactive']);
    expect(result.total).toBe(2);
    const [call] = findMany.mock.calls;
    expect(call?.[0]).not.toHaveProperty('where');
    expect(call?.[0]).not.toHaveProperty('take');
    expect(call?.[0]).not.toHaveProperty('skip');
  });

  it('opens to promoter-profile managers, who need it to fill their own form', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = serviceWith(findMany);

    await expect(
      service.listTerritoryOptions(operator([PermissionCode.KISAN_CLUB_PROMOTER_PROFILES_MANAGE])),
    ).resolves.toEqual({ items: [], total: 0 });
  });

  it('refuses an actor holding neither Club management permission', async () => {
    const findMany = jest.fn();
    const service = serviceWith(findMany);

    await expect(service.listTerritoryOptions(operator([]))).rejects.toMatchObject({
      status: 403,
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('programme selector options', () => {
  function serviceWith(findMany: jest.Mock) {
    const prisma = { kisanClubProductProgramme: { findMany } };
    return new KisanClubProgrammeService(prisma as never, {} as never);
  }

  it('labels each programme by its product and variant, not a bare id', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'programme-1',
        status: KisanClubProgrammeStatus.DRAFT,
        displayPriority: 10,
        product: { name: 'Adiyogi' },
        variant: { variantName: '5 kg pack' },
      },
      {
        id: 'programme-2',
        status: KisanClubProgrammeStatus.ACTIVE,
        displayPriority: 5,
        product: { name: 'Gauri' },
        variant: null,
      },
    ]);
    const service = serviceWith(findMany);

    const result = await service.listProgrammeOptions(
      operator([PermissionCode.KISAN_CLUB_PROGRAMMES_MANAGE]),
    );

    expect(result.items).toEqual([
      {
        id: 'programme-1',
        status: KisanClubProgrammeStatus.DRAFT,
        displayPriority: 10,
        productName: 'Adiyogi',
        variantName: '5 kg pack',
      },
      {
        id: 'programme-2',
        status: KisanClubProgrammeStatus.ACTIVE,
        displayPriority: 5,
        productName: 'Gauri',
        variantName: null,
      },
    ]);
    // A DRAFT programme survives: a benefit rule is drafted against it before
    // either goes live, so filtering the queue to ACTIVE must not hide it.
    expect(result.items[0]?.status).toBe(KisanClubProgrammeStatus.DRAFT);
    const [call] = findMany.mock.calls;
    expect(call?.[0]).not.toHaveProperty('where');
    expect(call?.[0]).not.toHaveProperty('take');
  });

  it('opens to benefit managers, who select a programme to author a rule', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = serviceWith(findMany);

    await expect(
      service.listProgrammeOptions(operator([PermissionCode.KISAN_CLUB_BENEFITS_MANAGE])),
    ).resolves.toEqual({ items: [], total: 0 });
  });

  it('refuses an actor holding neither programme nor benefit management', async () => {
    const findMany = jest.fn();
    const service = serviceWith(findMany);

    await expect(service.listProgrammeOptions(operator([]))).rejects.toMatchObject({
      status: 403,
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
