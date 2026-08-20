import type { PlatformRole, PrismaClient } from '@prisma/client';
import { permissionDefinitions, rolePermissions } from '../../../src/access/permission-codes';

export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  const permissionByCode = new Map<string, string>();
  for (const permission of permissionDefinitions) {
    const saved = await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { description: permission.description },
    });
    permissionByCode.set(saved.code, saved.id);
  }

  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const permissionCode of permissions) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) throw new Error(`Missing permission ${permissionCode}`);
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: role as PlatformRole, permissionId } },
        create: { role: role as PlatformRole, permissionId },
        update: {},
      });
    }
  }
}
