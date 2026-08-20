import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KisanClubAssignmentReason,
  KisanClubAssignmentStatus,
  KisanClubMembershipStatus,
  KycDocumentStatus,
  MembershipStatus,
  PayoutAccountStatus,
  PlatformRole,
  Prisma,
  PromoterTerritoryStatus,
  UserStatus,
  type KisanClubPromoterAssignment,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PromotersService } from '../../promoters/promoters.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReassignKisanClubPromoterDto } from '../dto/reassign-kisan-club-promoter.dto';
import {
  PromoterMatchingService,
  type PromoterMatchCandidate,
} from './promoter-matching.service';

const promoterRoles: PlatformRole[] = [PlatformRole.PROMOTER, PlatformRole.SALES_PARTNER];

@Injectable()
export class KisanClubAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly promotersService: PromotersService,
    private readonly matchingService: PromoterMatchingService,
    private readonly configService: ConfigService,
  ) {}

  async getMyPromoter(actor: CurrentUser) {
    this.ensureFarmer(actor);
    return this.prisma.kisanClubPromoterAssignment.findFirst({
      where: {
        status: KisanClubAssignmentStatus.ACTIVE,
        membership: { farmerProfile: { userId: actor.userId } },
      },
      select: {
        id: true,
        promoterUserId: true,
        territoryId: true,
        status: true,
        assignedAt: true,
        territory: {
          select: { id: true, name: true, state: true, district: true },
        },
        promoterUser: {
          select: {
            id: true,
            phone: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });
  }

  async listMyAssignedFarmers(actor: CurrentUser) {
    this.ensurePromoter(actor);
    return this.prisma.kisanClubPromoterAssignment.findMany({
      where: { promoterUserId: actor.userId, status: KisanClubAssignmentStatus.ACTIVE },
      select: {
        id: true,
        membershipId: true,
        territoryId: true,
        status: true,
        assignedAt: true,
        membership: {
          select: {
            id: true,
            memberNumber: true,
            status: true,
            homeVillage: true,
            homeDistrict: true,
            homeState: true,
            homePincode: true,
            farmerProfile: {
              select: {
                id: true,
                fullName: true,
                preferredLocale: true,
              },
            },
            farms: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                village: true,
                district: true,
                state: true,
                pincode: true,
                areaAcres: true,
                ownershipType: true,
                irrigationSource: true,
                soilType: true,
                cropCycles: {
                  where: { status: { in: ['PLANNED', 'ACTIVE'] } },
                  select: {
                    id: true,
                    cropId: true,
                    crop: true,
                    varietyName: true,
                    areaAcres: true,
                    season: true,
                    sowingDate: true,
                    expectedHarvestDate: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        territory: { select: { id: true, name: true, state: true, district: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getMyAssignedFarmer(membershipId: string, actor: CurrentUser) {
    this.ensurePromoter(actor);
    const assignment = await this.prisma.kisanClubPromoterAssignment.findFirst({
      where: {
        membershipId,
        promoterUserId: actor.userId,
        status: KisanClubAssignmentStatus.ACTIVE,
      },
      select: {
        id: true,
        membershipId: true,
        territoryId: true,
        status: true,
        assignedAt: true,
        membership: {
          select: {
            id: true,
            memberNumber: true,
            status: true,
            homeVillage: true,
            homeDistrict: true,
            homeState: true,
            homePincode: true,
            farmerProfile: {
              select: {
                id: true,
                fullName: true,
                preferredLocale: true,
              },
            },
            farms: {
              select: {
                id: true,
                name: true,
                village: true,
                district: true,
                state: true,
                pincode: true,
                areaAcres: true,
                ownershipType: true,
                irrigationSource: true,
                soilType: true,
                isActive: true,
                cropCycles: {
                  select: {
                    id: true,
                    cropId: true,
                    crop: true,
                    varietyName: true,
                    areaAcres: true,
                    season: true,
                    sowingDate: true,
                    expectedHarvestDate: true,
                    actualHarvestDate: true,
                    status: true,
                    yieldQuintals: true,
                    activities: { orderBy: { occurredOn: 'desc' }, take: 20 },
                  },
                },
              },
            },
          },
        },
        territory: { select: { id: true, name: true, state: true, district: true } },
      },
    });
    if (!assignment) throw this.notFound('Assigned Kisan Club farmer was not found');
    return assignment;
  }

  async reassignPromoter(
    membershipId: string,
    dto: ReassignKisanClubPromoterDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    const membership = await this.prisma.kisanClubMembership.findUnique({
      where: { id: membershipId },
      include: { farmerProfile: true },
    });
    if (!membership) throw this.notFound('Kisan Club membership was not found');
    if (
      membership.status === KisanClubMembershipStatus.CLOSED ||
      membership.status === KisanClubMembershipStatus.SUSPENDED ||
      membership.status === KisanClubMembershipStatus.INACTIVE
    ) {
      throw this.conflict('This Kisan Club membership cannot receive a promoter');
    }
    if (membership.status === KisanClubMembershipStatus.PENDING_PROFILE) {
      throw this.conflict('Complete the farm profile before assigning a promoter');
    }
    if (dto.promoterUserId && dto.assignmentReason === KisanClubAssignmentReason.AUTO_MATCHED) {
      throw this.conflict('AUTO_MATCHED cannot be used with a manually selected promoter');
    }
    if (!dto.promoterUserId && dto.assignmentReason !== KisanClubAssignmentReason.AUTO_MATCHED) {
      throw this.conflict('Automatic matching requires assignmentReason AUTO_MATCHED');
    }

    const profiles = await this.loadCandidateProfiles(dto.promoterUserId);
    const matchResult = this.matchingService.match(
      { village: membership.homeVillage, pincode: membership.homePincode },
      profiles.map((profile) => this.toMatchCandidate(profile)),
    );
    const selectedUserId = dto.promoterUserId ?? matchResult.selectedPromoterUserId;
    const selectedDiagnostic = matchResult.diagnostics.find(
      (item) => item.promoterUserId === selectedUserId,
    );
    if (!selectedUserId || !selectedDiagnostic?.eligible) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'No eligible Kisan Club promoter is available',
        details: matchResult,
      });
    }
    const selectedProfile = profiles.find((profile) => profile.promoterUserId === selectedUserId);
    if (!selectedProfile) throw this.conflict('Selected promoter profile is unavailable');

    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.kisanClubPromoterAssignment.findFirst({
          where: { membershipId, status: KisanClubAssignmentStatus.ACTIVE },
        });
        if (current?.promoterUserId === selectedUserId) {
          return current;
        }
        if (current) {
          await tx.kisanClubPromoterAssignment.update({
            where: { id: current.id },
            data: { status: KisanClubAssignmentStatus.ENDED, endedAt: new Date() },
          });
          await tx.kisanClubPromoterProfile.updateMany({
            where: { promoterUserId: current.promoterUserId, activeFarmerCount: { gt: 0 } },
            data: { activeFarmerCount: { decrement: 1 } },
          });
        }

        const capacityUpdate = await tx.kisanClubPromoterProfile.updateMany({
          where: {
            promoterUserId: selectedUserId,
            clubEnabled: true,
            acceptingNewFarmers: true,
            activeFarmerCount: { lt: selectedProfile.maxActiveFarmers },
          },
          data: { activeFarmerCount: { increment: 1 } },
        });
        if (capacityUpdate.count !== 1) {
          throw this.conflict('Selected promoter no longer has available capacity');
        }

        const attribution = await this.promotersService.createAttributionInTransaction(
          {
            farmerUserId: membership.farmerProfile.userId,
            promoterUserId: selectedUserId,
            reason: dto.reason.trim(),
          },
          actor,
          tx,
          requestId,
        );
        const assignment = await tx.kisanClubPromoterAssignment.create({
          data: {
            membershipId,
            promoterUserId: selectedUserId,
            territoryId: selectedProfile.territoryId,
            assignmentReason: dto.assignmentReason,
            matchScore: matchResult as unknown as Prisma.InputJsonValue,
            assignedByUserId: actor.userId,
            assignedByRole: actor.role,
            reason: dto.reason.trim(),
            promoterAttributionId: attribution.id,
          },
        });
        await tx.kisanClubMembership.update({
          where: { id: membershipId },
          data: { status: KisanClubMembershipStatus.ACTIVE },
        });
        await this.auditService.record(
          {
            action: current
              ? 'KISAN_CLUB_PROMOTER_REASSIGNED'
              : 'KISAN_CLUB_PROMOTER_ASSIGNED',
            resourceType: 'KisanClubPromoterAssignment',
            resourceId: assignment.id,
            actorUserId: actor.userId,
            actorRole: actor.role,
            organisationId: actor.organisationId,
            previousValue: current ? this.assignmentAuditValue(current) : undefined,
            newValue: this.assignmentAuditValue(assignment),
            requestId,
            reason: dto.reason.trim(),
          },
          tx,
        );
        return assignment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async loadCandidateProfiles(promoterUserId?: string) {
    const now = new Date();
    return this.prisma.kisanClubPromoterProfile.findMany({
      where: promoterUserId ? { promoterUserId } : {},
      include: {
        promoterUser: {
          select: {
            status: true,
            payoutAccount: { select: { status: true } },
            memberships: {
              where: { role: { in: promoterRoles } },
              select: { organisationId: true, status: true, role: true },
            },
          },
        },
        promoterOrganisation: {
          select: {
            status: true,
            kycDocuments: {
              where: {
                status: KycDocumentStatus.APPROVED,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
              select: { id: true },
            },
          },
        },
        territory: true,
      },
    });
  }

  private toMatchCandidate(
    profile: Awaited<ReturnType<KisanClubAssignmentService['loadCandidateProfiles']>>[number],
  ): PromoterMatchCandidate {
    const membershipActive = profile.promoterUser.memberships.some(
      (membership) =>
        membership.organisationId === profile.promoterOrganisationId &&
        membership.status === MembershipStatus.ACTIVE,
    );
    const commissionBps = this.configService.get<number>(
      'DEFAULT_KISAN_CLUB_PROMOTER_COMMISSION_BPS',
      0,
    );
    return {
      promoterUserId: profile.promoterUserId,
      territoryId: profile.territoryId,
      homeVillage: profile.homeVillage,
      homePincode: profile.homePincode,
      territoryPincodes: profile.territory?.pincodes ?? [],
      userActive: profile.promoterUser.status === UserStatus.ACTIVE,
      membershipActive,
      clubEnabled: profile.clubEnabled,
      acceptingNewFarmers: profile.acceptingNewFarmers,
      territoryActive: profile.territory?.status === PromoterTerritoryStatus.ACTIVE,
      kycApproved:
        profile.promoterOrganisation.status === 'ACTIVE' &&
        profile.promoterOrganisation.kycDocuments.length > 0,
      payoutEligible:
        commissionBps === 0 ||
        profile.promoterUser.payoutAccount?.status === PayoutAccountStatus.VERIFIED,
      activeFarmerCount: profile.activeFarmerCount,
      maxActiveFarmers: profile.maxActiveFarmers,
    };
  }

  private assignmentAuditValue(
    assignment: KisanClubPromoterAssignment,
  ): Prisma.InputJsonObject {
    return {
      membershipId: assignment.membershipId,
      promoterUserId: assignment.promoterUserId,
      territoryId: assignment.territoryId,
      status: assignment.status,
      assignmentReason: assignment.assignmentReason,
      promoterAttributionId: assignment.promoterAttributionId,
    };
  }

  private ensureFarmer(actor: CurrentUser): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw this.forbidden('Farmer role is required');
    }
  }

  private ensurePromoter(actor: CurrentUser): void {
    if (!promoterRoles.includes(actor.role)) {
      throw this.forbidden('Promoter or sales-partner role is required');
    }
  }

  private forbidden(message: string): ForbiddenException {
    return new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message });
  }

  private conflict(message: string): ConflictException {
    return new ConflictException({ code: ApiErrorCode.CONFLICT, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
