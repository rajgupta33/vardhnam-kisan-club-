import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, OrganisationStatus, PlatformRole } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCode, permissionDefinitions, rolePermissions } from './permission-codes';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  listRoles() {
    return Object.values(PlatformRole).map((role) => ({
      role,
      permissions: rolePermissions[role],
    }));
  }

  listPermissions() {
    return permissionDefinitions;
  }

  async getPermissionCodesForRole(role: PlatformRole): Promise<string[]> {
    const permissions = await this.prisma.rolePermission.findMany({
      where: {
        role,
      },
      include: {
        permission: true,
      },
      orderBy: {
        permission: {
          code: 'asc',
        },
      },
    });

    return permissions.map((rolePermission) => rolePermission.permission.code);
  }

  hasPermission(user: CurrentUser, permission: PermissionCode): boolean {
    return user.permissions.includes(permission);
  }

  async ensureCanReadOrganisation(user: CurrentUser, organisationId: string): Promise<void> {
    if (this.hasPermission(user, PermissionCode.ORGANISATIONS_READ_ANY)) {
      return;
    }

    if (!this.hasPermission(user, PermissionCode.ORGANISATIONS_READ_OWN)) {
      throw this.forbidden('Organisation read permission is required');
    }

    if (user.organisationId !== organisationId) {
      throw this.forbidden('Users may only read their active organisation context');
    }

    await this.ensureActiveMembership(user.userId, organisationId, user.role);
  }

  async ensureCanReadMemberships(user: CurrentUser, organisationId: string): Promise<void> {
    if (this.hasPermission(user, PermissionCode.MEMBERSHIPS_READ_ANY)) {
      return;
    }

    if (!this.hasPermission(user, PermissionCode.MEMBERSHIPS_READ_OWN)) {
      throw this.forbidden('Membership read permission is required');
    }

    if (user.organisationId !== organisationId) {
      throw this.forbidden('Users may only read memberships for their active organisation context');
    }

    await this.ensureActiveMembership(user.userId, organisationId, user.role);
  }

  private async ensureActiveMembership(
    userId: string,
    organisationId: string,
    role: PlatformRole,
  ): Promise<void> {
    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        userId,
        organisationId,
        role,
        status: MembershipStatus.ACTIVE,
        organisation: {
          status: OrganisationStatus.ACTIVE,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Active organisation membership was not found',
      });
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({
      code: ApiErrorCode.FORBIDDEN,
      message,
    });
  }
}
