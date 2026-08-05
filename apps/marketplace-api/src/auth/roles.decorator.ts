import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '@prisma/client';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export const RequireRoles = (...roles: PlatformRole[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);
