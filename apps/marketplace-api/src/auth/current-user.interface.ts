import type { PlatformRole } from '@prisma/client';

export interface CurrentUser {
  userId: string;
  role: PlatformRole;
  membershipId: string;
  organisationId: string;
  permissions: string[];
}
