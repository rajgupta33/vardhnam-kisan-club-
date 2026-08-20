import { Injectable } from '@nestjs/common';
import {
  KisanClubAssignmentStatus,
  KisanClubFulfilmentStatus,
  KisanClubMembershipStatus,
  Prisma,
} from '@prisma/client';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { KisanClubCropIntelligenceQueryDto } from '../dto/kisan-club-crop-intelligence-query.dto';
import type { KisanClubPromoterPerformanceQueryDto } from '../dto/kisan-club-promoter-performance-query.dto';

const includedMembershipStatuses = [
  KisanClubMembershipStatus.AWAITING_PROMOTER,
  KisanClubMembershipStatus.ACTIVE,
];
const terminalFulfilmentStatuses = [
  KisanClubFulfilmentStatus.COMPLETED,
  KisanClubFulfilmentStatus.FAILED,
  KisanClubFulfilmentStatus.PROMOTER_DECLINED,
  KisanClubFulfilmentStatus.CANCELLED,
];

export interface AcreageBucket {
  cycleCount: number;
  areaAcres: number;
}

@Injectable()
export class KisanClubIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async cropSummary(query: KisanClubCropIntelligenceQueryDto) {
    const cycles = await this.prisma.farmCropCycle.findMany({
      where: {
        farm: {
          isActive: true,
          membership: { status: { in: includedMembershipStatuses } },
          ...(query.state?.trim()
            ? { state: { equals: query.state.trim(), mode: 'insensitive' } }
            : {}),
          ...(query.district?.trim()
            ? { district: { equals: query.district.trim(), mode: 'insensitive' } }
            : {}),
        },
        ...(query.cropId ? { cropId: query.cropId } : {}),
        ...(query.season?.trim()
          ? { season: { equals: query.season.trim(), mode: 'insensitive' } }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      select: {
        id: true,
        farmId: true,
        areaAcres: true,
        season: true,
        sowingDate: true,
        status: true,
        crop: { select: { id: true, code: true, nameEn: true, nameHi: true } },
        farm: { select: { state: true, district: true } },
      },
    });

    const byCrop = new Map<
      string,
      AcreageBucket & { cropId: string; cropCode: string; cropNameEn: string; cropNameHi: string }
    >();
    const byDistrict = new Map<string, AcreageBucket & { state: string; district: string }>();
    const byCropDistrict = new Map<
      string,
      AcreageBucket & {
        cropId: string;
        cropCode: string;
        cropNameEn: string;
        state: string;
        district: string;
      }
    >();
    const bySeason = new Map<string, AcreageBucket & { season: string }>();
    const byCycleStatus = new Map<string, AcreageBucket & { status: string }>();
    const bySowingMonth = new Map<string, AcreageBucket & { month: string }>();
    const farmIds = new Set<string>();

    for (const cycle of cycles) {
      const areaAcres = cycle.areaAcres.toNumber();
      const state = cycle.farm.state?.trim() || 'Not recorded';
      const district = cycle.farm.district?.trim() || 'Not recorded';
      const month = cycle.sowingDate ? cycle.sowingDate.toISOString().slice(0, 7) : 'NOT_RECORDED';
      farmIds.add(cycle.farmId);
      this.addBucket(byCrop, cycle.crop.id, areaAcres, {
        cropId: cycle.crop.id,
        cropCode: cycle.crop.code,
        cropNameEn: cycle.crop.nameEn,
        cropNameHi: cycle.crop.nameHi,
      });
      this.addBucket(byDistrict, JSON.stringify([state, district]), areaAcres, {
        state,
        district,
      });
      this.addBucket(byCropDistrict, JSON.stringify([cycle.crop.id, state, district]), areaAcres, {
        cropId: cycle.crop.id,
        cropCode: cycle.crop.code,
        cropNameEn: cycle.crop.nameEn,
        state,
        district,
      });
      this.addBucket(bySeason, cycle.season, areaAcres, { season: cycle.season });
      this.addBucket(byCycleStatus, cycle.status, areaAcres, { status: cycle.status });
      this.addBucket(bySowingMonth, month, areaAcres, { month });
    }

    return {
      generatedAt: new Date(),
      filters: {
        state: query.state?.trim() || null,
        district: query.district?.trim() || null,
        cropId: query.cropId ?? null,
        season: query.season?.trim() || null,
        status: query.status ?? null,
      },
      scopeNote:
        'Aggregate includes active farms for active or promoter-awaiting Club memberships; suspended, inactive and closed memberships are excluded.',
      totals: {
        cropCycleCount: cycles.length,
        farmCount: farmIds.size,
        cropCount: byCrop.size,
        districtCount: byDistrict.size,
        areaAcres: this.roundAcreage(
          cycles.reduce((sum, cycle) => sum + cycle.areaAcres.toNumber(), 0),
        ),
      },
      byCrop: this.sortedBuckets(byCrop, 'areaAcres'),
      byDistrict: this.sortedBuckets(byDistrict, 'areaAcres'),
      byCropDistrict: this.sortedBuckets(byCropDistrict, 'areaAcres'),
      bySeason: this.sortedBuckets(bySeason, 'areaAcres'),
      byCycleStatus: this.sortedBuckets(byCycleStatus, 'areaAcres'),
      bySowingMonth: [...bySowingMonth.values()]
        .map((bucket) => this.finaliseBucket(bucket))
        .sort((left, right) => left.month.localeCompare(right.month)),
    };
  }

  async promoterPerformance(query: KisanClubPromoterPerformanceQueryDto) {
    const { page, limit, skip } = paginationOffset(query);
    const where: Prisma.KisanClubPromoterProfileWhereInput = {
      ...(query.territoryId ? { territoryId: query.territoryId } : {}),
      ...(query.promoterUserId ? { promoterUserId: query.promoterUserId } : {}),
      ...(query.clubEnabled !== undefined ? { clubEnabled: query.clubEnabled } : {}),
    };
    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.kisanClubPromoterProfile.findMany({
        where,
        include: {
          territory: true,
          promoterOrganisation: { select: { id: true, displayName: true } },
          promoterUser: { select: { profile: { select: { displayName: true } } } },
        },
        orderBy: [{ clubEnabled: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.kisanClubPromoterProfile.count({ where }),
    ]);
    const promoterUserIds = profiles.map((profile) => profile.promoterUserId);
    const [farmerCounts, fulfilmentCounts] = promoterUserIds.length
      ? await Promise.all([
          this.prisma.kisanClubPromoterAssignment.groupBy({
            by: ['promoterUserId'],
            where: {
              promoterUserId: { in: promoterUserIds },
              status: KisanClubAssignmentStatus.ACTIVE,
            },
            _count: { _all: true },
          }),
          this.prisma.kisanClubFulfilmentAssignment.groupBy({
            by: ['promoterUserId', 'status'],
            where: { promoterUserId: { in: promoterUserIds } },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const farmerCountByPromoter = new Map(
      farmerCounts.map((item) => [item.promoterUserId, item._count._all]),
    );
    const fulfilmentByPromoter = new Map<string, Map<KisanClubFulfilmentStatus, number>>();
    for (const item of fulfilmentCounts) {
      const counts = fulfilmentByPromoter.get(item.promoterUserId) ?? new Map();
      counts.set(item.status, item._count._all);
      fulfilmentByPromoter.set(item.promoterUserId, counts);
    }

    const items = profiles.map((profile) => {
      const activeFarmerCount = farmerCountByPromoter.get(profile.promoterUserId) ?? 0;
      const counts = fulfilmentByPromoter.get(profile.promoterUserId) ?? new Map();
      const completedCount = counts.get(KisanClubFulfilmentStatus.COMPLETED) ?? 0;
      const failedCount = counts.get(KisanClubFulfilmentStatus.FAILED) ?? 0;
      const declinedCount = counts.get(KisanClubFulfilmentStatus.PROMOTER_DECLINED) ?? 0;
      const cancelledCount = counts.get(KisanClubFulfilmentStatus.CANCELLED) ?? 0;
      const totalFulfilmentCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const resolvedCount = terminalFulfilmentStatuses.reduce(
        (sum, status) => sum + (counts.get(status) ?? 0),
        0,
      );
      return {
        promoterUserId: profile.promoterUserId,
        promoterName: profile.promoterUser.profile?.displayName ?? null,
        promoterOrganisation: profile.promoterOrganisation,
        territory: profile.territory,
        clubEnabled: profile.clubEnabled,
        acceptingNewFarmers: profile.acceptingNewFarmers,
        maxActiveFarmers: profile.maxActiveFarmers,
        activeFarmerCount,
        remainingCapacity: Math.max(0, profile.maxActiveFarmers - activeFarmerCount),
        fulfilment: {
          totalCount: totalFulfilmentCount,
          activeCount: totalFulfilmentCount - resolvedCount,
          resolvedCount,
          completedCount,
          failedCount,
          declinedCount,
          cancelledCount,
          resolvedCompletionRateBps:
            resolvedCount === 0 ? null : Math.floor((completedCount * 10_000) / resolvedCount),
        },
      };
    });

    const summaryResolved = items.reduce((sum, item) => sum + item.fulfilment.resolvedCount, 0);
    const summaryCompleted = items.reduce((sum, item) => sum + item.fulfilment.completedCount, 0);
    return {
      generatedAt: new Date(),
      scopeNote:
        'Snapshot metrics are attributed to each assignment current holder. They are operational indicators, not historical commission or payout records.',
      items,
      page,
      limit,
      total,
      pageSummary: {
        profileCount: items.length,
        enabledProfileCount: items.filter((item) => item.clubEnabled).length,
        activeFarmerCount: items.reduce((sum, item) => sum + item.activeFarmerCount, 0),
        totalCapacity: items.reduce((sum, item) => sum + item.maxActiveFarmers, 0),
        totalFulfilmentCount: items.reduce((sum, item) => sum + item.fulfilment.totalCount, 0),
        resolvedCompletionRateBps:
          summaryResolved === 0 ? null : Math.floor((summaryCompleted * 10_000) / summaryResolved),
      },
    };
  }

  private addBucket<T extends object>(
    buckets: Map<string, AcreageBucket & T>,
    key: string,
    areaAcres: number,
    dimensions: T,
  ): void {
    const existing = buckets.get(key);
    if (existing) {
      existing.cycleCount += 1;
      existing.areaAcres += areaAcres;
      return;
    }
    buckets.set(key, { ...dimensions, cycleCount: 1, areaAcres });
  }

  private sortedBuckets<T extends AcreageBucket>(
    buckets: Map<string, T>,
    field: keyof AcreageBucket,
  ): T[] {
    return [...buckets.values()]
      .map((bucket) => this.finaliseBucket(bucket))
      .sort((left, right) => right[field] - left[field]);
  }

  private finaliseBucket<T extends AcreageBucket>(bucket: T): T {
    return { ...bucket, areaAcres: this.roundAcreage(bucket.areaAcres) };
  }

  private roundAcreage(value: number): number {
    return Math.round(value * 1_000) / 1_000;
  }
}
