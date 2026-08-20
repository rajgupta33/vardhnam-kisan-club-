import { Injectable } from '@nestjs/common';

export interface PromoterMatchCandidate {
  promoterUserId: string;
  territoryId: string | null;
  homeVillage: string | null;
  homePincode: string | null;
  territoryPincodes: string[];
  userActive: boolean;
  membershipActive: boolean;
  clubEnabled: boolean;
  acceptingNewFarmers: boolean;
  territoryActive: boolean;
  kycApproved: boolean;
  payoutEligible: boolean;
  activeFarmerCount: number;
  maxActiveFarmers: number;
}

export interface PromoterMatchSubject {
  village: string | null;
  pincode: string;
}

export interface PromoterMatchDiagnostic {
  promoterUserId: string;
  eligible: boolean;
  excludedReasons: string[];
  sameVillage: boolean;
  samePincode: boolean;
  territoryContainsPincode: boolean;
  capacityHeadroom: number;
}

export interface PromoterMatchResult {
  selectedPromoterUserId: string | null;
  diagnostics: PromoterMatchDiagnostic[];
}

@Injectable()
export class PromoterMatchingService {
  match(subject: PromoterMatchSubject, candidates: PromoterMatchCandidate[]): PromoterMatchResult {
    const diagnostics = candidates.map((candidate) => this.diagnostic(subject, candidate));
    const eligible = diagnostics.filter((item) => item.eligible).sort((left, right) => {
      return (
        Number(right.sameVillage) - Number(left.sameVillage) ||
        Number(right.samePincode) - Number(left.samePincode) ||
        Number(right.territoryContainsPincode) - Number(left.territoryContainsPincode) ||
        right.capacityHeadroom - left.capacityHeadroom ||
        left.promoterUserId.localeCompare(right.promoterUserId)
      );
    });
    return {
      selectedPromoterUserId: eligible[0]?.promoterUserId ?? null,
      diagnostics,
    };
  }

  private diagnostic(
    subject: PromoterMatchSubject,
    candidate: PromoterMatchCandidate,
  ): PromoterMatchDiagnostic {
    const excludedReasons: string[] = [];
    if (!candidate.userActive) excludedReasons.push('USER_INACTIVE');
    if (!candidate.membershipActive) excludedReasons.push('MEMBERSHIP_INACTIVE');
    if (!candidate.clubEnabled) excludedReasons.push('CLUB_DISABLED');
    if (!candidate.acceptingNewFarmers) excludedReasons.push('NOT_ACCEPTING_FARMERS');
    if (!candidate.territoryId) excludedReasons.push('NO_TERRITORY');
    if (!candidate.territoryActive) excludedReasons.push('TERRITORY_INACTIVE');
    if (!candidate.kycApproved) excludedReasons.push('KYC_NOT_APPROVED');
    if (!candidate.payoutEligible) excludedReasons.push('PAYOUT_NOT_ELIGIBLE');
    if (candidate.activeFarmerCount >= candidate.maxActiveFarmers) {
      excludedReasons.push('AT_CAPACITY');
    }
    return {
      promoterUserId: candidate.promoterUserId,
      eligible: excludedReasons.length === 0,
      excludedReasons,
      sameVillage: this.sameText(subject.village, candidate.homeVillage),
      samePincode: subject.pincode === candidate.homePincode,
      territoryContainsPincode: candidate.territoryPincodes.includes(subject.pincode),
      capacityHeadroom:
        candidate.maxActiveFarmers > 0
          ? 1 - candidate.activeFarmerCount / candidate.maxActiveFarmers
          : 0,
    };
  }

  private sameText(left: string | null, right: string | null): boolean {
    return Boolean(left && right && left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase());
  }
}
