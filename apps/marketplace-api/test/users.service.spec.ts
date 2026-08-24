import { PlatformRole, UserStatus } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { UsersService } from '../src/identity/users.service';

describe('UsersService', () => {
  const actor: CurrentUser = {
    userId: '00000000-0000-4000-8000-000000000091',
    role: PlatformRole.SUPER_ADMIN,
    membershipId: '00000000-0000-4000-8000-000000000094',
    organisationId: '00000000-0000-4000-8000-000000000095',
    permissions: [],
  };
  const safeUser = {
    id: '00000000-0000-4000-8000-000000000092',
    email: 'safe.user@example.test',
    phone: null,
    status: UserStatus.ACTIVE,
    profile: null,
    memberships: [],
    createdAt: new Date('2026-08-24T00:00:00.000Z'),
    updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  };

  it('excludes password hashes from list and detail query projections', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(safeUser),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const service = new UsersService(prisma as never, { record: jest.fn() } as never);

    await service.list({ page: 1, limit: 25 });
    await service.getById(safeUser.id);

    const listSelection = prisma.user.findMany.mock.calls[0]?.[0]?.select;
    const detailSelection = prisma.user.findUnique.mock.calls[0]?.[0]?.select;
    expect(listSelection).toEqual(detailSelection);
    expect(listSelection.memberships.select.organisation.select.reviewedBy.select).toMatchObject({
      id: true,
      email: true,
      phone: true,
      status: true,
      profile: { select: { displayName: true } },
    });
    expect(JSON.stringify({ listSelection, detailSelection })).not.toContain('passwordHash');
  });

  it('excludes password hashes from create and update responses', async () => {
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue(safeUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(safeUser),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: safeUser.id,
          email: safeUser.email,
          phone: safeUser.phone,
          status: safeUser.status,
          profile: null,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new UsersService(prisma as never, auditService as never);

    await service.create(
      { email: safeUser.email, displayName: 'Safe User' },
      actor,
      'request-create',
    );
    await service.update(safeUser.id, {}, actor, 'request-update');

    const createSelection = tx.user.create.mock.calls[0]?.[0]?.select;
    const updateBaselineSelection = prisma.user.findUnique.mock.calls[0]?.[0]?.select;
    const updateResponseSelection = tx.user.findUniqueOrThrow.mock.calls[0]?.[0]?.select;
    expect(
      JSON.stringify({
        createSelection,
        updateBaselineSelection,
        updateResponseSelection,
      }),
    ).not.toContain('passwordHash');
    expect(createSelection).toEqual(updateResponseSelection);
  });
});
