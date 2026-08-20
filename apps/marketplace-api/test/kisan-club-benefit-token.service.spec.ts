import { BadRequestException, ConflictException } from '@nestjs/common';
import { KisanClubBenefitTokenStatus, PlatformRole } from '@prisma/client';
import { PermissionCode } from '../src/access/permission-codes';
import type { CurrentUser } from '../src/auth/current-user.interface';
import {
  generateKisanClubBenefitTokenCredential,
  KisanClubBenefitTokenService,
  verifyKisanClubBenefitTokenCode,
} from '../src/kisan-club/benefits/kisan-club-benefit-token.service';

const actor: CurrentUser = {
  userId: '00000000-0000-4000-8000-000000007001',
  role: PlatformRole.PROMOTER,
  membershipId: '00000000-0000-4000-8000-000000007002',
  organisationId: '00000000-0000-4000-8000-000000007003',
  permissions: [PermissionCode.KISAN_CLUB_ASSISTED_ORDERS_CREATE],
};
const membershipId = '00000000-0000-4000-8000-000000007004';

describe('KisanClubBenefitTokenService', () => {
  it('returns a bearer code once while keeping only a salted hash suitable for persistence', () => {
    const credential = generateKisanClubBenefitTokenCredential();

    expect(credential.code).toMatch(/^VKC-[A-F0-9]{8}-\d{6}$/);
    expect(credential.tokenHash).not.toContain(credential.code);
    expect(
      verifyKisanClubBenefitTokenCode(
        credential.code,
        credential.tokenSalt,
        credential.tokenHash,
      ),
    ).toBe(true);
    expect(
      verifyKisanClubBenefitTokenCode(
        credential.code.replace(/\d$/, credential.code.endsWith('9') ? '8' : '9'),
        credential.tokenSalt,
        credential.tokenHash,
      ),
    ).toBe(false);
  });

  it('persists a failed attempt and rejects an incorrect code', async () => {
    const credential = generateKisanClubBenefitTokenCredential();
    const current = tokenFixture(credential, { attemptCount: 0 });
    const updated = tokenFixture(credential, { attemptCount: 1 });
    const tx = {
      kisanClubBenefitToken: {
        findUnique: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = serviceWith(tx, audit);
    const wrongCode = credential.code.replace(/\d$/, credential.code.endsWith('9') ? '8' : '9');

    await expect(
      service.authorizeRedemption({ code: wrongCode, membershipId }, actor, 'request-invalid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.kisanClubBenefitToken.update).toHaveBeenCalledWith({
      where: { id: current.id },
      data: { attemptCount: 1 },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'KISAN_CLUB_BENEFIT_TOKEN_UPDATED' }),
      tx,
    );
  });

  it('marks an expired token before returning the expiry conflict', async () => {
    const credential = generateKisanClubBenefitTokenCredential();
    const current = tokenFixture(credential, { expiresAt: new Date('2020-01-01T00:00:00.000Z') });
    const expired = tokenFixture(credential, {
      status: KisanClubBenefitTokenStatus.EXPIRED,
      expiresAt: current.expiresAt,
    });
    const tx = {
      kisanClubBenefitToken: {
        findUnique: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue(expired),
      },
    };
    const service = serviceWith(tx, { record: jest.fn().mockResolvedValue({}) });

    await expect(
      service.authorizeRedemption({ code: credential.code, membershipId }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.kisanClubBenefitToken.update).toHaveBeenCalledWith({
      where: { id: current.id },
      data: { status: KisanClubBenefitTokenStatus.EXPIRED },
    });
  });
});

function serviceWith(tx: object, audit: object): KisanClubBenefitTokenService {
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  return new KisanClubBenefitTokenService(
    prisma as never,
    audit as never,
    { hasPermission: jest.fn().mockReturnValue(true) } as never,
    { get: jest.fn().mockReturnValue(72) } as never,
    {} as never,
  );
}

function tokenFixture(
  credential: ReturnType<typeof generateKisanClubBenefitTokenCredential>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: '00000000-0000-4000-8000-000000007005',
    tokenReference: credential.tokenReference,
    membershipId,
    benefitRuleId: '00000000-0000-4000-8000-000000007006',
    offerId: '00000000-0000-4000-8000-000000007007',
    promoterUserId: actor.userId,
    quantity: 2,
    quotedUnitPricePaise: 10000,
    quotedBenefitPaise: 1000,
    tokenHash: credential.tokenHash,
    tokenSalt: credential.tokenSalt,
    status: KisanClubBenefitTokenStatus.ISSUED,
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    attemptCount: 0,
    consumedAt: null,
    consumedByUserId: null,
    productOrderId: null,
    createdAt: new Date('2026-08-11T00:00:00.000Z'),
    updatedAt: new Date('2026-08-11T00:00:00.000Z'),
    membership: {
      promoterAssignments: [{ promoterUserId: actor.userId }],
    },
    ...overrides,
  };
}
