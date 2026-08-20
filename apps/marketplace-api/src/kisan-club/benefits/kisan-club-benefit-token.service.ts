import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogueStatus,
  DistributorOfferStatus,
  InventoryBatchStatus,
  KisanClubAssignmentStatus,
  KisanClubBenefitTokenStatus,
  KisanClubMembershipStatus,
  OrganisationStatus,
  PlatformRole,
  Prisma,
  WarehouseStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AccessService } from '../../access/access.service';
import { PermissionCode } from '../../access/permission-codes';
import { AuditService } from '../../audit/audit.service';
import type { CurrentUser } from '../../auth/current-user.interface';
import { generateOtp, hashOtp } from '../../auth/crypto.util';
import { paginationOffset } from '../../common/dto/pagination-query.dto';
import { ApiErrorCode } from '../../common/errors/api-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateKisanClubBenefitTokenDto } from '../dto/create-kisan-club-benefit-token.dto';
import type { ListKisanClubBenefitTokensQueryDto } from '../dto/list-kisan-club-benefit-tokens-query.dto';
import type { RedeemKisanClubBenefitTokenDto } from '../dto/redeem-kisan-club-benefit-token.dto';
import { KisanClubBenefitService } from './kisan-club-benefit.service';

const MAX_REDEMPTION_ATTEMPTS = 5;

export function generateKisanClubBenefitTokenCredential(): {
  code: string;
  tokenReference: string;
  tokenSalt: string;
  tokenHash: string;
} {
  const otp = generateOtp();
  const tokenReference = randomBytes(4).toString('hex').toUpperCase();
  const code = `VKC-${tokenReference}-${otp.code}`;
  return {
    code,
    tokenReference,
    tokenSalt: otp.salt,
    tokenHash: hashOtp(code, otp.salt),
  };
}

export function verifyKisanClubBenefitTokenCode(
  code: string,
  tokenSalt: string,
  tokenHash: string,
): boolean {
  return hashOtp(code.trim().toUpperCase(), tokenSalt) === tokenHash;
}

const tokenInclude = Prisma.validator<Prisma.KisanClubBenefitTokenInclude>()({
  benefitRule: { include: { programme: { include: { product: true, variant: true } } } },
  offer: { include: { distributorOrganisation: true, product: true, variant: true } },
});
type TokenDetail = Prisma.KisanClubBenefitTokenGetPayload<{ include: typeof tokenInclude }>;

