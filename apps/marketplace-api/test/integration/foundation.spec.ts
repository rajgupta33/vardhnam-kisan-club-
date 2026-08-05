import { randomUUID } from 'node:crypto';
import { MembershipStatus, OrganisationType, PlatformRole, PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

describe('Phase 0 database foundation', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to PostgreSQL', async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it('creates user, organisation, membership and audit records', async () => {
    const suffix = randomUUID();

    const user = await prisma.user.create({
      data: {
        email: `phase0-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Phase 0 Integration User',
            preferredLocale: 'en-IN',
            timezone: 'Asia/Kolkata',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.DISTRIBUTOR,
        slug: `phase0-${suffix}`,
        legalName: 'Phase 0 Distributor Private Limited',
        displayName: 'Phase 0 Distributor',
      },
    });

    const membership = await prisma.organisationMembership.create({
      data: {
        userId: user.id,
        organisationId: organisation.id,
        role: PlatformRole.DISTRIBUTOR_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const auditLog = await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: PlatformRole.DISTRIBUTOR_OWNER,
        organisationId: organisation.id,
        action: 'INTEGRATION_FOUNDATION_CREATED',
        resourceType: 'OrganisationMembership',
        resourceId: membership.id,
        requestId: `test-${suffix}`,
        reason: 'Phase 0 integration test',
      },
    });

    expect(user.profile?.displayName).toBe('Phase 0 Integration User');
    expect(organisation.type).toBe(OrganisationType.DISTRIBUTOR);
    expect(membership.status).toBe(MembershipStatus.ACTIVE);
    expect(auditLog.resourceId).toBe(membership.id);
  });

  it('prevents duplicate organisation memberships at database level', async () => {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `duplicate-${suffix}@example.local`,
        profile: {
          create: {
            displayName: 'Duplicate Test User',
          },
        },
      },
    });
    const organisation = await prisma.organisation.create({
      data: {
        type: OrganisationType.COMPANY,
        slug: `duplicate-${suffix}`,
        legalName: 'Duplicate Company Private Limited',
        displayName: 'Duplicate Company',
      },
    });

    await prisma.organisationMembership.create({
      data: {
        userId: user.id,
        organisationId: organisation.id,
        role: PlatformRole.COMPANY_OWNER,
      },
    });

    await expect(
      prisma.organisationMembership.create({
        data: {
          userId: user.id,
          organisationId: organisation.id,
          role: PlatformRole.COMPANY_OWNER,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } satisfies Partial<Prisma.PrismaClientKnownRequestError>);
  });
});
