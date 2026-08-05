import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  PrismaClient,
} from '@prisma/client';
import { permissionDefinitions, rolePermissions } from '../src/access/permission-codes';

const prisma = new PrismaClient();
const seedAdminOrganisationId = '00000000-0000-4000-8000-000000000001';
const seedAdminUserId = '00000000-0000-4000-8000-000000000002';

async function main(): Promise<void> {
  const adminOrg = await prisma.organisation.upsert({
    where: { slug: 'vardhnam-admin' },
    create: {
      id: seedAdminOrganisationId,
      type: OrganisationType.VARDHNAM,
      slug: 'vardhnam-admin',
      legalName: 'Vardhnam Agrotech',
      displayName: 'Vardhnam Admin',
      status: OrganisationStatus.ACTIVE,
    },
    update: {
      displayName: 'Vardhnam Admin',
      status: OrganisationStatus.ACTIVE,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.local' },
    create: {
      id: seedAdminUserId,
      email: 'admin@example.local',
      status: 'ACTIVE',
      profile: {
        create: {
          displayName: 'Phase 0 Admin',
          preferredLocale: 'en-IN',
          timezone: 'Asia/Kolkata',
        },
      },
    },
    update: {},
  });

  await prisma.organisationMembership.upsert({
    where: {
      userId_organisationId_role: {
        userId: adminUser.id,
        organisationId: adminOrg.id,
        role: PlatformRole.SUPER_ADMIN,
      },
    },
    create: {
      userId: adminUser.id,
      organisationId: adminOrg.id,
      role: PlatformRole.SUPER_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      status: MembershipStatus.ACTIVE,
    },
  });

  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const savedPermission = await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
    permissionByCode.set(savedPermission.code, savedPermission.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);

      if (!permissionId) {
        throw new Error(`Permission ${permissionCode} is missing from seed definitions`);
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: role as PlatformRole,
            permissionId,
          },
        },
        create: {
          role: role as PlatformRole,
          permissionId,
        },
        update: {},
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: adminUser.id,
      actorRole: PlatformRole.SUPER_ADMIN,
      organisationId: adminOrg.id,
      action: 'SEED_DATA_APPLIED',
      resourceType: 'SeedData',
      resourceId: 'phase0',
      reason: 'Local development seed data',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