@Injectable()
export class KisanClubBenefitTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessService: AccessService,
    private readonly configService: ConfigService,
    private readonly benefitService: KisanClubBenefitService,
  ) {}

  async issue(
    dto: CreateKisanClubBenefitTokenDto,
    actor: CurrentUser,
    requestId?: string,
  ) {
    this.ensureFarmer(actor, PermissionCode.KISAN_CLUB_BENEFIT_TOKENS_CREATE_OWN);
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: {
        farmerProfile: { userId: actor.userId },
        status: KisanClubMembershipStatus.ACTIVE,
      },
      include: {
        promoterAssignments: {
          where: { status: KisanClubAssignmentStatus.ACTIVE },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!membership) throw this.validation('An active Kisan Club membership is required');

    const offer = await this.prisma.distributorOffer.findUnique({
      where: { id: dto.offerId },
      include: {
        distributorOrganisation: true,
        warehouse: true,
        batch: true,
        product: { include: { brand: true } },
        variant: true,
      },
    });
    if (!offer) throw this.notFound('Distributor offer was not found');
    this.validateOffer(offer, membership.homePincode, dto.quantity);
    const availableQuantity = await this.availableQuantity(offer);
    if (availableQuantity < dto.quantity) {
      throw this.validation('Requested quantity exceeds backend-derived sellable availability');
    }

    const evaluation = await this.benefitService.evaluateForCheckout(this.prisma, {
      farmerProfileId: membership.farmerProfileId,
      productId: offer.productId,
      variantId: offer.variantId,
      pincode: membership.homePincode,
      unitPricePaise: offer.sellingPricePaise,
      quantity: dto.quantity,
      at: new Date(),
    });
    if (!evaluation) throw this.validation('No Kisan Club benefit is currently available');

    const { code, tokenReference, tokenSalt, tokenHash } =
      generateKisanClubBenefitTokenCredential();
    const ttlHours = this.configService.get<number>('KISAN_CLUB_BENEFIT_TOKEN_TTL_HOURS') ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const token = await this.prisma.$transaction(async (tx) => {
      const created = await tx.kisanClubBenefitToken.create({
        data: {
          tokenReference,
          membershipId: membership.id,
          benefitRuleId: evaluation.ruleId,
          offerId: offer.id,
          promoterUserId: membership.promoterAssignments[0]?.promoterUserId ?? null,
          quantity: dto.quantity,
          quotedUnitPricePaise: offer.sellingPricePaise,
          quotedBenefitPaise: evaluation.totalBenefitPaise,
          tokenHash,
          tokenSalt,
          expiresAt,
        },
        include: tokenInclude,
      });
      await this.auditService.record(
        {
          action: 'KISAN_CLUB_BENEFIT_TOKEN_ISSUED',
          resourceType: 'KisanClubBenefitToken',
          resourceId: created.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          organisationId: actor.organisationId,
          newValue: this.auditValue(created),
          requestId,
          reason: 'Farmer requested a Kisan Club benefit token',
        },
        tx,
      );
      return created;
    });

    return { ...this.toDetail(token), code };
  }

  async listMine(query: ListKisanClubBenefitTokensQueryDto, actor: CurrentUser) {
    this.ensureFarmer(actor, PermissionCode.KISAN_CLUB_BENEFIT_TOKENS_READ_OWN);
    const membership = await this.prisma.kisanClubMembership.findFirst({
      where: { farmerProfile: { userId: actor.userId } },
      select: { id: true },
    });
    if (!membership) throw this.notFound('Kisan Club membership was not found');
    const { page, limit, skip } = paginationOffset(query);
    const now = new Date();
    const statusWhere: Prisma.KisanClubBenefitTokenWhereInput =
      query.status === KisanClubBenefitTokenStatus.EXPIRED
        ? {
            OR: [
              { status: KisanClubBenefitTokenStatus.EXPIRED },
              { status: KisanClubBenefitTokenStatus.ISSUED, expiresAt: { lte: now } },
            ],
          }
        : query.status === KisanClubBenefitTokenStatus.ISSUED
          ? { status: KisanClubBenefitTokenStatus.ISSUED, expiresAt: { gt: now } }
          : query.status
            ? { status: query.status }
            : {};
    const where: Prisma.KisanClubBenefitTokenWhereInput = {
      membershipId: membership.id,
      ...statusWhere,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.kisanClubBenefitToken.findMany({
        where,
        include: tokenInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kisanClubBenefitToken.count({ where }),
    ]);
    return { items: items.map((token) => this.toDetail(token)), page, limit, total };
  }

  async authorizeRedemption(
    dto: RedeemKisanClubBenefitTokenDto,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<string> {
    this.ensurePromoter(actor);
    const code = dto.code.trim().toUpperCase();
    const tokenReference = code.split('-')[1];
    if (!tokenReference) throw this.invalidToken();

    const outcome = await this.prisma.$transaction(async (tx) => {
      const token = await tx.kisanClubBenefitToken.findUnique({
        where: { tokenReference },
        include: {
          membership: {
            include: {
              promoterAssignments: {
                where: { status: KisanClubAssignmentStatus.ACTIVE },
                orderBy: { assignedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
      if (!token) return { error: 'INVALID' as const };
      const assignedPromoter = token.membership.promoterAssignments[0]?.promoterUserId;
      if (token.membershipId !== dto.membershipId || assignedPromoter !== actor.userId) {
        return { error: 'FORBIDDEN' as const };
      }
      if (token.status !== KisanClubBenefitTokenStatus.ISSUED) {
        return { error: 'UNAVAILABLE' as const };
      }
      if (token.expiresAt <= new Date()) {
        const expired = await tx.kisanClubBenefitToken.update({
          where: { id: token.id },
          data: { status: KisanClubBenefitTokenStatus.EXPIRED },
        });
        await this.recordTokenAudit(tx, actor, token, expired, requestId, 'Token expired');
        return { error: 'EXPIRED' as const };
      }
      if (token.attemptCount >= MAX_REDEMPTION_ATTEMPTS) {
        return { error: 'UNAVAILABLE' as const };
      }
      if (!verifyKisanClubBenefitTokenCode(code, token.tokenSalt, token.tokenHash)) {
        const attemptCount = token.attemptCount + 1;
        const updated = await tx.kisanClubBenefitToken.update({
          where: { id: token.id },
          data: {
            attemptCount,
            ...(attemptCount >= MAX_REDEMPTION_ATTEMPTS
              ? { status: KisanClubBenefitTokenStatus.CANCELLED }
              : {}),
          },
        });
        await this.recordTokenAudit(
          tx,
          actor,
          token,
          updated,
          requestId,
          'Invalid token redemption attempt',
        );
        return { error: 'INVALID' as const };
      }
      return { tokenId: token.id };
    });

    if ('tokenId' in outcome) return outcome.tokenId;
    if (outcome.error === 'FORBIDDEN') {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Only the farmer’s active assigned promoter may redeem this token',
      });
    }
    if (outcome.error === 'EXPIRED') {
      throw new ConflictException({ code: ApiErrorCode.CONFLICT, message: 'Benefit token expired' });
    }
    if (outcome.error === 'UNAVAILABLE') {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Benefit token is no longer available',
      });
    }
    throw this.invalidToken();
  }

  async findRedeemable(
    tx: Prisma.TransactionClient,
    tokenId: string,
    actor: CurrentUser,
  ) {
    const token = await tx.kisanClubBenefitToken.findUnique({
      where: { id: tokenId },
      include: {
        membership: {
          include: {
            farmerProfile: true,
            promoterAssignments: {
              where: { status: KisanClubAssignmentStatus.ACTIVE },
              orderBy: { assignedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (
      !token ||
      token.status !== KisanClubBenefitTokenStatus.ISSUED ||
      token.expiresAt <= new Date()
    ) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Benefit token is no longer available',
      });
    }
    if (
      token.membership.status !== KisanClubMembershipStatus.ACTIVE ||
      token.membership.promoterAssignments[0]?.promoterUserId !== actor.userId
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'The active membership assignment is required to redeem this token',
      });
    }
    return token;
  }

  async consume(
    tx: Prisma.TransactionClient,
    tokenId: string,
    productOrderId: string,
    actor: CurrentUser,
    requestId?: string,
  ): Promise<void> {
    const previous = await tx.kisanClubBenefitToken.findUniqueOrThrow({ where: { id: tokenId } });
    const consumedAt = new Date();
    const updated = await tx.kisanClubBenefitToken.updateMany({
      where: {
        id: tokenId,
        status: KisanClubBenefitTokenStatus.ISSUED,
        expiresAt: { gt: consumedAt },
        productOrderId: null,
      },
      data: {
        status: KisanClubBenefitTokenStatus.REDEEMED,
        consumedAt,
        consumedByUserId: actor.userId,
        productOrderId,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'Benefit token was already redeemed or expired',
      });
    }
    const current = await tx.kisanClubBenefitToken.findUniqueOrThrow({ where: { id: tokenId } });
    await this.recordTokenAudit(tx, actor, previous, current, requestId, 'Assisted order created');
  }

  private ensureFarmer(actor: CurrentUser, permission: PermissionCode): void {
    if (
      actor.role !== PlatformRole.FARMER ||
      !this.accessService.hasPermission(actor, permission)
    ) {
      throw new ForbiddenException({ code: ApiErrorCode.FORBIDDEN, message: 'Farmer permission is required' });
    }
  }

  private ensurePromoter(actor: CurrentUser): void {
    if (
      (actor.role !== PlatformRole.PROMOTER && actor.role !== PlatformRole.SALES_PARTNER) ||
      !this.accessService.hasPermission(actor, PermissionCode.KISAN_CLUB_ASSISTED_ORDERS_CREATE)
    ) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Kisan Club assisted-order permission is required',
      });
    }
  }

  private validateOffer(
    offer: Prisma.DistributorOfferGetPayload<{
      include: {
        distributorOrganisation: true;
        warehouse: true;
        batch: true;
        product: { include: { brand: true } };
        variant: true;
      };
    }>,
    pincode: string,
    quantity: number,
  ): void {
    const valid =
      offer.status === DistributorOfferStatus.APPROVED &&
      offer.product.status === CatalogueStatus.APPROVED &&
      offer.product.brand.status === CatalogueStatus.APPROVED &&
      offer.variant.isActive &&
      offer.warehouse.status === WarehouseStatus.ACTIVE &&
      offer.distributorOrganisation.status === OrganisationStatus.ACTIVE &&
      offer.serviceablePincodes.includes(pincode) &&
      (!offer.batch ||
        (offer.batch.status === InventoryBatchStatus.ACTIVE &&
          (!offer.batch.expiryDate || offer.batch.expiryDate >= this.todayStartUtc())));
    if (!valid) throw this.validation('Offer is not currently sellable for the member pincode');
    if (quantity < offer.minimumOrderQuantity) {
      throw this.validation('Requested quantity is below the offer minimum order quantity');
    }
    if (offer.maximumOrderQuantity !== null && quantity > offer.maximumOrderQuantity) {
      throw this.validation('Requested quantity exceeds the offer maximum order quantity');
    }
  }

  private async availableQuantity(offer: {
    distributorOrganisationId: string;
    warehouseId: string;
    productId: string;
    variantId: string;
    batchId: string | null;
  }): Promise<number> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        distributorOrganisationId: offer.distributorOrganisationId,
        warehouseId: offer.warehouseId,
        productId: offer.productId,
        variantId: offer.variantId,
        ...(offer.batchId ? { id: offer.batchId } : {}),
        status: InventoryBatchStatus.ACTIVE,
        OR: [{ expiryDate: null }, { expiryDate: { gte: this.todayStartUtc() } }],
      },
      include: { inventoryMovements: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return batches.reduce(
      (total, batch) => total + Math.max(0, batch.inventoryMovements[0]?.balanceAfter ?? 0),
      0,
    );
  }

  private toDetail(token: TokenDetail) {
    const effectiveStatus =
      token.status === KisanClubBenefitTokenStatus.ISSUED && token.expiresAt <= new Date()
        ? KisanClubBenefitTokenStatus.EXPIRED
        : token.status;
    return {
      id: token.id,
      tokenReference: token.tokenReference,
      membershipId: token.membershipId,
      benefitRuleId: token.benefitRuleId,
      offerId: token.offerId,
      promoterUserId: token.promoterUserId,
      quantity: token.quantity,
      quotedUnitPricePaise: token.quotedUnitPricePaise,
      quotedBenefitPaise: token.quotedBenefitPaise,
      quotedFarmerPayablePaise:
        token.quotedUnitPricePaise * token.quantity - token.quotedBenefitPaise,
      status: effectiveStatus,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
      productOrderId: token.productOrderId,
      product: { id: token.offer.product.id, name: token.offer.product.name },
      variant: { id: token.offer.variant.id, name: token.offer.variant.variantName },
      seller: {
        id: token.offer.distributorOrganisation.id,
        name: token.offer.distributorOrganisation.displayName,
      },
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }

  private auditValue(token: {
    id: string;
    membershipId: string;
    benefitRuleId: string;
    offerId: string;
    promoterUserId: string | null;
    quantity: number;
    quotedUnitPricePaise: number;
    quotedBenefitPaise: number;
    status: KisanClubBenefitTokenStatus;
    expiresAt: Date;
    attemptCount: number;
    consumedAt: Date | null;
    consumedByUserId: string | null;
    productOrderId: string | null;
  }): Prisma.InputJsonObject {
    return {
      membershipId: token.membershipId,
      benefitRuleId: token.benefitRuleId,
      offerId: token.offerId,
      promoterUserId: token.promoterUserId,
      quantity: token.quantity,
      quotedUnitPricePaise: token.quotedUnitPricePaise,
      quotedBenefitPaise: token.quotedBenefitPaise,
      status: token.status,
      expiresAt: token.expiresAt.toISOString(),
      attemptCount: token.attemptCount,
      consumedAt: token.consumedAt?.toISOString() ?? null,
      consumedByUserId: token.consumedByUserId,
      productOrderId: token.productOrderId,
    };
  }

  private async recordTokenAudit(
    tx: Prisma.TransactionClient,
    actor: CurrentUser,
    previous: Parameters<KisanClubBenefitTokenService['auditValue']>[0],
    current: Parameters<KisanClubBenefitTokenService['auditValue']>[0],
    requestId: string | undefined,
    reason: string,
  ): Promise<void> {
    await this.auditService.record(
      {
        action: 'KISAN_CLUB_BENEFIT_TOKEN_UPDATED',
        resourceType: 'KisanClubBenefitToken',
        resourceId: current.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
        organisationId: actor.organisationId,
        previousValue: this.auditValue(previous),
        newValue: this.auditValue(current),
        requestId,
        reason,
      },
      tx,
    );
  }

  private todayStartUtc(): Date {
    const value = new Date();
    value.setUTCHours(0, 0, 0, 0);
    return value;
  }

  private validation(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_FAILED, message });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message });
  }

  private invalidToken(): BadRequestException {
    return this.validation('Benefit token code is invalid');
  }
}
