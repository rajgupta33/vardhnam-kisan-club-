import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogueStatus,
  KisanClubMembershipStatus,
  KisanClubProgrammeStatus,
  OrganisationType,
  PlatformRole,
} from '@prisma/client';
import type { CurrentUser } from '../../auth/current-user.interface';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import type { ListMarketplaceProductsQueryDto } from '../../marketplace/dto/list-marketplace-products-query.dto';
import type { MarketplaceProductDetailQueryDto } from '../../marketplace/dto/marketplace-product-detail-query.dto';
import {
  MarketplaceService,
  type MarketplaceProgrammeEligibility,
} from '../../marketplace/marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class KisanClubCatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplaceService: MarketplaceService,
  ) {}

  async listProducts(query: ListMarketplaceProductsQueryDto, actor: CurrentUser) {
    const eligibility = await this.getEligibility(actor);
    const result = await this.marketplaceService.listProducts(query, {
      programmeEligibility: eligibility,
    });
    return {
      ...result,
      items: result.items.map((product) => ({
        ...product,
        clubProgrammes: this.programmesForProduct(product.id, eligibility),
      })),
    };
  }

  async getProduct(
    productId: string,
    query: MarketplaceProductDetailQueryDto,
    actor: CurrentUser,
  ) {
    const eligibility = await this.getEligibility(actor);
    const product = await this.marketplaceService.getProduct(productId, query, {
      programmeEligibility: eligibility,
    });
    return {
      ...product,
      clubProgrammes: this.programmesForProduct(productId, eligibility),
    };
  }

  private async getEligibility(actor: CurrentUser): Promise<MarketplaceProgrammeEligibility[]> {
    if (actor.role !== PlatformRole.FARMER) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Farmer role is required for Kisan Club catalogue',
      });
    }
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: { farmerProfile: { userId: actor.userId } },
      select: {
        id: true,
        status: true,
        homePincode: true,
        homeDistrict: true,
      },
    });
    if (!membership) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Kisan Club membership was not found',
      });
    }
    if (membership.status === KisanClubMembershipStatus.CLOSED) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Closed Kisan Club membership cannot access Club catalogue',
      });
    }

    const now = new Date();
    const programmes = await this.prisma.kisanClubProductProgramme.findMany({
      where: {
        status: KisanClubProgrammeStatus.ACTIVE,
        startsAt: { lte: now },
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        product: {
          status: CatalogueStatus.APPROVED,
          companyOrganisation: { type: OrganisationType.VARDHNAM },
        },
      },
      include: { variant: { select: { id: true, isActive: true } } },
      orderBy: [{ displayPriority: 'desc' }, { startsAt: 'asc' }, { id: 'asc' }],
    });

    return programmes
      .filter((programme) => {
        const pincodeEligible =
          programme.eligiblePincodes.length === 0 ||
          programme.eligiblePincodes.includes(membership.homePincode);
        const districtEligible =
          programme.eligibleDistricts.length === 0 ||
          (membership.homeDistrict !== null &&
            programme.eligibleDistricts.some(
              (district) =>
                district.toLocaleLowerCase() === membership.homeDistrict?.toLocaleLowerCase(),
            ));
        const variantEligible = programme.variantId === null || programme.variant?.isActive === true;
        return pincodeEligible && districtEligible && variantEligible;
      })
      .map((programme) => ({
        productId: programme.productId,
        variantId: programme.variantId,
        displayPriority: programme.displayPriority,
        programmeId: programme.id,
      }));
  }

  private programmesForProduct(
    productId: string,
    eligibility: MarketplaceProgrammeEligibility[],
  ) {
    return eligibility
      .filter((programme) => programme.productId === productId)
      .map((programme) => ({
        id: programme.programmeId,
        variantId: programme.variantId,
        displayPriority: programme.displayPriority,
      }));
  }
}
