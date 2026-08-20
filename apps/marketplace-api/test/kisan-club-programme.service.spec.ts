import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  KisanClubProgrammeStatus,
  PlatformRole,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { CurrentUser } from '../src/auth/current-user.interface';
import { KisanClubProgrammeService } from '../src/kisan-club/catalogue/kisan-club-programme.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000009001',
  role: PlatformRole.OPERATIONS_MANAGER,
  membershipId: '00000000-0000-4000-8000-000000009002',
  organisationId: '00000000-0000-4000-8000-000000009003',
  permissions: [],
};

describe('KisanClubProgrammeService', () => {
  it('rejects a product that is not an approved Vardhnam-owned product', async () => {
    const service = new KisanClubProgrammeService(
      { masterProduct: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createProgramme(
        {
          productId: '00000000-0000-4000-8000-000000009010',
          startsAt: '2026-08-01T00:00:00.000Z',
          reason: 'Pilot enrolment',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a draft programme and audits its regional scope', async () => {
    const programme = programmeFixture();
    const tx = {
      kisanClubProductProgramme: { create: jest.fn().mockResolvedValue(programme) },
    };
    const prisma = {
      masterProduct: { findFirst: jest.fn().mockResolvedValue({ id: programme.productId }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const auditService = { record: jest.fn().mockResolvedValue({}) };
    const service = new KisanClubProgrammeService(prisma as never, auditService as never);

    const result = await service.createProgramme(
      {
        productId: programme.productId,
        startsAt: '2026-08-01T00:00:00.000Z',
        eligiblePincodes: ['207001', '207001'],
        eligibleDistricts: ['Etah'],
        displayPriority: 10,
        reason: 'Pilot enrolment',
      },
      actor,
      'req-programme',
    );

    expect(result.id).toBe(programme.id);
    expect(tx.kisanClubProductProgramme.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eligiblePincodes: ['207001'] }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KISAN_CLUB_PROGRAMME_CREATED',
        requestId: 'req-programme',
      }),
      tx,
    );
  });

  it('does not reopen an ended programme', async () => {
    const current = programmeFixture({ status: KisanClubProgrammeStatus.ENDED });
    const service = new KisanClubProgrammeService(
      {
        kisanClubProductProgramme: { findUnique: jest.fn().mockResolvedValue(current) },
      } as never,
      { record: jest.fn() } as never,
    );
    await expect(
      service.updateProgramme(
        current.id,
        { status: KisanClubProgrammeStatus.ACTIVE, reason: 'Reopen' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function programmeFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000009011',
    productId: '00000000-0000-4000-8000-000000009010',
    variantId: null,
    status: KisanClubProgrammeStatus.DRAFT,
    startsAt: new Date('2026-08-01T00:00:00.000Z'),
    endsAt: null,
    eligiblePincodes: ['207001'],
    eligibleDistricts: ['Etah'],
    displayPriority: 10,
    createdByUserId: actor.userId,
    createdByRole: actor.role,
    reason: 'Pilot enrolment',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  } as Prisma.KisanClubProductProgrammeUncheckedCreateInput & {
    id: string;
    createdAt: Date;
    updatedAt: Date;
  };
}
