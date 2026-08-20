import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogueStatus,
  CropCycleStatus,
  FarmActivitySource,
  KisanClubMembershipStatus,
  MembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  PromoterAttributionStatus,
  UserStatus,
  type Farm,
  type FarmCropCycle,
  type KisanClubMembership,
} from '@prisma/client';
import { AuditService, type AuditRecordInput } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user.interface';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCropCycleDto } from './dto/create-crop-cycle.dto';
import type { CreateFarmActivityDto } from './dto/create-farm-activity.dto';
import type { CreateAttributedFarmSurveyDto } from './dto/create-attributed-farm-survey.dto';
import type { CreateFarmDto } from './dto/create-farm.dto';
import type { CreateFarmSurveyDto } from './dto/create-farm-survey.dto';
import type { HarvestCropCycleDto } from './dto/harvest-crop-cycle.dto';
import type { UpdateCropCycleDto } from './dto/update-crop-cycle.dto';
import type { UpdateFarmDto } from './dto/update-farm.dto';

const farmInclude = Prisma.validator<Prisma.FarmInclude>()({
  cropCycles: {
    include: { crop: true },
    orderBy: { createdAt: 'desc' },
  },
});

const allowedCycleTransitions: Record<CropCycleStatus, readonly CropCycleStatus[]> = {
  [CropCycleStatus.PLANNED]: [CropCycleStatus.ACTIVE, CropCycleStatus.ABANDONED],
  [CropCycleStatus.ACTIVE]: [CropCycleStatus.HARVESTED, CropCycleStatus.ABANDONED],
  [CropCycleStatus.HARVESTED]: [],
  [CropCycleStatus.ABANDONED]: [],
};

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listReferenceCrops() {
    return this.prisma.crop.findMany({
      where: { isActive: true },
      orderBy: [{ nameEn: 'asc' }, { code: 'asc' }],
    });
  }

  async listMyFarms(actor: CurrentUser) {
    this.ensureFarmer(actor);
    const membership = await this.findMembership(actor.userId, false);
    if (!membership) {
      return [];
    }
    return this.prisma.farm.findMany({
      where: { membershipId: membership.id },
      include: farmInclude,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createMyFarm(dto: CreateFarmDto, actor: CurrentUser, requestId?: string) {
    this.ensureFarmer(actor);
    const membership = await this.findEditableMembership(actor.userId);
    this.validateCoordinates(dto.latitude, dto.longitude, membership);

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          membershipId: membership.id,
          farmerProfileId: membership.farmerProfileId,
          name: dto.name.trim(),
          village: this.nullableText(dto.village),
          district: this.nullableText(dto.district),
          state: this.nullableText(dto.state),
          pincode: dto.pincode,
          areaAcres: dto.areaAcres,
          ownershipType: dto.ownershipType,
          irrigationSource: dto.irrigationSource ?? null,
          soilType: this.nullableText(dto.soilType),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          locationCapturedAt: dto.latitude === undefined ? null : new Date(),
          isActive: dto.isActive ?? true,
        },
        include: farmInclude,
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_CREATED',
          resourceType: 'Farm',
          resourceId: farm.id,
          newValue: this.farmAuditValue(farm),
          requestId,
        },
        tx,
      );
      return farm;
    });
  }

  async createAssignedFarmSurvey(
    dto: CreateFarmSurveyDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensurePromoter(actor);
    const assignment = await this.prisma.kisanClubPromoterAssignment.findFirst({
      where: {
        membershipId: dto.membershipId,
        promoterUserId: actor.userId,
        status: 'ACTIVE',
      },
      include: { membership: true },
    });
    if (!assignment) {
      throw this.notFound('Active Kisan Club farmer assignment was not found');
    }
    const membership = assignment.membership;
    if (membership.status !== KisanClubMembershipStatus.ACTIVE) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Assigned Kisan Club membership is not active',
      });
    }
    this.validateCoordinates(dto.farm.latitude, dto.farm.longitude, membership);
    if (dto.cropCycle) {
      await this.validateCropCycleReferences(
        dto.cropCycle.cropId,
        dto.cropCycle.varietyProductId,
      );
      this.validateCycleDates(
        dto.cropCycle.sowingDate,
        dto.cropCycle.expectedHarvestDate,
      );
      if (dto.cropCycle.areaAcres > dto.farm.areaAcres) {
        throw this.validationError('Crop-cycle area cannot exceed the farm area');
      }
      if (
        dto.cropCycle.status === CropCycleStatus.HARVESTED ||
        dto.cropCycle.status === CropCycleStatus.ABANDONED
      ) {
        throw this.validationError('A surveyed crop cycle must be planned or active');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          membershipId: membership.id,
          farmerProfileId: membership.farmerProfileId,
          name: dto.farm.name.trim(),
          village: this.nullableText(dto.farm.village),
          district: this.nullableText(dto.farm.district),
          state: this.nullableText(dto.farm.state),
          pincode: dto.farm.pincode,
          areaAcres: dto.farm.areaAcres,
          ownershipType: dto.farm.ownershipType,
          irrigationSource: dto.farm.irrigationSource ?? null,
          soilType: this.nullableText(dto.farm.soilType),
          latitude: dto.farm.latitude ?? null,
          longitude: dto.farm.longitude ?? null,
          locationCapturedAt: dto.farm.latitude === undefined ? null : new Date(),
          isActive: dto.farm.isActive ?? true,
        },
      });
      let cycle = null;
      if (dto.cropCycle) {
        cycle = await tx.farmCropCycle.create({
          data: {
            farmId: farm.id,
            cropId: dto.cropCycle.cropId,
            varietyName: this.nullableText(dto.cropCycle.varietyName),
            varietyProductId: dto.cropCycle.varietyProductId ?? null,
            areaAcres: dto.cropCycle.areaAcres,
            season: dto.cropCycle.season.trim(),
            sowingDate: this.dateValue(dto.cropCycle.sowingDate),
            expectedHarvestDate: this.dateValue(dto.cropCycle.expectedHarvestDate),
            status: dto.cropCycle.status ?? CropCycleStatus.ACTIVE,
          },
          include: { crop: true },
        });
      }
      await this.recordAudit(
        actor,
        {
          action: 'FARM_SURVEY_CREATED',
          resourceType: 'Farm',
          resourceId: farm.id,
          newValue: {
            ...this.farmAuditValue(farm),
            recordedSource: FarmActivitySource.PROMOTER,
            assignedMembershipId: membership.id,
          },
          requestId,
        },
        tx,
      );
      if (cycle) {
        await this.recordAudit(
          actor,
          {
            action: 'FARM_CROP_CYCLE_CREATED',
            resourceType: 'FarmCropCycle',
            resourceId: cycle.id,
            newValue: {
              ...this.cycleAuditValue(cycle),
              recordedSource: FarmActivitySource.PROMOTER,
            },
            requestId,
          },
          tx,
        );
      }
      return { farm, cropCycle: cycle };
    });
  }

  async createAttributedFarmSurvey(
    dto: CreateAttributedFarmSurveyDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensurePromoter(actor);
    const attribution = await this.prisma.promoterAttribution.findFirst({
      where: {
        farmerProfileId: dto.farmerProfileId,
        promoterUserId: actor.userId,
        promoterOrganisationId: actor.organisationId,
        status: PromoterAttributionStatus.ACTIVE,
        farmerProfile: {
          user: {
            status: UserStatus.ACTIVE,
            memberships: {
              some: {
                role: PlatformRole.FARMER,
                status: MembershipStatus.ACTIVE,
                organisation: { status: OrganisationStatus.ACTIVE },
              },
            },
          },
        },
      },
      select: { id: true, farmerProfileId: true },
    });
    if (!attribution) {
      throw this.notFound('Active promoter attribution for the farmer was not found');
    }
    if (dto.farm.latitude !== undefined || dto.farm.longitude !== undefined) {
      throw this.validationError(
        'Precise location is not accepted for a general promoter farm survey',
      );
    }
    if (dto.cropCycle) {
      await this.validateCropCycleReferences(
        dto.cropCycle.cropId,
        dto.cropCycle.varietyProductId,
      );
      this.validateCycleDates(
        dto.cropCycle.sowingDate,
        dto.cropCycle.expectedHarvestDate,
      );
      if (dto.cropCycle.areaAcres > dto.farm.areaAcres) {
        throw this.validationError('Crop-cycle area cannot exceed the farm area');
      }
      if (
        dto.cropCycle.status === CropCycleStatus.HARVESTED ||
        dto.cropCycle.status === CropCycleStatus.ABANDONED
      ) {
        throw this.validationError('A surveyed crop cycle must be planned or active');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          membershipId: null,
          farmerProfileId: attribution.farmerProfileId,
          name: dto.farm.name.trim(),
          village: this.nullableText(dto.farm.village),
          district: this.nullableText(dto.farm.district),
          state: this.nullableText(dto.farm.state),
          pincode: dto.farm.pincode,
          areaAcres: dto.farm.areaAcres,
          ownershipType: dto.farm.ownershipType,
          irrigationSource: dto.farm.irrigationSource ?? null,
          soilType: this.nullableText(dto.farm.soilType),
          latitude: null,
          longitude: null,
          locationCapturedAt: null,
          isActive: dto.farm.isActive ?? true,
        },
      });
      let cycle = null;
      if (dto.cropCycle) {
        cycle = await tx.farmCropCycle.create({
          data: {
            farmId: farm.id,
            cropId: dto.cropCycle.cropId,
            varietyName: this.nullableText(dto.cropCycle.varietyName),
            varietyProductId: dto.cropCycle.varietyProductId ?? null,
            areaAcres: dto.cropCycle.areaAcres,
            season: dto.cropCycle.season.trim(),
            sowingDate: this.dateValue(dto.cropCycle.sowingDate),
            expectedHarvestDate: this.dateValue(dto.cropCycle.expectedHarvestDate),
            status: dto.cropCycle.status ?? CropCycleStatus.ACTIVE,
          },
          include: { crop: true },
        });
      }
      await this.recordAudit(
        actor,
        {
          action: 'PROMOTER_FARM_SURVEY_CREATED',
          resourceType: 'Farm',
          resourceId: farm.id,
          newValue: {
            ...this.farmAuditValue(farm),
            recordedSource: FarmActivitySource.PROMOTER,
            promoterAttributionId: attribution.id,
          },
          requestId,
        },
        tx,
      );
      if (cycle) {
        await this.recordAudit(
          actor,
          {
            action: 'FARM_CROP_CYCLE_CREATED',
            resourceType: 'FarmCropCycle',
            resourceId: cycle.id,
            newValue: {
              ...this.cycleAuditValue(cycle),
              recordedSource: FarmActivitySource.PROMOTER,
              promoterAttributionId: attribution.id,
            },
            requestId,
          },
          tx,
        );
      }
      return { farm, cropCycle: cycle };
    });
  }

  async updateMyFarm(
    farmId: string,
    dto: UpdateFarmDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    this.ensureNonEmptyUpdate(dto);
    const membership = await this.findEditableMembership(actor.userId);
    const current = await this.findOwnedFarm(farmId, membership.id);
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.validateCoordinates(dto.latitude, dto.longitude, membership);
    }
    if (dto.areaAcres !== undefined) {
      const largestCycle = await this.prisma.farmCropCycle.findFirst({
        where: { farmId },
        orderBy: { areaAcres: 'desc' },
        select: { areaAcres: true },
      });
      if (largestCycle && dto.areaAcres < largestCycle.areaAcres.toNumber()) {
        throw this.validationError('Farm area cannot be smaller than an existing crop cycle');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.update({
        where: { id: current.id },
        data: this.farmUpdateInput(dto),
        include: farmInclude,
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_UPDATED',
          resourceType: 'Farm',
          resourceId: farm.id,
          previousValue: this.farmAuditValue(current),
          newValue: this.farmAuditValue(farm),
          requestId,
        },
        tx,
      );
      return farm;
    });
  }

  async listMyCropCycles(farmId: string, actor: CurrentUser) {
    this.ensureFarmer(actor);
    const membership = await this.findMembershipOrThrow(actor.userId);
    await this.findOwnedFarm(farmId, membership.id);
    return this.prisma.farmCropCycle.findMany({
      where: { farmId },
      include: { crop: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMyCropCycle(
    farmId: string,
    dto: CreateCropCycleDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    const membership = await this.findEditableMembership(actor.userId);
    const farm = await this.findOwnedFarm(farmId, membership.id);
    if (!farm.isActive) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Crop cycles cannot be added to an inactive farm',
      });
    }
    if (dto.status === CropCycleStatus.HARVESTED || dto.status === CropCycleStatus.ABANDONED) {
      throw this.validationError('A new crop cycle must be planned or active');
    }
    await this.validateCropCycleReferences(dto.cropId, dto.varietyProductId);
    this.validateCycleDates(dto.sowingDate, dto.expectedHarvestDate);
    this.validateCycleArea(dto.areaAcres, farm);

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.farmCropCycle.create({
        data: {
          farmId,
          cropId: dto.cropId,
          varietyName: this.nullableText(dto.varietyName),
          varietyProductId: dto.varietyProductId ?? null,
          areaAcres: dto.areaAcres,
          season: dto.season.trim(),
          sowingDate: this.dateValue(dto.sowingDate),
          expectedHarvestDate: this.dateValue(dto.expectedHarvestDate),
          status: dto.status ?? CropCycleStatus.ACTIVE,
        },
        include: { crop: true },
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_CROP_CYCLE_CREATED',
          resourceType: 'FarmCropCycle',
          resourceId: cycle.id,
          newValue: this.cycleAuditValue(cycle),
          requestId,
        },
        tx,
      );
      if (membership.status === KisanClubMembershipStatus.PENDING_PROFILE) {
        const updatedMembership = await tx.kisanClubMembership.update({
          where: { id: membership.id },
          data: { status: KisanClubMembershipStatus.AWAITING_PROMOTER },
        });
        await this.recordAudit(
          actor,
          {
            action: 'KISAN_CLUB_PROFILE_COMPLETED',
            resourceType: 'KisanClubMembership',
            resourceId: membership.id,
            previousValue: { status: membership.status },
            newValue: { status: updatedMembership.status },
            requestId,
          },
          tx,
        );
      }
      return cycle;
    });
  }

  async updateMyCropCycle(
    farmId: string,
    cycleId: string,
    dto: UpdateCropCycleDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    this.ensureNonEmptyUpdate(dto);
    const membership = await this.findEditableMembership(actor.userId);
    const farm = await this.findOwnedFarm(farmId, membership.id);
    const current = await this.findOwnedCycle(farmId, cycleId);
    if (dto.status === CropCycleStatus.HARVESTED) {
      throw this.validationError('Use the harvest endpoint to harvest a crop cycle');
    }
    if (dto.status && dto.status !== current.status) {
      this.ensureCycleTransition(current.status, dto.status);
    }
    if (dto.cropId || dto.varietyProductId) {
      await this.validateCropCycleReferences(
        dto.cropId ?? current.cropId,
        dto.varietyProductId ?? current.varietyProductId ?? undefined,
      );
    }
    const sowingDate = dto.sowingDate ?? this.dateString(current.sowingDate);
    const harvestDate = dto.expectedHarvestDate ?? this.dateString(current.expectedHarvestDate);
    this.validateCycleDates(sowingDate, harvestDate);
    this.validateCycleArea(dto.areaAcres ?? current.areaAcres.toNumber(), farm);

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.farmCropCycle.update({
        where: { id: current.id },
        data: this.cycleUpdateInput(dto),
        include: { crop: true },
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_CROP_CYCLE_UPDATED',
          resourceType: 'FarmCropCycle',
          resourceId: cycle.id,
          previousValue: this.cycleAuditValue(current),
          newValue: this.cycleAuditValue(cycle),
          requestId,
        },
        tx,
      );
      return cycle;
    });
  }

  async harvestMyCropCycle(
    farmId: string,
    cycleId: string,
    dto: HarvestCropCycleDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    const membership = await this.findEditableMembership(actor.userId);
    await this.findOwnedFarm(farmId, membership.id);
    const current = await this.findOwnedCycle(farmId, cycleId);
    this.ensureCycleTransition(current.status, CropCycleStatus.HARVESTED);
    const harvestDate = this.requiredDate(dto.actualHarvestDate);
    if (current.sowingDate && harvestDate < current.sowingDate) {
      throw this.validationError('Harvest date cannot be before the sowing date');
    }
    if (harvestDate > new Date()) {
      throw this.validationError('Harvest date cannot be in the future');
    }

    return this.prisma.$transaction(async (tx) => {
      const cycle = await tx.farmCropCycle.update({
        where: { id: current.id },
        data: {
          status: CropCycleStatus.HARVESTED,
          actualHarvestDate: harvestDate,
          ...(dto.yieldQuintals !== undefined ? { yieldQuintals: dto.yieldQuintals } : {}),
        },
        include: { crop: true },
      });
      const activity = await tx.farmActivity.create({
        data: {
          cropCycleId: current.id,
          activityType: 'HARVEST',
          occurredOn: harvestDate,
          recordedSource: FarmActivitySource.FARMER,
          recordedByUserId: actor.userId,
        },
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_CROP_CYCLE_HARVESTED',
          resourceType: 'FarmCropCycle',
          resourceId: cycle.id,
          previousValue: this.cycleAuditValue(current),
          newValue: this.cycleAuditValue(cycle),
          requestId,
        },
        tx,
      );
      await this.recordAudit(
        actor,
        {
          action: 'FARM_ACTIVITY_CREATED',
          resourceType: 'FarmActivity',
          resourceId: activity.id,
          newValue: this.activityAuditValue(activity),
          requestId,
        },
        tx,
      );
      return cycle;
    });
  }

  async listMyActivities(cycleId: string, actor: CurrentUser) {
    this.ensureFarmer(actor);
    const membership = await this.findMembershipOrThrow(actor.userId);
    await this.findCycleOwnedByMembership(cycleId, membership.id);
    return this.prisma.farmActivity.findMany({
      where: { cropCycleId: cycleId },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createMyActivity(
    cycleId: string,
    dto: CreateFarmActivityDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor);
    const membership = await this.findEditableMembership(actor.userId);
    const cycle = await this.findCycleOwnedByMembership(cycleId, membership.id);
    if (dto.activityType === 'HARVEST') {
      throw this.validationError('Use the harvest endpoint to record harvest');
    }
    if (dto.productOrderId) {
      const order = await this.prisma.productOrder.findFirst({
        where: { id: dto.productOrderId, farmerProfileId: membership.farmerProfileId },
        select: { id: true },
      });
      if (!order) {
        throw this.validationError('Product order does not belong to this farmer');
      }
    }
    const occurredOn = this.requiredDate(dto.occurredOn);
    if (occurredOn > new Date()) {
      throw this.validationError('Activity date cannot be in the future');
    }
    if (cycle.sowingDate && occurredOn < cycle.sowingDate) {
      throw this.validationError('Activity date cannot be before the sowing date');
    }

    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.farmActivity.create({
        data: {
          cropCycleId: cycle.id,
          activityType: dto.activityType,
          occurredOn,
          notes: this.nullableText(dto.notes),
          productOrderId: dto.productOrderId ?? null,
          recordedSource: FarmActivitySource.FARMER,
          recordedByUserId: actor.userId,
        },
      });
      await this.recordAudit(
        actor,
        {
          action: 'FARM_ACTIVITY_CREATED',
          resourceType: 'FarmActivity',
          resourceId: activity.id,
          newValue: this.activityAuditValue(activity),
          requestId,
        },
        tx,
      );
      return activity;
    });
  }

  private async findMembership(userId: string, required: boolean) {
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: { farmerProfile: { userId } },
    });
    if (!membership && required) {
      throw this.notFound('Kisan Club membership was not found');
    }
    return membership;
  }

  private async findMembershipOrThrow(userId: string): Promise<KisanClubMembership> {
    const membership = await this.findMembership(userId, true);
    return membership as KisanClubMembership;
  }

  private async findEditableMembership(userId: string): Promise<KisanClubMembership> {
    const membership = await this.findMembershipOrThrow(userId);
    if (
      membership.status === KisanClubMembershipStatus.SUSPENDED ||
      membership.status === KisanClubMembershipStatus.CLOSED ||
      membership.status === KisanClubMembershipStatus.INACTIVE
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'This Kisan Club membership is read-only',
      });
    }
    return membership;
  }

  private async findOwnedFarm(farmId: string, membershipId: string): Promise<Farm> {
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId, membershipId } });
    if (!farm) {
      throw this.notFound('Farm was not found');
    }
    return farm;
  }

  private async findOwnedCycle(farmId: string, cycleId: string): Promise<FarmCropCycle> {
    const cycle = await this.prisma.farmCropCycle.findFirst({ where: { id: cycleId, farmId } });
    if (!cycle) {
      throw this.notFound('Crop cycle was not found');
    }
    return cycle;
  }

  private async findCycleOwnedByMembership(cycleId: string, membershipId: string) {
    const cycle = await this.prisma.farmCropCycle.findFirst({
      where: { id: cycleId, farm: { membershipId } },
    });
    if (!cycle) {
      throw this.notFound('Crop cycle was not found');
    }
    return cycle;
  }

  private async validateCropCycleReferences(cropId: string, varietyProductId?: string) {
    const [crop, product] = await Promise.all([
      this.prisma.crop.findFirst({ where: { id: cropId, isActive: true }, select: { id: true } }),
      varietyProductId
        ? this.prisma.masterProduct.findFirst({
            where: { id: varietyProductId, status: CatalogueStatus.APPROVED },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!crop) {
      throw this.validationError('Select an active crop from the reference list');
    }
    if (varietyProductId && !product) {
      throw this.validationError('Variety product must be an approved catalogue product');
    }
  }

  private validateCoordinates(
    latitude: number | undefined,
    longitude: number | undefined,
    membership: KisanClubMembership,
  ): void {
    if ((latitude === undefined) !== (longitude === undefined)) {
      throw this.validationError('Latitude and longitude must be provided together');
    }
    if (latitude !== undefined && !membership.preciseLocationConsent) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Precise location consent is required before saving coordinates',
      });
    }
  }

  private validateCycleDates(
    sowingDate?: string | null,
    expectedHarvestDate?: string | null,
  ): void {
    if (!sowingDate || !expectedHarvestDate) {
      return;
    }
    if (this.requiredDate(expectedHarvestDate) < this.requiredDate(sowingDate)) {
      throw this.validationError('Expected harvest date cannot be before the sowing date');
    }
  }

  private validateCycleArea(areaAcres: number, farm: Farm): void {
    if (areaAcres > farm.areaAcres.toNumber()) {
      throw this.validationError('Crop-cycle area cannot exceed the farm area');
    }
  }

  private ensureCycleTransition(from: CropCycleStatus, to: CropCycleStatus): void {
    if (!allowedCycleTransitions[from].includes(to)) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: `Crop cycle cannot move from ${from} to ${to}`,
      });
    }
  }

  private ensureNonEmptyUpdate(dto: object): void {
    if (Object.keys(dto).length === 0) {
      throw this.validationError('Provide at least one field to update');
    }
  }

  private farmUpdateInput(dto: UpdateFarmDto): Prisma.FarmUpdateInput {
    const data: Prisma.FarmUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.village !== undefined) data.village = this.nullableText(dto.village);
    if (dto.district !== undefined) data.district = this.nullableText(dto.district);
    if (dto.state !== undefined) data.state = this.nullableText(dto.state);
    if (dto.pincode !== undefined) data.pincode = dto.pincode;
    if (dto.areaAcres !== undefined) data.areaAcres = dto.areaAcres;
    if (dto.ownershipType !== undefined) data.ownershipType = dto.ownershipType;
    if (dto.irrigationSource !== undefined) data.irrigationSource = dto.irrigationSource;
    if (dto.soilType !== undefined) data.soilType = this.nullableText(dto.soilType);
    if (dto.latitude !== undefined) {
      data.latitude = dto.latitude;
      data.locationCapturedAt = new Date();
    }
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }

  private cycleUpdateInput(dto: UpdateCropCycleDto): Prisma.FarmCropCycleUpdateInput {
    const data: Prisma.FarmCropCycleUpdateInput = {};
    if (dto.cropId !== undefined) data.crop = { connect: { id: dto.cropId } };
    if (dto.varietyName !== undefined) data.varietyName = this.nullableText(dto.varietyName);
    if (dto.varietyProductId !== undefined) {
      data.varietyProduct = { connect: { id: dto.varietyProductId } };
    }
    if (dto.areaAcres !== undefined) data.areaAcres = dto.areaAcres;
    if (dto.season !== undefined) data.season = dto.season.trim();
    if (dto.sowingDate !== undefined) data.sowingDate = this.requiredDate(dto.sowingDate);
    if (dto.expectedHarvestDate !== undefined) {
      data.expectedHarvestDate = this.requiredDate(dto.expectedHarvestDate);
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.yieldQuintals !== undefined) data.yieldQuintals = dto.yieldQuintals;
    return data;
  }

  private farmAuditValue(farm: Farm): Prisma.InputJsonObject {
    return {
      membershipId: farm.membershipId,
      farmerProfileId: farm.farmerProfileId,
      name: farm.name,
      pincode: farm.pincode,
      areaAcres: farm.areaAcres.toString(),
      ownershipType: farm.ownershipType,
      irrigationSource: farm.irrigationSource,
      isActive: farm.isActive,
      hasPreciseLocation: farm.latitude !== null && farm.longitude !== null,
    };
  }

  private cycleAuditValue(cycle: FarmCropCycle): Prisma.InputJsonObject {
    return {
      farmId: cycle.farmId,
      cropId: cycle.cropId,
      varietyName: cycle.varietyName,
      varietyProductId: cycle.varietyProductId,
      areaAcres: cycle.areaAcres.toString(),
      season: cycle.season,
      sowingDate: this.dateString(cycle.sowingDate),
      expectedHarvestDate: this.dateString(cycle.expectedHarvestDate),
      actualHarvestDate: this.dateString(cycle.actualHarvestDate),
      status: cycle.status,
      yieldQuintals: cycle.yieldQuintals?.toString() ?? null,
    };
  }

  private activityAuditValue(activity: {
    cropCycleId: string;
    activityType: string;
    occurredOn: Date;
    notes: string | null;
    productOrderId: string | null;
    recordedSource: string;
    recordedByUserId: string | null;
  }): Prisma.InputJsonObject {
    return {
      cropCycleId: activity.cropCycleId,
      activityType: activity.activityType,
      occurredOn: this.dateString(activity.occurredOn),
      notes: activity.notes,
      productOrderId: activity.productOrderId,
      recordedSource: activity.recordedSource,
      recordedByUserId: activity.recordedByUserId,
    };
  }

  private async recordAudit(
    actor: CurrentUser,
    input: AuditRecordInput,
    tx: Prisma.TransactionClient,
  ) {
    await this.auditService.record(
      {
        ...input,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
      },
      tx,
    );
  }

  private ensureFarmer(actor: CurrentUser): void {
    if (actor.role !== PlatformRole.FARMER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Farmer role is required',
      });
    }
  }

  private ensurePromoter(actor: CurrentUser): void {
    if (actor.role !== PlatformRole.PROMOTER && actor.role !== PlatformRole.SALES_PARTNER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Promoter or sales-partner role is required',
      });
    }
  }

  private dateValue(value?: string): Date | null {
    return value ? this.requiredDate(value) : null;
  }

  private requiredDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private dateString(value: Date | null): string | null {
    return value?.toISOString().slice(0, 10) ?? null;
  }

  private decimalNumber(value: Prisma.Decimal | null): number | undefined {
    return value === null ? undefined : value.toNumber();
  }

  private nullableText(value?: string): string | null {
    const text = value?.trim();
    return text ? text : null;
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }
}
