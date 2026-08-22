import { KycDocumentStatus, OrganisationStatus, OrganisationType } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/**
 * Whether a promoter's organisation counts as verified.
 *
 * The business rule is that a Club promoter's organisation must carry approved,
 * non-expired KYC. That rule was written for partner organisations, and taken
 * literally it permanently excludes Vardhnam's own promoters: the onboarding
 * module accepts KYC documents only for company and distributor organisations,
 * so nobody can create the document a first-party promoter is required to have.
 * A promoter employed by Vardhnam is verified by being first-party, and is
 * treated as such here.
 *
 * These live together because the same rule is asked three ways -- as a filter
 * when assigning a confirmed order, as a filter when reassigning one, and as a
 * boolean when explaining why a candidate was excluded from matching. Three
 * hand-written copies are how one of them silently stops agreeing with the
 * others.
 */
export function approvedKycDocumentFilter(at: Date): Prisma.KycDocumentWhereInput {
  return {
    status: KycDocumentStatus.APPROVED,
    OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
  };
}

/** The same rule as a filter on the promoter's organisation. */
export function verifiedPromoterOrganisationFilter(at: Date): Prisma.OrganisationWhereInput {
  return {
    status: OrganisationStatus.ACTIVE,
    OR: [
      { type: OrganisationType.VARDHNAM },
      { kycDocuments: { some: approvedKycDocumentFilter(at) } },
    ],
  };
}

/**
 * The same rule against an organisation already loaded with its approved,
 * unexpired KYC documents (see `approvedKycDocumentFilter`). Callers that pass
 * an unfiltered document list will wrongly treat an expired or rejected
 * document as proof of verification.
 */
export function isVerifiedPromoterOrganisation(organisation: {
  status: OrganisationStatus;
  type: OrganisationType;
  kycDocuments: readonly unknown[];
}): boolean {
  return (
    organisation.status === OrganisationStatus.ACTIVE &&
    (organisation.type === OrganisationType.VARDHNAM || organisation.kycDocuments.length > 0)
  );
}
