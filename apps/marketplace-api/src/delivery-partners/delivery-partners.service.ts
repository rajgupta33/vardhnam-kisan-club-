import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DeliveryPartnerAvailabilityStatus,
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  Prisma,
  type DeliveryPartnerProfile,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateDeliveryPartnerAvailabilityDto } from './dto/update-delivery-partner-availability.dto';

@Injectable()
export class DeliveryPartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getMyProfile(actor: CurrentUser) {
    await this.ensureDeliveryPartnerContext(actor);
    const profile = await this.prisma.deliveryPartnerProfile.findUnique({
      where: {
        userId_organisationId: {
          userId: actor.userId,
          organisationId: actor.organisationId,
        },
      },
    });

    return profile
      ? this.toView(profile)
      : {
          id: null,
          userId: actor.userId,
          organisationId: actor.organisationId,
          availabilityStatus: DeliveryPartnerAvailabilityStatus.OFFLINE,
          availabilityChangedAt: null,
          createdAt: null,
          updatedAt: null,
        };
  }

  async updateMyAvailability(
    dto: UpdateDeliveryPartnerAvailabilityDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    await this.ensureDeliveryPartnerContext(actor);
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.deliveryPartnerProfile.findUnique({
          where: {
            userId_organisationId: {
              userId: actor.userId,
              organisationId: actor.organisationId,
            },
          },
        });

        if (existing?.availabilityStatus === dto.availabilityStatus) {
          return this.toView(existing);
        }

        const changedAt = new Date();
        const profile = await tx.deliveryPartnerProfile.upsert({
          where: {
            userId_organisationId: {
              userId: actor.userId,
              organisationId: actor.organisationId,
            },
          },
          create: {
            userId: actor.userId,
            organisationId: actor.organisationId,
            availabilityStatus: dto.availabilityStatus,
            availabilityChangedAt: changedAt,
          },
          update: {
            availabilityStatus: dto.availabilityStatus,
            availabilityChangedAt: changedAt,
          },
        });

        await this.auditService.record(
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: actor.organisationId,
            action: 'DELIVERY_PARTNER_AVAILABILITY_UPDATED',
            resourceType: 'DeliveryPartnerProfile',
            resourceId: profile.id,
            previousValue: existing ? this.auditValue(existing) : undefined,
            newValue: this.auditValue(profile),
            requestId,
            reason: `Delivery partner changed availability to ${dto.availabilityStatus}`,
          },
          tx,
        );

        return this.toView(profile);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async ensureDeliveryPartnerContext(actor: CurrentUser): Promise<void> {
    const membership = await this.prisma.organisationMembership.findFirst({
      where: {
        id: actor.membershipId,
        userId: actor.userId,
        organisationId: actor.organisationId,
        role: PlatformRole.DELIVERY_PARTNER,
        status: MembershipStatus.ACTIVE,
        organisation: {
          type: OrganisationType.DELIVERY_PARTNER,
          status: OrganisationStatus.ACTIVE,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_FAILED,
        message: 'An active delivery partner organisation context is required',
      });
    }
  }

  private toView(profile: DeliveryPartnerProfile) {
    return {
      id: profile.id,
      userId: profile.userId,
      organisationId: profile.organisationId,
      availabilityStatus: profile.availabilityStatus,
      availabilityChangedAt: profile.availabilityChangedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private auditValue(profile: DeliveryPartnerProfile): Prisma.InputJsonObject {
    return {
      userId: profile.userId,
      organisationId: profile.organisationId,
      availabilityStatus: profile.availabilityStatus,
      availabilityChangedAt: profile.availabilityChangedAt?.toISOString() ?? null,
    };
  }
}
