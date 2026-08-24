import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { paginationOffset } from '../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const safeUserIdentitySelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  profile: { select: { displayName: true } },
} satisfies Prisma.UserSelect;

const organisationResponseSelect = {
  id: true,
  type: true,
  slug: true,
  legalName: true,
  displayName: true,
  gstin: true,
  registeredStateCode: true,
  gstinVerifiedAt: true,
  status: true,
  reviewedAt: true,
  reviewedByUserId: true,
  reviewedBy: { select: safeUserIdentitySelect },
  reviewReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganisationSelect;

const userResponseSelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  profile: {
    select: {
      id: true,
      userId: true,
      displayName: true,
      preferredLocale: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  memberships: {
    select: {
      id: true,
      userId: true,
      organisationId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      organisation: { select: organisationResponseSelect },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.UserWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        {
          profile: {
            displayName: {
              contains: query.q,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userResponseSelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userResponseSelect,
    });

    if (!user) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User was not found',
      });
    }

    return user;
  }

  async create(dto: CreateUserDto, actor: CurrentUser, requestId?: string) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'Either email or phone is required',
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            profile: {
              create: {
                displayName: dto.displayName,
                preferredLocale: dto.preferredLocale ?? 'en-IN',
                timezone: dto.timezone ?? 'Asia/Kolkata',
              },
            },
          },
          select: userResponseSelect,
        });

        const auditInput: AuditRecordInput = this.withActor(actor, {
          action: 'USER_CREATED',
          resourceType: 'User',
          resourceId: user.id,
          newValue: {
            email: user.email,
            phone: user.phone,
            status: user.status,
          } satisfies Prisma.InputJsonObject,
        });

        if (requestId) {
          auditInput.requestId = requestId;
        }

        await this.auditService.record(auditInput, tx);

        return user;
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'User email or phone already exists');
      throw error;
    }
  }

  async update(userId: string, dto: UpdateUserDto, actor: CurrentUser, requestId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        profile: {
          select: {
            id: true,
            displayName: true,
            preferredLocale: true,
            timezone: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User was not found',
      });
    }

    const userData: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) {
      userData.email = dto.email;
    }
    if (dto.phone !== undefined) {
      userData.phone = dto.phone;
    }
    if (dto.status !== undefined) {
      userData.status = dto.status;
    }

    const profileData: Prisma.UserProfileUpdateInput = {};
    if (dto.displayName !== undefined) {
      profileData.displayName = dto.displayName;
    }
    if (dto.preferredLocale !== undefined) {
      profileData.preferredLocale = dto.preferredLocale;
    }
    if (dto.timezone !== undefined) {
      profileData.timezone = dto.timezone;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: userData,
          });

          const auditInput = this.withActor(actor, {
            action:
              dto.status !== undefined && dto.status !== existing.status
                ? 'USER_STATUS_CHANGED'
                : 'USER_UPDATED',
            resourceType: 'User',
            resourceId: userId,
            previousValue: {
              email: existing.email,
              phone: existing.phone,
              status: existing.status,
            } satisfies Prisma.InputJsonObject,
            newValue: {
              email: dto.email ?? existing.email,
              phone: dto.phone ?? existing.phone,
              status: dto.status ?? existing.status,
            } satisfies Prisma.InputJsonObject,
          });

          this.attachAuditContext(auditInput, requestId, dto.reason);
          await this.auditService.record(auditInput, tx);
        }

        if (Object.keys(profileData).length > 0) {
          await tx.userProfile.upsert({
            where: { userId },
            create: {
              user: {
                connect: {
                  id: userId,
                },
              },
              displayName: dto.displayName ?? existing.profile?.displayName ?? 'Unnamed User',
              preferredLocale: dto.preferredLocale ?? existing.profile?.preferredLocale ?? 'en-IN',
              timezone: dto.timezone ?? existing.profile?.timezone ?? 'Asia/Kolkata',
            },
            update: profileData,
          });

          const auditInput = this.withActor(actor, {
            action: 'USER_PROFILE_UPDATED',
            resourceType: 'UserProfile',
            resourceId: existing.profile?.id ?? userId,
            previousValue: {
              displayName: existing.profile?.displayName ?? null,
              preferredLocale: existing.profile?.preferredLocale ?? null,
              timezone: existing.profile?.timezone ?? null,
            } satisfies Prisma.InputJsonObject,
            newValue: {
              displayName: dto.displayName ?? existing.profile?.displayName ?? null,
              preferredLocale: dto.preferredLocale ?? existing.profile?.preferredLocale ?? null,
              timezone: dto.timezone ?? existing.profile?.timezone ?? null,
            } satisfies Prisma.InputJsonObject,
          });

          this.attachAuditContext(auditInput, requestId, dto.reason);
          await this.auditService.record(auditInput, tx);
        }

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: userResponseSelect,
        });
      });
    } catch (error) {
      this.throwConflictForKnownUniqueError(error, 'User email or phone already exists');
      throw error;
    }
  }

  private withActor(actor: CurrentUser, input: AuditRecordInput): AuditRecordInput {
    return {
      ...input,
      actorUserId: actor.userId,
      actorRole: actor.role,
      organisationId: input.organisationId ?? actor.organisationId,
    };
  }

  private attachAuditContext(
    auditInput: AuditRecordInput,
    requestId?: string,
    reason?: string,
  ): void {
    if (requestId) {
      auditInput.requestId = requestId;
    }
    if (reason) {
      auditInput.reason = reason;
    }
  }

  private throwConflictForKnownUniqueError(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message,
      });
    }
  }
}
